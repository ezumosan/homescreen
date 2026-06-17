const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

module.exports = async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials not configured on the server.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // 1. Check if user exists
    let { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means zero rows found
      return res.status(500).json({ error: 'Database error fetching user' });
    }

    let token = crypto.randomBytes(32).toString('hex');
    let expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 1 week from now

    if (!user) {
      // 2. User does not exist, Register new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          username: username,
          password: password, // Store plaintext as requested
          token: token,
          token_expires_at: expiresAt.toISOString(),
          data: {}, // empty JSON
          is_approved: false
        }])
        .select()
        .single();

      if (insertError) {
        return res.status(500).json({ error: 'Failed to create user', details: insertError });
      }

      return res.status(202).json({ message: '登録申請が完了しました。管理者の承認をお待ちください。', pending: true });

    } else {
      // 3. User exists, Verify password
      const isMatch = (password === user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'ユーザー名またはパスワードが間違っています。' });
      }

      if (!user.is_approved) {
        return res.status(403).json({ error: '管理者の承認待ちです。', pending: true });
      }

      // Update token
      const { error: updateError } = await supabase
        .from('users')
        .update({
          token: token,
          token_expires_at: expiresAt.toISOString()
        })
        .eq('username', username);

      if (updateError) {
        return res.status(500).json({ error: 'Failed to update token' });
      }

      return res.status(200).json({ message: 'Login successful', token: token });
    }
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
