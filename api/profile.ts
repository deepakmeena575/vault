import { supabase } from '../lib/server-supabase';

export default async function handler(req: any, res: any) {
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
    console.log("PROFILE_CREATE_START");
    try {
      const { id, full_name, mobile_number, email, role } = req.body;
      
      if (!supabase) {
        console.error("PROFILE_CREATE_ERROR: Supabase not configured on server.");
        return res.status(500).json({ success: false, error: "Supabase not configured on server" });
      }

      const { data, error } = await supabase.from('profiles').insert([
        { id, full_name, mobile_number, email, role: role || 'user' }
      ]).select().single();

      if (error) {
        console.error("PROFILE_CREATE_ERROR:", error);
        return res.status(500).json({ success: false, error: error.message });
      }
      
      console.log("PROFILE_CREATE_SUCCESS");
      return res.status(200).json({ success: true, profile: data });
    } catch (error: any) {
      console.error("PROFILE_CREATE_ERROR:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'GET') {
    console.log("PROFILE FETCH START");
    try {
      const userId = req.query.id as string;
      
      if (!userId) {
        console.error("PROFILE ERROR: Missing user ID");
        return res.status(400).json({ success: false, error: "Missing user ID" });
      }

      if (!supabase) {
        console.error("PROFILE ERROR: Supabase not configured on server.");
        return res.status(500).json({ success: false, error: "Supabase not configured on server" });
      }

      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (error) {
        console.error("PROFILE ERROR:", error);
        return res.status(404).json({ success: false, error: "Profile not found" });
      }
      
      console.log("PROFILE FETCH SUCCESS");
      return res.status(200).json({ success: true, profile: data });
    } catch (error: any) {
      console.error("PROFILE ERROR:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}
