const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

module.exports = async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials not configured on the server.' });
  }

  // 1. Extract Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization token' });
  }
  const token = authHeader.split(' ')[1];

  try {
    // 2. Verify Token and get user
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('token', token)
      .single();

    if (fetchError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!user.is_approved) {
      return res.status(403).json({ error: '管理者の承認待ちです。' });
    }

    // 3. Check expiration
    const now = new Date();
    const expiresAt = new Date(user.token_expires_at);
    if (now > expiresAt) {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }

    // 4. Extend token expiration (Sliding Window)
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);
    
    // We will update the expiration (and possibly data) below
    
    if (req.method === 'GET') {
      // PULL request
      const { error: updateError } = await supabase
        .from('users')
        .update({ token_expires_at: newExpiresAt.toISOString() })
        .eq('token', token);

      if (updateError) {
        console.error("Token extension error:", updateError);
      }

      return res.status(200).json({ 
        ...publicSyncResponse(user.data || {}),
        hide_ads: user.hide_ads || false
      });
      
    } else if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      let savedData = null;
      let savedVersion = null;

      // Merge against the latest row and compare-and-swap it. Replacing the
      // whole JSON column let a stale phone overwrite newer Mac data.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data: latest, error: latestError } = await supabase
          .from('users')
          .select('data,updated_at')
          .eq('token', token)
          .single();
        if (latestError || !latest) throw latestError || new Error('User row missing');

        const merged = mergeSyncData(latest.data || {}, body);
        const priorMillis = latest.updated_at ? new Date(latest.updated_at).getTime() : 0;
        const nextVersion = new Date(Math.max(Date.now(), priorMillis + 1)).toISOString();
        let update = supabase.from('users').update({
          data: merged,
          token_expires_at: newExpiresAt.toISOString(),
          updated_at: nextVersion
        }).eq('token', token);
        update = latest.updated_at ? update.eq('updated_at', latest.updated_at) : update.is('updated_at', null);
        const { data: updated, error: updateError } = await update.select('updated_at').maybeSingle();
        if (updateError) throw updateError;
        if (updated) {
          savedData = merged;
          savedVersion = updated.updated_at || nextVersion;
          break;
        }
      }

      if (!savedData) return res.status(409).json({ error: 'Sync changed on another device. Please retry.' });
      return res.status(200).json({ ...publicSyncResponse(savedData), updated_at: savedVersion, message: 'Data synced successfully' });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error("Sync error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function stringSet(value) {
  return new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);
}

function mergeSyncData(currentValue, incoming) {
  const current = currentValue && typeof currentValue === 'object' ? currentValue : {};
  const oldMeta = current._sync && typeof current._sync === 'object' ? current._sync : {};
  const meta = {
    deletedNames: stringSet(oldMeta.deletedNames),
    deletedURLs: stringSet(oldMeta.deletedURLs),
    deletedTestIDs: stringSet(oldMeta.deletedTestIDs)
  };
  const next = { ...current };
  const isModern = ['changedNames', 'changedURLs', 'changedTestIDs'].some(key => Array.isArray(incoming[key]));

  const mergeMap = (field, changedField, deleteField, tombstones) => {
    const oldMap = current[field] && typeof current[field] === 'object' ? current[field] : {};
    const incomingMap = incoming[field] && typeof incoming[field] === 'object' ? incoming[field] : {};
    const result = { ...oldMap };
    for (const key of stringSet(incoming[deleteField])) {
      delete result[key];
      tombstones.add(key);
    }
    if (isModern) {
      for (const key of stringSet(incoming[changedField])) {
        if (Object.prototype.hasOwnProperty.call(incomingMap, key)) {
          result[key] = incomingMap[key];
          tombstones.delete(key);
        }
      }
    } else {
      // Legacy clients cannot distinguish edits from stale cached values.
      for (const [key, value] of Object.entries(incomingMap)) {
        if (!Object.prototype.hasOwnProperty.call(result, key) && !tombstones.has(key)) result[key] = value;
      }
    }
    for (const key of tombstones) delete result[key];
    next[field] = result;
  };

  mergeMap('names', 'changedNames', 'deletedNames', meta.deletedNames);
  mergeMap('urls', 'changedURLs', 'deletedURLs', meta.deletedURLs);

  const oldTests = Array.isArray(current.tests) ? current.tests : [];
  const incomingTests = Array.isArray(incoming.tests) ? incoming.tests : [];
  const tests = new Map(oldTests.filter(test => test && typeof test.id === 'string').map(test => [test.id, test]));
  for (const id of stringSet(incoming.deletedTestIDs)) {
    tests.delete(id);
    meta.deletedTestIDs.add(id);
  }
  if (isModern) {
    const changed = stringSet(incoming.changedTestIDs);
    for (const test of incomingTests) {
      if (test && typeof test.id === 'string' && changed.has(test.id)) {
        tests.set(test.id, test);
        meta.deletedTestIDs.delete(test.id);
      }
    }
  } else {
    for (const test of incomingTests) {
      if (test && typeof test.id === 'string' && !tests.has(test.id) && !meta.deletedTestIDs.has(test.id)) tests.set(test.id, test);
    }
  }
  for (const id of meta.deletedTestIDs) tests.delete(id);
  next.tests = Array.from(tests.values());

  for (const field of ['theme', 'darkMode']) {
    if (Object.prototype.hasOwnProperty.call(incoming, field)) next[field] = incoming[field];
  }
  next._sync = {
    deletedNames: Array.from(meta.deletedNames),
    deletedURLs: Array.from(meta.deletedURLs),
    deletedTestIDs: Array.from(meta.deletedTestIDs)
  };
  return next;
}

function publicSyncResponse(data) {
  const cleanData = { ...(data || {}) };
  const meta = cleanData._sync && typeof cleanData._sync === 'object' ? cleanData._sync : {};
  delete cleanData._sync;
  return {
    data: cleanData,
    deletedNames: Array.isArray(meta.deletedNames) ? meta.deletedNames : [],
    deletedURLs: Array.isArray(meta.deletedURLs) ? meta.deletedURLs : [],
    deletedTestIDs: Array.isArray(meta.deletedTestIDs) ? meta.deletedTestIDs : []
  };
}
