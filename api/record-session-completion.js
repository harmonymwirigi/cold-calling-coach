
// api/record-session-completion.js - Record completed roleplay session
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
    const { 
      userId, 
      roleplayType, 
      mode, 
      passed, 
      score, 
      sessionData,
      sessionId,
      duration,
      metrics,
      evaluations
    } = req.body;

    if (!userId || !roleplayType || !mode || passed === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'userId, roleplayType, mode, and passed are required' 
      });
    }

    // Log the session first
    const { data: sessionLog, error: sessionError } = await supabase
      .from('session_logs')
      .insert({
        user_id: userId,
        session_id: sessionId,
        roleplay_type: roleplayType,
        mode: mode,
        score: score,
        passed: passed,
        duration_seconds: duration,
        metrics: metrics,
        evaluations: evaluations,
        session_data: sessionData,
        started_at: sessionData?.startTime || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        reason: 'completed'
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Session logging error:', sessionError);
      // Continue anyway - don't fail the whole request
    }

    // Record completion and handle unlocks using database function
    const { data, error } = await supabase
      .rpc('record_session_completion', {
        p_user_id: userId,
        p_roleplay_type: roleplayType,
        p_mode: mode,
        p_passed: passed,
        p_score: score,
        p_session_data: sessionData
      });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        error: 'Database error',
        message: 'Failed to record session completion'
      });
    }

    // Parse the unlocks from the function result
    const unlocks = data.unlocks ? JSON.parse(data.unlocks) : [];
    
    res.status(200).json({ 
      success: true,
      unlocks: unlocks,
      unlockExpiry: data.unlock_expiry,
      message: 'Session recorded successfully'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to record session completion'
    });
  }
}