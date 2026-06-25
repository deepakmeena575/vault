import { verifyAdmin, setSecurityHeaders } from '../authMiddleware.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    setSecurityHeaders(res);
    return res.status(200).end();
  }

  const auth = await verifyAdmin(req, res);
  if (!auth) {
    return; // Response already handled by verifyAdmin
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  res.json({
    hasUrl: !!supabaseUrl,
    urlValue: supabaseUrl ? supabaseUrl.substring(0, 15) + "..." : "none",
    hasServiceKey: !!supabaseServiceKey,
    serviceKeyLength: supabaseServiceKey ? supabaseServiceKey.length : 0,
    nodeEnv: process.env.NODE_ENV,
    isDummyKey: supabaseServiceKey === "dummy" || supabaseServiceKey.includes("YOUR_SERVICE_ROLE_KEY")
  });
}
