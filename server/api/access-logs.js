const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

module.exports = async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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

    const username = user.username;

    if (req.method === 'POST') {
      // Batch insert access logs
      const logs = req.body.logs;
      if (!Array.isArray(logs) || logs.length === 0) {
        return res.status(400).json({ error: 'No logs provided' });
      }

      // Limit batch size to prevent abuse
      const batch = logs.slice(0, 500);

      const rowsToInsert = batch.map(log => ({
        username: username,
        url: log.url,
        domain: log.domain || '',
        title: log.title || null,
        visited_at: log.visited_at || new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('access_logs')
        .insert(rowsToInsert);

      if (insertError) {
        console.error("Insert access logs error:", insertError);
        return res.status(500).json({ error: 'Failed to insert access logs' });
      }

      return res.status(200).json({ message: `${rowsToInsert.length} logs saved` });

    } else if (req.method === 'GET') {
      // Fetch access logs with optional filters
      const { days, domain, limit: queryLimit } = req.query;
      const fetchLimit = Math.min(parseInt(queryLimit) || 200, 1000);

      let query = supabase
        .from('access_logs')
        .select('*')
        .eq('username', username)
        .order('visited_at', { ascending: false })
        .limit(fetchLimit);

      if (days) {
        const since = new Date();
        since.setDate(since.getDate() - parseInt(days));
        query = query.gte('visited_at', since.toISOString());
      }

      if (domain) {
        query = query.eq('domain', domain);
      }

      const { data: logs, error: getError } = await query;

      if (getError) {
        console.error("Fetch access logs error:", getError);
        return res.status(500).json({ error: 'Failed to fetch access logs' });
      }

      return res.status(200).json({ logs });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error("Access logs error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
