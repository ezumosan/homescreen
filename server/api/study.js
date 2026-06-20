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
    const { username, duration_seconds } = req.body;

    if (!username || !duration_seconds) {
      return res.status(400).json({ error: 'Missing username or duration_seconds' });
    }

    const { data, error } = await supabase
      .from('study_sessions')
      .insert([
        { username, duration_seconds }
      ]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, message: 'Study time saved' });
  }

  // GET: 週間ランキングの取得
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('weekly_ranking')
      .select('*')
      .order('total_seconds', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ranking: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
