// api/check-module-access.js - Check if user can access a specific roleplay module
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
    const { userId, roleplayType, mode = 'practice' } = req.body;

    if (!userId || !roleplayType) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'userId and roleplayType are required' 
      });
    }

    // Call the database function
    const { data, error } = await supabase
      .rpc('check_module_access', {
        p_user_id: userId,
        p_roleplay_type: roleplayType,
        p_mode: mode
      });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        error: 'Database error',
        message: 'Failed to check module access'
      });
    }

    // Get additional user info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('access_level, is_admin')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('User data error:', userError);
      return res.status(500).json({ 
        error: 'User data error',
        message: 'Failed to get user information'
      });
    }

    // Get progress data
    const { data: progressData, error: progressError } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('roleplay_type', roleplayType)
      .single();

    // Combine results
    const accessInfo = {
      ...data,
      accessLevel: userData.access_level,
      isAdmin: userData.is_admin,
      marathonPasses: progressData?.marathon_passes || 0,
      legendCompleted: progressData?.legend_completed || false,
      legendAttemptUsed: progressData?.legend_attempt_used !== false,
      unlockExpiry: progressData?.unlock_expiry
    };

    res.status(200).json({ 
      success: true,
      access: accessInfo
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to check module access'
    });
  }
}