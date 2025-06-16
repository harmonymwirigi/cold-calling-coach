


// api/unlock-module-temporarily.js - Temporarily unlock a module for a user
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, roleplayType, hours = 24 } = req.body;

    if (!userId || !roleplayType) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'userId and roleplayType are required' 
      });
    }

    // Calculate unlock expiry
    const unlockExpiry = new Date();
    unlockExpiry.setHours(unlockExpiry.getHours() + hours);

    // Update or create progress record
    const { data: progress, error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        roleplay_type: roleplayType,
        unlock_expiry: unlockExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        error: 'Database error',
        message: 'Failed to unlock module'
      });
    }

    res.status(200).json({ 
      success: true,
      progress: progress,
      unlockExpiry: unlockExpiry.toISOString(),
      message: `${roleplayType} unlocked for ${hours} hours`
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to unlock module'
    });
  }
}