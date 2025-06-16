
// api/set-user-access-level.js - Admin function to change user access level
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
    const { adminUserId, targetUserId, newAccessLevel } = req.body;

    if (!adminUserId || !targetUserId || !newAccessLevel) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'adminUserId, targetUserId, and newAccessLevel are required' 
      });
    }

    // Validate access level
    const validLevels = ['unlimited', 'trial', 'limited'];
    if (!validLevels.includes(newAccessLevel)) {
      return res.status(400).json({ 
        error: 'Invalid access level',
        message: 'Access level must be unlimited, trial, or limited'
      });
    }

    // Call the database function
    const { data, error } = await supabase
      .rpc('set_user_access_level', {
        p_admin_user_id: adminUserId,
        p_target_user_id: targetUserId,
        p_new_access_level: newAccessLevel
      });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        error: 'Database error',
        message: 'Failed to update access level'
      });
    }

    if (!data.success) {
      return res.status(403).json({ 
        error: 'Permission denied',
        message: data.error || 'Admin privileges required'
      });
    }

    res.status(200).json({ 
      success: true,
      message: `Access level updated to ${newAccessLevel}`
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to update access level'
    });
  }
}
