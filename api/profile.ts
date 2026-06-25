import { supabase } from '../lib/server-supabase.js';
import { verifyAuth, setSecurityHeaders } from './authMiddleware.js';

export default async function handler(req: any, res: any) {
  // Let verifyAuth handle standard requests, but still allow CORS preflight (handled by verifyAuth)
  if (req.method === 'OPTIONS') {
    setSecurityHeaders(res);
    return res.status(200).end();
  }

  const auth = await verifyAuth(req, res);
  if (!auth) {
    return; // Response already handled by verifyAuth
  }

  if (req.method === 'POST') {
    console.log("PROFILE_CREATE_START");
    console.log("REQUEST_BODY", req.body);
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {}
      }
      const { id, full_name, mobile_number, email, role } = body;
      
      console.log("PROFILE_USER_ID", id);
      
      // Safety check: only the authenticated user can create/modify their own profile
      // (or an admin can create/modify any profile)
      if (id !== auth.user.id && auth.profile?.role !== 'admin') {
        return res.status(403).json({ success: false, error: "Forbidden: Cannot create profile for another user" });
      }

      if (!supabase) {
        console.error("PROFILE_CREATE_ERROR: Supabase not configured on server.");
        return res.status(500).json({ success: false, error: "Supabase not configured on server" });
      }

      const { data: authUser } = await supabase.auth.admin.getUserById(id);
      console.log("AUTH_USER_EXISTS", !!authUser?.user);

      if (!authUser?.user) {
        return res.status(400).json({ success: false, error: "Auth user not found" });
      }

      // Enforce: Always create new profiles with role = 'user'
      // Only an authenticated administrator may set/change role to something else
      const assignedRole = auth.profile?.role === 'admin' ? (role || 'user') : 'user';

      console.log("Attempting to insert profile for ID:", id);
      const { data, error } = await supabase.from('profiles').insert([
        { id, full_name, mobile_number, email, role: assignedRole }
      ]).select().single();

      if (error) {
        console.error("PROFILE_CREATE_ERROR (Supabase error):", error);
        return res.status(500).json({ success: false, error: error.message, details: error });
      }
      
      console.log("PROFILE_CREATE_SUCCESS", data);
      return res.status(200).json({ success: true, profile: data });
    } catch (error: any) {
      console.error("PROFILE_CREATE_ERROR (Catch block):", error);
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

      // Safety check: a user can only fetch their own profile, unless they are admin
      if (userId !== auth.user.id && auth.profile?.role !== 'admin') {
        return res.status(403).json({ success: false, error: "Forbidden: Cannot fetch profile of another user" });
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
