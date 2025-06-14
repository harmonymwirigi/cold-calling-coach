// server/index.js - Debug Version with Better Error Logging

const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create a simple logger for server-side
const logger = {
  log: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => console.info(...args)
};

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase client with detailed logging
logger.log('🔍 Environment Check:');
logger.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
logger.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
logger.log('- RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

// Test database connection endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    logger.log('🧪 Testing database connection...');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('email_verifications')
      .select('count(*)')
      .limit(1);

    if (error) {
      logger.error('❌ Database test failed:', error);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: error.message,
        code: error.code,
        hint: error.hint
      });
    }

    logger.log('✅ Database connection successful');
    res.json({ 
      success: true, 
      message: 'Database connection working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Database test error:', error);
    res.status(500).json({ 
      error: 'Database test failed',
      message: error.message 
    });
  }
});

// Send verification email endpoint with detailed debugging
app.post('/api/send-verification', async (req, res) => {
  logger.log('\n🚀 === VERIFICATION REQUEST START ===');
  logger.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { email, firstName } = req.body;

    // Validate required fields
    if (!email || !firstName) {
      logger.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Email and firstName are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logger.log('❌ Validation failed: Invalid email format');
      return res.status(400).json({ 
        error: 'Invalid email format',
        message: 'Please provide a valid email address' 
      });
    }

    logger.log(`✅ Validation passed for: ${email}`);

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    logger.log(`🔢 Generated verification code: ${verificationCode}`);
    logger.log(`⏰ Expires at: ${expiresAt.toISOString()}`);

    // Check for existing unverified verification
    logger.log('🔍 Checking for existing verifications...');
    const { data: existingVerification, error: findError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('verified', false)
      .single();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows found (which is OK)
      logger.error('❌ Error checking existing verifications:', findError);
      return res.status(500).json({ 
        error: 'Database query failed',
        message: 'Failed to check existing verifications',
        details: findError.message
      });
    }

    // Clean up any existing unverified verification for this email
    if (existingVerification) {
      logger.log('🧹 Cleaning up existing unverified verification...');
      const { error: deleteError } = await supabase
        .from('email_verifications')
        .delete()
        .eq('email', email)
        .eq('verified', false);

      if (deleteError) {
        logger.error('❌ Error deleting existing verification:', deleteError);
        return res.status(500).json({ 
          error: 'Database cleanup failed',
          message: 'Failed to clean up existing verifications',
          details: deleteError.message
        });
      }
      logger.log('✅ Existing verification cleaned up');
    } else {
      logger.log('✅ No existing unverified verifications found');
    }

    // Store verification code in Supabase
    logger.log('💾 Storing new verification code...');
    const insertData = {
      email,
      first_name: firstName,
      verification_code: verificationCode,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      verified: false
    };
    
    logger.log('📊 Insert data:', JSON.stringify(insertData, null, 2));

    const { data: verification, error: verificationError } = await supabase
      .from('email_verifications')
      .insert([insertData])
      .select()
      .single();

    if (verificationError) {
      logger.error('❌ Database insert error:', {
        message: verificationError.message,
        details: verificationError.details,
        hint: verificationError.hint,
        code: verificationError.code
      });
      
      return res.status(500).json({ 
        error: 'Database error',
        message: 'Failed to store verification code',
        details: verificationError.message,
        code: verificationError.code,
        hint: verificationError.hint
      });
    }

    logger.log('✅ Verification code stored successfully:', verification.id);

    // Send verification email using Resend
    logger.log('📧 Sending verification email...');
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - Cold Call Trainer</title>
        </head>
        <body style="font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎯 Cold Call Trainer</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">AI-Powered English Cold Calling Coach</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
            <h2 style="color: #333; margin-top: 0;">Welcome, ${firstName}! 👋</h2>
            <p style="font-size: 16px; margin-bottom: 25px;">You're one step away from mastering your cold calling skills in English. Please verify your email address to get started.</p>
            
            <div style="background: white; border: 2px solid #667eea; border-radius: 10px; padding: 25px; text-align: center; margin: 25px 0;">
              <p style="margin: 0 0 15px 0; font-size: 16px; color: #666;">Your verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; margin: 15px 0;">${verificationCode}</div>
              <p style="margin: 15px 0 0 0; font-size: 14px; color: #999;">This code expires in 10 minutes</p>
            </div>
          </div>
          
          <div style="background: #e8f4fd; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
            <h3 style="color: #0366d6; margin-top: 0;">🚀 What's Next?</h3>
            <ul style="margin: 15px 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Practice with AI roleplay partners</li>
              <li style="margin-bottom: 8px;">Master objection handling techniques</li>
              <li style="margin-bottom: 8px;">Perfect your English pronunciation</li>
              <li style="margin-bottom: 8px;">Track your progress across modules</li>
            </ul>
          </div>
          
          <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            <p>Didn't request this email? You can safely ignore it.</p>
            <p style="margin-top: 15px;">
              <strong>Cold Call Trainer</strong><br>
              Helping sales professionals master English cold calling
            </p>
          </div>
        </body>
      </html>
    `;

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'Cold Call Trainer <noreply@hpique.nl>',
      to: [email],
      subject: `${verificationCode} - Verify your email for Cold Call Trainer`,
      html: emailHtml,
      text: `Welcome to Cold Call Trainer, ${firstName}! Your verification code is: ${verificationCode}. This code expires in 10 minutes.`
    });

    if (emailError) {
      logger.error('❌ Resend email error:', emailError);
      // Clean up the verification record if email fails
      await supabase
        .from('email_verifications')
        .delete()
        .eq('id', verification.id);
        
      return res.status(500).json({ 
        error: 'Email delivery failed',
        message: 'Could not send verification email. Please try again.',
        details: emailError.message
      });
    }

    logger.log('✅ Verification email sent successfully:', emailResult?.id);
    logger.log('🎉 === VERIFICATION REQUEST COMPLETE ===\n');

    res.status(200).json({ 
      success: true,
      message: 'Verification email sent successfully',
      expiresAt: expiresAt.toISOString(),
      verificationId: verification.id
    });

  } catch (error) {
    logger.error('💥 Unexpected error in send-verification:', error);
    logger.log('🔍 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to send verification email. Please try again.',
      details: error.message
    });
  }
});

// Verify email endpoint with debugging
app.post('/api/verify-email', async (req, res) => {
  logger.log('\n🔐 === EMAIL VERIFICATION START ===');
  logger.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      logger.log('❌ Validation failed: Missing email or code');
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and verification code are required'
      });
    }

    logger.log(`🔍 Looking for verification: ${email} with code: ${code}`);

    // Find the verification record
    const { data, error } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('verification_code', code)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error('❌ Database query error:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to verify code',
        details: error.message
      });
    }

    logger.log(`📊 Found ${data.length} matching verification(s)`);

    if (!data.length) {
      logger.log('❌ No matching verification found');
      return res.status(400).json({
        error: 'Invalid verification code',
        message: 'The verification code is incorrect or has already been used'
      });
    }

    const verification = data[0];
    logger.log('✅ Found verification:', verification.id);

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(verification.expires_at);
    logger.log(`⏰ Current time: ${now.toISOString()}`);
    logger.log(`⏰ Expires at: ${expiresAt.toISOString()}`);
    
    if (now > expiresAt) {
      logger.log('❌ Verification code has expired');
      return res.status(400).json({
        error: 'Code expired',
        message: 'The verification code has expired. Please request a new one.'
      });
    }

    logger.log('✅ Code is still valid');

    // Mark as verified
    const { error: updateError } = await supabase
      .from('email_verifications')
      .update({ 
        verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', verification.id);

    if (updateError) {
      logger.error('❌ Update error:', updateError);
      return res.status(500).json({
        error: 'Verification failed',
        message: 'Failed to verify email',
        details: updateError.message
      });
    }

    logger.log('✅ Email verified successfully');
    logger.log('🎉 === EMAIL VERIFICATION COMPLETE ===\n');

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    logger.error('💥 Unexpected error in verify-email:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify email',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.log(`\n🚀 Email API server running on port ${PORT}`);
  logger.log(`📧 Resend API: ${process.env.RESEND_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  logger.log(`🗄️  Supabase URL: ${process.env.SUPABASE_URL ? '✅ Configured' : '❌ Missing'}`);
  logger.log(`🔑 Service Role Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configured' : '❌ Missing'}`);
  logger.log(`\n🧪 Test endpoints:`);
  logger.log(`   Health: http://localhost:${PORT}/health`);
  logger.log(`   DB Test: http://localhost:${PORT}/api/test-db`);
  logger.log(`\n🎯 Ready to receive verification requests!\n`);

});