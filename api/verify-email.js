// cold-calling-coach/api/verify-email.js
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
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and verification code are required'
      });
    }

    // Find verification record
    const { data, error } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('verification_code', code)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error('Database query error:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to verify code'
      });
    }

    if (!data.length) {
      return res.status(400).json({
        error: 'Invalid verification code',
        message: 'The verification code is incorrect or has already been used'
      });
    }

    const verification = data[0];

    // Check if expired
    if (new Date() > new Date(verification.expires_at)) {
      return res.status(400).json({
        error: 'Code expired',
        message: 'The verification code has expired'
      });
    }

    // Mark as verified
    const { error: updateError } = await supabase
      .from('email_verifications')
      .update({ 
        verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', verification.id);

    if (updateError) {
      logger.error('Update error:', updateError);
      return res.status(500).json({
        error: 'Verification failed',
        message: 'Failed to verify email'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    logger.error('Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify email'
    });
  }
}