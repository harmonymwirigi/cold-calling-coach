
// api/get-user-access-status.js - Get complete access status for user
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = req.method === 'GET' ? req.query.userId : req.body.userId;

    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'userId is required' 
      });
    }

    // Call the database function
    const { data, error } = await supabase
      .rpc('get_user_access_status', {
        p_user_id: userId
      });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        error: 'Database error',
        message: 'Failed to get user access status'
      });
    }

    if (!data.success) {
      return res.status(404).json({ 
        error: 'User not found',
        message: data.error || 'User not found'
      });
    }

    res.status(200).json(data);

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to get user access status'
    });
  }
}
