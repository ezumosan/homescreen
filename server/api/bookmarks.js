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
    
    const username = user.username;

    if (req.method === 'GET') {
      // Fetch bookmarks
      const { data: bookmarks, error: getError } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('username', username)
        .order('sort_order', { ascending: true });

      if (getError) {
        console.error("Fetch bookmarks error:", getError);
        return res.status(500).json({ error: 'Failed to fetch bookmarks' });
      }

      // Map back to expected client structure
      const formattedBookmarks = bookmarks.map(b => ({
        id: b.id,
        title: b.title,
        url: b.url
      }));

      return res.status(200).json({ bookmarks: formattedBookmarks });
      
    } else if (req.method === 'POST') {
      // Replace bookmarks
      const newBookmarks = req.body.bookmarks || [];
      
      // We do this in a single operation if possible, or delete then insert.
      // 1. Delete all existing for user
      const { error: deleteError } = await supabase
        .from('bookmarks')
        .delete()
        .eq('username', username);

      if (deleteError) {
        console.error("Delete bookmarks error:", deleteError);
        return res.status(500).json({ error: 'Failed to update bookmarks (delete phase)' });
      }

      // 2. Insert new ones
      if (newBookmarks.length > 0) {
        const rowsToInsert = newBookmarks.map((b, index) => ({
          id: b.id,
          username: username,
          title: b.title,
          url: b.url,
          sort_order: index
        }));

        const { error: insertError } = await supabase
          .from('bookmarks')
          .insert(rowsToInsert);

        if (insertError) {
          console.error("Insert bookmarks error:", insertError);
          return res.status(500).json({ error: 'Failed to update bookmarks (insert phase)' });
        }
      }

      return res.status(200).json({ message: 'Bookmarks synced successfully' });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error("Bookmarks sync error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
