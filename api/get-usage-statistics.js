
// api/get-usage-statistics.js - Get system usage statistics (admin only)
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const adminUserId = req.query.adminUserId;

    if (!adminUserId) {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'adminUserId is required' 
      });
    }

    // Check if user is admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', adminUserId)
      .single();

    if (adminError || !adminUser?.is_admin) {
      return res.status(403).json({ 
        error: 'Permission denied',
        message: 'Admin privileges required'
      });
    }

    // Get statistics from the view
    const { data: stats, error: statsError } = await supabase
      .from('admin_dashboard_stats')
      .select('*')
      .single();

    if (statsError) {
      console.error('Stats error:', statsError);
      return res.status(500).json({ 
        error: 'Database error',
        message: 'Failed to get usage statistics'
      });
    }

    // Calculate additional metrics
    const conversionRate = stats.total_users > 0 ? 
      Math.round((stats.unlimited_users / stats.total_users) * 100) : 0;

    const responseData = {
      success: true,
      stats: {
        totalUsers: stats.total_users,
        activeUsers: stats.active_users_30d,
        accessLevelDistribution: {
          unlimited: stats.unlimited_users,
          trial: stats.trial_users,
          limited: stats.limited_users
        },
        conversionRate,
        dailySessions: stats.daily_sessions,
        weeklySessions: stats.weekly_sessions
      }
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to get usage statistics'
    });
  }
}