# 🚀 Complete Startup Guide - Cold Calling Coach

## 📋 Quick Checklist

Before starting, ensure you have:
- [ ] Node.js 16+ installed
- [ ] OpenAI API key with GPT-4 access
- [ ] AWS account with Polly access
- [ ] Supabase project created
- [ ] Resend account for emails
- [ ] HTTPS setup (required for voice)

## 🔧 Step-by-Step Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd cold-calling-coach

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Setup Environment Variables

Create `.env` in the root directory:
```bash
# OpenAI Configuration
REACT_APP_OPENAI_API_KEY=sk-your-openai-api-key-here

# AWS Configuration (for Polly Text-to-Speech)
REACT_APP_AWS_ACCESS_KEY_ID=your-aws-access-key-id
REACT_APP_AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
REACT_APP_AWS_REGION=us-east-1

# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key

# API Configuration
REACT_APP_API_URL=http://localhost:3001
```

Create `server/.env`:
```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Email Configuration
RESEND_API_KEY=re_your-resend-api-key

# Supabase Configuration (Service Role Key)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 3. Setup Supabase Database

Go to your Supabase project and run this SQL in the SQL Editor:

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  prospect_job_title TEXT DEFAULT 'CEO',
  prospect_industry TEXT DEFAULT 'Technology',
  custom_behavior_notes TEXT,
  access_level TEXT DEFAULT 'TRIAL' CHECK (access_level IN ('TRIAL', 'UNLIMITED', 'LIMITED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email verifications table
CREATE TABLE email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progress tracking table
CREATE TABLE user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  roleplay_type TEXT NOT NULL,
  total_attempts INTEGER DEFAULT 0,
  total_passes INTEGER DEFAULT 0,
  marathon_passes INTEGER DEFAULT 0,
  legend_completed BOOLEAN DEFAULT FALSE,
  legend_attempt_used BOOLEAN DEFAULT TRUE,
  unlock_expiry TIMESTAMP WITH TIME ZONE,
  last_completed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, roleplay_type)
);

-- Session logs table
CREATE TABLE session_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  roleplay_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  duration INTEGER,
  passed BOOLEAN,
  score DECIMAL(3,2),
  evaluation JSONB,
  conversation_history JSONB,
  coaching JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own progress" ON user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own progress" ON user_progress FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sessions" ON session_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON session_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Email verifications are managed by service role
CREATE POLICY "Service role can manage email verifications" ON email_verifications FOR ALL USING (true);
```

### 4. Configure Authentication in Supabase

1. Go to Authentication > Settings
2. Enable email confirmations if desired
3. Add your domain to redirect URLs
4. Configure email templates if needed

### 5. Setup HTTPS for Voice Features

Voice features require HTTPS. Choose one option:

**Option A: Using ngrok (Recommended for development)**
```bash
# Install ngrok
npm install -g ngrok

# Start your app first
npm start

# In another terminal, expose with HTTPS
ngrok http 3000

# Use the https URL ngrok provides
```

**Option B: Local SSL certificates**
```bash
# Add to package.json start script:
"start": "HTTPS=true react-scripts start"
```

### 6. Start the Application

```bash
# Terminal 1: Start the backend
cd server
npm run dev

# Terminal 2: Start the frontend
cd ..
npm start

# If using ngrok, start it in Terminal 3
ngrok http 3000
```

## 🧪 Testing the Setup

### 1. Test Backend Health
```bash
curl http://localhost:3001/health
# Should return: {"status":"OK","timestamp":"..."}

curl http://localhost:3001/api/test-db
# Should return: {"success":true,"message":"Database connection working"}
```

### 2. Test Frontend APIs
Open browser console and run:
```javascript
// Check environment variables
console.log('OpenAI:', !!process.env.REACT_APP_OPENAI_API_KEY);
console.log('AWS:', !!process.env.REACT_APP_AWS_ACCESS_KEY_ID);
console.log('Supabase:', !!process.env.REACT_APP_SUPABASE_URL);
```

### 3. Test Voice Service
Go to your app and try:
```javascript
// Open browser console
import { voiceService } from './services/voiceService';

// Test initialization
voiceService.initialize()
  .then(() => console.log('✅ Voice service ready'))
  .catch(err => console.error('❌ Voice failed:', err));
```

## 🎯 Using the Roleplay System

### 1. Register and Login
- Go to `/register`
- Enter email and name
- Verify email with the code sent
- Complete profile setup

### 2. Access Dashboard
- View available training modules
- Check your progress
- See which modules are unlocked

### 3. Start a Roleplay
- Click "Practice Mode" on any unlocked module
- Grant microphone permission when prompted
- Wait for the call to connect
- Follow the conversation flow

### 4. Roleplay Flow (Opener Practice Example)

1. **Call Connects**: AI says "Hello?"
2. **Your Opener**: Give your cold call opener
3. **AI Evaluation**: AI evaluates and responds with objection
4. **Handle Objection**: Respond to the objection naturally
5. **Mini Pitch**: Give a short pitch when prompted
6. **Call Ends**: AI ends call and shows results

### 5. Understanding the Evaluation

The system evaluates based on exact rubrics:

**Opener Evaluation (3 of 4 required):**
- Clear cold call opener
- Casual, confident tone
- Demonstrates empathy
- Ends with soft question

**Objection Handling (3 of 4 required):**
- Acknowledges calmly
- Doesn't argue or pitch
- Reframes in 1 sentence
- Ends with forward-moving question

## 🔧 Troubleshooting

### "Nothing talks" - Voice Issues

1. **Check HTTPS**: Voice requires HTTPS
2. **Grant Permissions**: Allow microphone access
3. **Check Console**: Look for errors in browser console
4. **Test AWS**: Verify AWS Polly credentials
5. **Fallback Test**: Disable AWS to test browser synthesis

### OpenAI Errors

1. **Check API Key**: Ensure it's valid and has credits
2. **GPT-4 Access**: Verify you have GPT-4 access
3. **Rate Limits**: Check if you're hitting rate limits
4. **Billing**: Ensure billing is enabled

### Database Errors

1. **Check Supabase**: Verify project is running
2. **RLS Policies**: Ensure policies are set correctly
3. **Service Key**: Check service role key for backend

### Common Browser Issues

1. **Microphone Blocked**: Check site permissions
2. **HTTPS Required**: Use https:// URL
3. **Browser Support**: Use Chrome, Firefox, or Safari
4. **Console Errors**: Check for JavaScript errors

## 📱 Mobile Testing

For mobile development:
```bash
# Get your local IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Use ngrok with your local IP
ngrok http https://your-local-ip:3000
```

## 🔒 Security Checklist

- [ ] All API keys in environment variables
- [ ] No sensitive data in git repository
- [ ] HTTPS enabled for production
- [ ] RLS policies configured in Supabase
- [ ] Email verification enabled
- [ ] Rate limiting implemented

## 📊 Monitoring and Logs

Check these for debugging:
- Browser console for frontend errors
- Server logs for backend errors
- Supabase logs for database issues
- Network tab for API call failures

## 🚀 Production Deployment

### Environment Variables for Production:
```bash
# Update these for production
REACT_APP_API_URL=https://your-api-domain.com
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
# ... other production URLs
```

### Build and Deploy:
```bash
# Build frontend
npm run build

# Deploy backend
cd server
npm install --production
npm start
```

## 💡 Tips for Success

1. **Start Simple**: Test each component individually
2. **Check Permissions**: Voice requires microphone access
3. **Use HTTPS**: Required for voice features
4. **Monitor Console**: Watch for errors during development
5. **Test Incrementally**: Test each API integration separately

## 📞 Getting Help

If you encounter issues:

1. **Check this guide first**
2. **Look at browser console errors**
3. **Verify all environment variables are set**
4. **Test individual services (OpenAI, AWS, Supabase)**
5. **Check API quotas and limits**
6. **Ensure all dependencies are installed**

Remember: The system requires multiple APIs to work together. Test each service individually before testing the full roleplay flow.

## 🎯 Success Indicators

You'll know everything is working when:
- ✅ Registration and email verification work
- ✅ Login redirects to dashboard
- ✅ Voice service initializes without errors
- ✅ Roleplay starts and AI speaks "Hello?"
- ✅ Microphone captures your speech
- ✅ AI responds to your opener with an objection
- ✅ Conversation flows naturally through stages
- ✅ Call ends with evaluation and coaching

The roleplay system is sophisticated and follows the detailed instructions provided. Each component has been designed to work together seamlessly when properly configured.