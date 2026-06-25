import { supabase } from '../lib/server-supabase.js';
import { verifyAdmin, setSecurityHeaders } from './authMiddleware.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    setSecurityHeaders(res);
    return res.status(200).end();
  }

  const auth = await verifyAdmin(req, res);
  if (!auth) {
    return; // Response already handled by verifyAdmin
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    return res.status(200).json({
      success: !error,
      error: error?.message || null,
      data
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      runtimeError: String(e),
      stack: e?.stack || null
    });
  }
}
