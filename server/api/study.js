const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

module.exports = async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials not configured on the server.' });
  }

  // POST: 勉強時間の保存。updated_at の比較で古い端末からの再送を無視する。
  if (req.method === 'POST') {
    const { session_id, username, duration_seconds, is_active } = req.body;

    if (!session_id || !username || typeof duration_seconds !== 'number') {
      return res.status(400).json({ error: 'Missing session_id, username or duration_seconds' });
    }

    // チート対策: マイナス値や1セッションで18時間(64800秒)を超える値は拒否
    if (duration_seconds < 0 || duration_seconds > 64800) {
      return res.status(400).json({ error: 'Invalid duration value detected.' });
    }

    try {
      const result = await writeStudySession({
        id: session_id,
        username,
        durationSeconds: duration_seconds,
        isActive: is_active !== false,
        modifiedAt: parseTimestamp(req.body.modified_at) || Date.now(),
        createdAt: parseTimestamp(req.body.created_at)
      });
      return res.status(200).json({ success: true, applied: result.applied, message: 'Study time saved' });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to save study time' });
    }
  }

  // DELETE: 勉強時間の削除
  if (req.method === 'DELETE') {
    const { session_id, username } = req.body;
    if (!session_id || !username) {
      return res.status(400).json({ error: 'Missing session_id or username' });
    }
    try {
      const result = await writeStudySession({
        id: session_id,
        username,
        durationSeconds: 0,
        isActive: false,
        modifiedAt: parseTimestamp(req.body.modified_at) || Date.now()
      });
      return res.status(200).json({ success: true, applied: result.applied });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to delete study time' });
    }
  }

  // GET: ランキング または 履歴の取得
  if (req.method === 'GET') {
    const isHistory = req.query.history === 'true';
    
    if (isHistory) {
      // 履歴の取得
      const username = req.query.username;
      if (!username) {
        return res.status(400).json({ error: 'Missing username' });
      }
      try {
        const [history, deletedSessions] = await Promise.all([
          fetchStudyRows(username, true),
          fetchStudyRows(username, false)
        ]);
        return res.status(200).json({ history, deleted_sessions: deletedSessions });
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Failed to fetch study history' });
      }
    } else {
      // ランキングの取得
      const type = req.query.type || 'weekly';
      const now = new Date();
      let startDate = new Date(now);
      let maxSeconds = 0;

      if (type === 'monthly') {
        // 月間: 当月の1日から
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        // チート対策上限: 1日18時間 * 当月の日数
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        maxSeconds = 18 * 3600 * daysInMonth;
      } else {
        // 週間: 当週の月曜日から
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        maxSeconds = 18 * 3600 * 7;
      }

      // 期間内のセッションを全取得
      const { data, error } = await supabase
        .from('study_sessions')
        .select('username, duration_seconds')
        .eq('is_active', true)
        .gte('created_at', startDate.toISOString());

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // Node.js側で集計
      const userTotals = {};
      for (const session of data) {
        if (!userTotals[session.username]) {
          userTotals[session.username] = 0;
        }
        userTotals[session.username] += session.duration_seconds;
      }

      // チート対策フィルターと配列化
      const ranking = [];
      for (const [username, total_seconds] of Object.entries(userTotals)) {
        if (total_seconds >= 0 && total_seconds <= maxSeconds) {
          ranking.push({ username, total_seconds });
        }
      }

      // 降順ソート
      ranking.sort((a, b) => b.total_seconds - a.total_seconds);

      return res.status(200).json({ ranking });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 100000000000 ? value : value * 1000;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      const fraction = value.match(/\.(\d+)(?=Z|[+-]\d{2}:?\d{2}$)/i)?.[1];
      const subMillisecond = fraction && fraction.length > 3 ? Number(`0.${fraction.slice(3)}`) : 0;
      return parsed + subMillisecond;
    }
  }
  return null;
}

async function fetchStudyRows(username, isActive) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; offset < 100000; offset += pageSize) {
    let query = supabase
      .from('study_sessions')
      .select(isActive ? 'id, duration_seconds, created_at, updated_at' : 'id, updated_at')
      .eq('username', username)
      .eq('is_active', isActive);
    if (isActive) {
      query = query.order('created_at', { ascending: false }).order('id', { ascending: true });
    } else {
      query = query.order('updated_at', { ascending: false }).order('id', { ascending: true });
    }
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error('Study history exceeds the maximum sync size.');
}

async function writeStudySession({ id, username, durationSeconds, isActive, modifiedAt, createdAt }) {
  const updatedAt = new Date(modifiedAt).toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: current, error: readError } = await supabase
      .from('study_sessions')
      .select('id, updated_at, created_at, duration_seconds, is_active')
      .eq('id', id)
      .eq('username', username)
      .maybeSingle();
    if (readError) throw readError;

    if (current) {
      const currentTime = parseTimestamp(current.updated_at) || parseTimestamp(current.created_at) || 0;
      // Deletions win ties so an edit and delete created in the same clock
      // tick cannot resurrect a history row. All other ties keep the row.
      if (currentTime > modifiedAt) return { applied: false };
      if (currentTime === modifiedAt && (isActive || current.is_active === false)) return { applied: false };

      let update = supabase.from('study_sessions').update({
        duration_seconds: durationSeconds,
        is_active: isActive,
        updated_at: updatedAt
      }).eq('id', id).eq('username', username);
      update = current.updated_at ? update.eq('updated_at', current.updated_at) : update.is('updated_at', null);
      const { data: updated, error: updateError } = await update.select('id').maybeSingle();
      if (updateError) throw updateError;
      if (updated) return { applied: true };
      continue;
    }

    const row = {
      id,
      username,
      duration_seconds: durationSeconds,
      is_active: isActive,
      updated_at: updatedAt
    };
    if (createdAt) row.created_at = new Date(createdAt).toISOString();
    const { data: inserted, error: insertError } = await supabase.from('study_sessions').insert(row).select('id').maybeSingle();
    if (!insertError && inserted) return { applied: true };
    if (insertError && insertError.code !== '23505') throw insertError;
  }
  throw new Error('Study session changed on another device. Please retry.');
}
