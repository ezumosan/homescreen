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

      return res.status(200).json({ data: user.data || {} });
      
    } else if (req.method === 'POST') {
      // PUSH request
      const syncData = req.body;
      
      const { error: updateError } = await supabase
        .from('users')
        .update({
          data: syncData,
          token_expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('token', token);

      if (updateError) {
        return res.status(500).json({ error: 'Failed to sync data' });
      }

      return res.status(200).json({ message: 'Data synced successfully' });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error("Sync error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
