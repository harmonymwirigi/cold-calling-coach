import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, email, firstName, ...data } = req.body;

    let emailData = {
      from: 'AI Cold Calling Coach <noreply@ai-cold-calling-coach.com>',
      to: email,
      subject: '',
      html: ''
    };

    switch (type) {
      case 'verification':
        emailData.subject = 'Verify your email address';
        emailData.html = getVerificationEmailTemplate(data.code, firstName);
        break;

      case 'welcome':
        emailData.subject = 'Welcome to AI Cold Calling Coach!';
        emailData.html = getWelcomeEmailTemplate(firstName, data.profileData);
        break;

      case 'progress_report':
        emailData.subject = 'Your weekly progress report is here! 📊';
        emailData.html = getProgressReportTemplate(firstName, data.progressData);
        break;

      case 'achievement':
        emailData.subject = `🏆 Congratulations! You've unlocked: ${data.achievement.title}`;
        emailData.html = getAchievementEmailTemplate(firstName, data.achievement);
        break;

      case 'practice_reminder':
        emailData.subject = 'Time to practice! Your cold calling skills are waiting 🎤';
        emailData.html = getPracticeReminderTemplate(firstName, data.reminderData);
        break;

      case 'upgrade':
        emailData.subject = 'Account upgraded successfully! 🚀';
        emailData.html = getUpgradeNotificationTemplate(firstName, data.upgradeInfo);
        break;

      default:
        return res.status(400).json({ error: 'Invalid email type' });
    }

    const result = await resend.emails.send(emailData);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('Error sending email:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Email Templates
const getEmailWrapper = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Cold Calling Coach</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
        }
        .container { 
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 { 
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p { 
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .content { 
            padding: 40px 30px;
        }
        .button { 
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }
        .button:hover { 
            background: #5a67d8;
        }
        .footer { 
            background: #f8fafc;
            padding: 30px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
        <div class="footer">
            <p><strong>AI Cold Calling Coach</strong></p>
            <p>Master English sales calls with AI-powered roleplay training</p>
        </div>
    </div>
</body>
</html>
`;

const getVerificationEmailTemplate = (code, firstName) => getEmailWrapper(`
    <div class="header">
        <h1>🎯 AI Cold Calling Coach</h1>
        <p>Verify your email to start practicing</p>
    </div>
    <div class="content">
        <h2>Hi ${firstName || 'there'}! 👋</h2>
        <p>Welcome to AI Cold Calling Coach! We're excited to help you master English sales calls.</p>
        
        <p>Your verification code is:</p>
        
        <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
            <span style="font-size: 48px; font-weight: bold; color: #1e40af; letter-spacing: 8px;">${code}</span>
        </div>
        
        <p>This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
    </div>
`);

const getWelcomeEmailTemplate = (firstName, userProfile) => getEmailWrapper(`
    <div class="header">
        <h1>🎉 Welcome to the Team!</h1>
        <p>Your AI cold calling coach is ready</p>
    </div>
    <div class="content">
        <h2>Hi ${firstName}!</h2>
        <p>Congratulations! Your account is now active and your personalized AI coach is configured for:</p>
        
        <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>🎯 Target Prospect:</strong> ${userProfile.prospect_job_title}</p>
            <p><strong>🏢 Industry:</strong> ${userProfile.prospect_industry}</p>
            ${userProfile.custom_behavior_notes ? `<p><strong>💡 Custom Notes:</strong> ${userProfile.custom_behavior_notes}</p>` : ''}
        </div>
        
        <p>Your AI coach will simulate realistic prospects based on these settings. Ready to start?</p>
    </div>
`);

const getProgressReportTemplate = (firstName, progressData) => getEmailWrapper(`
    <div class="header">
        <h1>📊 Your Weekly Progress</h1>
        <p>See how you're improving!</p>
    </div>
    <div class="content">
        <h2>Hi ${firstName}!</h2>
        <p>Here's your weekly training summary. You've been putting in great work! 🌟</p>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 20px; margin: 30px 0;">
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: 700; color: #667eea; margin-bottom: 5px;">${progressData.sessionsThisWeek}</div>
                <div style="font-size: 14px; color: #64748b;">Sessions</div>
            </div>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: 700; color: #667eea; margin-bottom: 5px;">${progressData.hoursThisWeek}h</div>
                <div style="font-size: 14px; color: #64748b;">Practice Time</div>
            </div>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: 700; color: #667eea; margin-bottom: 5px;">${progressData.averageScore}/4</div>
                <div style="font-size: 14px; color: #64748b;">Avg Score</div>
            </div>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: 700; color: #667eea; margin-bottom: 5px;">${progressData.passRate}%</div>
                <div style="font-size: 14px; color: #64748b;">Pass Rate</div>
            </div>
        </div>
    </div>
`);

const getAchievementEmailTemplate = (firstName, achievement) => getEmailWrapper(`
    <div class="header">
        <h1>🏆 Achievement Unlocked!</h1>
        <p>You're making incredible progress</p>
    </div>
    <div class="content">
        <h2>Congratulations, ${firstName}!</h2>
        
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <div style="font-size: 64px; margin-bottom: 10px;">${achievement.emoji}</div>
            <h3 style="margin: 0; font-size: 24px;">${achievement.title}</h3>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${achievement.description}</p>
        </div>
    </div>
`);

const getPracticeReminderTemplate = (firstName, reminderData) => getEmailWrapper(`
    <div class="header">
        <h1>🎤 Time to Practice!</h1>
        <p>Your skills are waiting for you</p>
    </div>
    <div class="content">
        <h2>Hi ${firstName}!</h2>
        <p>It's been ${reminderData.daysSinceLastPractice} days since your last practice session. Ready to get back into it?</p>
        
        ${reminderData.streakAtRisk ? `
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0;">
            <h3 style="color: #dc2626; margin-top: 0;">⚠️ Streak at Risk!</h3>
            <p style="color: #dc2626;">Your ${reminderData.currentStreak}-day practice streak is about to break. Practice today to keep it alive!</p>
        </div>
        ` : ''}
    </div>
`);

const getUpgradeNotificationTemplate = (firstName, upgradeInfo) => getEmailWrapper(`
    <div class="header">
        <h1>🚀 Welcome to ${upgradeInfo.newPlan}!</h1>
        <p>Your account has been upgraded</p>
    </div>
    <div class="content">
        <h2>Hi ${firstName}!</h2>
        <p>Great news! Your account has been successfully upgraded to <strong>${upgradeInfo.newPlan}</strong>.</p>
        
        <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #166534;">✨ Your New Benefits</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
                ${upgradeInfo.benefits.map(benefit => `<li style="color: #166534; margin: 8px 0;">${benefit}</li>`).join('')}
            </ul>
        </div>
    </div>
`); 