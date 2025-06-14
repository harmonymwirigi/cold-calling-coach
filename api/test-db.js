const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { data, error } = await supabase
      .from('email_verifications')
      .select('count(*)')
      .limit(1);

    if (error) {
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: error.message
      });
    }

    res.json({ 
      success: true, 
      message: 'Database connection working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Database test failed',
      message: error.message 
    });
  }
}