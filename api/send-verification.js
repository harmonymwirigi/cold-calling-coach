// cold-calling-coach/api/send-verification.js
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const resend = new Resend(process.env.RESEND_API_KEY);
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
    const { email, firstName } = req.body;

    if (!email || !firstName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Email and firstName are required' 
      });
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in Supabase
    const { data: verification, error: verificationError } = await supabase
      .from('email_verifications')
      .insert([{
        email,
        first_name: firstName,
        verification_code: verificationCode,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        verified: false
      }])
      .select()
      .single();

    if (verificationError) {
      logger.error('Database error:', verificationError);
      return res.status(500).json({ 
        error: 'Database error',
        message: 'Failed to store verification code'
      });
    }

    // Send email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Verify Your Email - Cold Call Trainer</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0;">🎯 Cold Call Trainer</h1>
          </div>
          
          <h2>Welcome, ${firstName}! 👋</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; color: #667eea; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 10px; margin: 20px 0;">
            ${verificationCode}
          </div>
          <p><small>This code expires in 10 minutes.</small></p>
        </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: 'Cold Call Trainer <noreply@yourdomain.com>',
      to: [email],
      subject: `${verificationCode} - Verify your email for Cold Call Trainer`,
      html: emailHtml
    });

    if (emailError) {
      logger.error('Email error:', emailError);
      // Clean up verification record
      await supabase
        .from('email_verifications')
        .delete()
        .eq('id', verification.id);
        
      return res.status(500).json({ 
        error: 'Email delivery failed',
        message: 'Could not send verification email'
      });
    }

    res.status(200).json({ 
      success: true,
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    logger.error('Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to send verification email'
    });
  }
}