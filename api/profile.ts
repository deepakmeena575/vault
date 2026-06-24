import { supabase } from '../lib/supabase';

export default async function handler(req: any, res: any) {
  // CORS setup if needed, handled by Next/Vercel normally, but let's add basic headers just in case
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const { id, full_name, mobile_number, email, role } = req.body;
      
      if (!supabase) {
        console.warn("Supabase not configured on server. VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
        return res.status(500).json({ success: false, error: "Supabase not configured on server" });
      }

      const { data, error } = await supabase.from('profiles').insert([
        { id, full_name, mobile_number, email, role: role || 'user' }
      ]).select().single();

      if (error) {
        console.error("Profile creation error from backend:", error);
        return res.status(500).json({ success: false, error: error.message });
      }
      
      return res.status(200).json({ success: true, profile: data });
    } catch (error: any) {
      console.error("Profile error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const userId = req.query.id as string;
      
      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing user ID" });
      }

      if (!supabase) {
        return res.status(500).json({ success: false, error: "Supabase not configured on server" });
      }

      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (error) {
        return res.status(404).json({ success: false, error: "Profile not found" });
      }
      
      return res.status(200).json({ success: true, profile: data });
    } catch (error: any) {
      console.error("Profile get error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}
