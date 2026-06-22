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

  // POST: 勉強時間の保存
  if (req.method === 'POST') {
    const { session_id, username, duration_seconds, is_active } = req.body;

    if (!session_id || !username || typeof duration_seconds !== 'number') {
      return res.status(400).json({ error: 'Missing session_id, username or duration_seconds' });
    }

    // チート対策: マイナス値や1セッションで18時間(64800秒)を超える値は拒否
    if (duration_seconds < 0 || duration_seconds > 64800) {
      return res.status(400).json({ error: 'Invalid duration value detected.' });
    }

    const isActiveFlag = is_active !== undefined ? is_active : true;

    const { data, error } = await supabase
      .from('study_sessions')
      .upsert([
        { id: session_id, username, duration_seconds, is_active: isActiveFlag }
      ]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, message: 'Study time saved' });
  }

  // DELETE: 勉強時間の削除
  if (req.method === 'DELETE') {
    const { session_id, username } = req.body;
    if (!session_id || !username) {
      return res.status(400).json({ error: 'Missing session_id or username' });
    }
    const { error } = await supabase
      .from('study_sessions')
      .delete()
      .match({ id: session_id, username: username });
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
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
      const { data, error } = await supabase
        .from('study_sessions')
        .select('id, duration_seconds, created_at')
        .eq('username', username)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ history: data });
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
