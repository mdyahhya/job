// Vercel Serverless Function: Password Authentication
// Validates entered password against the Vercel environment variable PASS.

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const serverPass = process.env.PASS ? String(process.env.PASS).trim() : '';

  // GET: Check status of authentication
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      isPassConfigured: Boolean(serverPass)
    });
  }

  // POST: Verify password or session token
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    body = body || {};

    const action = body.action || 'login';

    // Verify existing token
    if (action === 'verify') {
      const token = body.token;
      if (!token) {
        return res.status(401).json({ valid: false, error: 'No token provided' });
      }
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const [tokenPass, timestampStr] = decoded.split(':::');
        const timestamp = parseInt(timestampStr, 10);
        // Valid for 30 days
        const isFresh = Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000;

        if (serverPass) {
          if (tokenPass === serverPass && isFresh) {
            return res.status(200).json({ valid: true });
          }
        } else {
          // If serverPass is not yet set in Vercel, allow existing token if fresh
          if (isFresh) {
            return res.status(200).json({ valid: true, notice: 'PASS not configured in Vercel env' });
          }
        }
        return res.status(401).json({ valid: false, error: 'Session expired or invalid' });
      } catch (e) {
        return res.status(401).json({ valid: false, error: 'Invalid token format' });
      }
    }

    // Login action
    const submittedPass = body.pass !== undefined ? String(body.pass).trim() : '';

    if (!submittedPass) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    // If PASS is not configured in Vercel environment variables yet
    if (!serverPass) {
      // Allow 'dominal123' as initial fallback so user can log in before adding PASS to Vercel
      if (submittedPass === 'dominal123' || submittedPass === 'admin') {
        const token = Buffer.from(`fallback:::${Date.now()}`).toString('base64');
        return res.status(200).json({
          success: true,
          token: token,
          warning: 'PASS environment variable is not configured in Vercel yet. Using default fallback.'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. (Tip: Set PASS environment variable in Vercel settings, or use fallback: dominal123)'
      });
    }

    // Compare with process.env.PASS
    if (submittedPass === serverPass) {
      const token = Buffer.from(`${serverPass}:::${Date.now()}`).toString('base64');
      return res.status(200).json({
        success: true,
        token: token
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Access denied.'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
