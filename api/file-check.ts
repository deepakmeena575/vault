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

  res.status(200).json({
    serverSupabaseExists: !!supabase
  });
}
