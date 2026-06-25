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
      .insert([
        {
          id: crypto.randomUUID(),
          full_name: 'test',
          email: 'test@test.com',
          mobile_number: '1234567890',
          role: 'user'
        }
      ])
      .select();

    return res.status(200).json({
      success: !error,
      error: error?.message || null,
      data
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: String(e),
      stack: e?.stack || null
    });
  }
}
