import { supabase } from '../lib/server-supabase.js';
import { verifyAuth, setSecurityHeaders } from './authMiddleware.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    setSecurityHeaders(res);
    return res.status(200).end();
  }

  const auth = await verifyAuth(req, res);
  if (!auth) {
    return; // Response already handled by verifyAuth
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }
    const { user_id } = body;

    // Never trust user_id from body.
    // Default target is the authenticated user themselves.
    let targetUserId = auth.user.id;

    // Admins may delete other users only after role verification.
    if (user_id && user_id !== auth.user.id) {
      if (auth.profile?.role === 'admin') {
        targetUserId = user_id;
      } else {
        return res.status(403).json({ success: false, error: "Forbidden: Only administrators can delete other users' accounts" });
      }
    }

    if (!supabase) {
      return res.status(500).json({ error: "Supabase service role is not configured on server", success: false });
    }

    console.log(`[DeleteAccount] Starting account deletion for user: ${targetUserId}`);

    // A. Fetch all user photos from database to know their storage paths
    const { data: photos, error: fetchPhotosError } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('user_id', targetUserId);

    if (fetchPhotosError) {
      console.error("[DeleteAccount] Fetch photos error:", fetchPhotosError);
    }

    // B. Clean up storage folder
    try {
      const { data: fileList, error: listError } = await supabase.storage.from('photos').list(targetUserId);
      if (!listError && fileList && fileList.length > 0) {
        const fullPaths = fileList.map(f => `${targetUserId}/${f.name}`);
        console.log(`[DeleteAccount] Removing ${fullPaths.length} objects from storage for ${targetUserId}`);
        await supabase.storage.from('photos').remove(fullPaths);
      }
    } catch (storErr) {
      console.error("[DeleteAccount] Storage files deletion exception:", storErr);
    }

    // C. Delete records (Cascading relations clean up photos/folders if we delete profile, but let's be safe and explicit)
    console.log(`[DeleteAccount] Cleaning up database records...`);
    await supabase.from('photos').delete().eq('user_id', targetUserId);
    await supabase.from('folders').delete().eq('user_id', targetUserId);
    const { error: profileDeleteError } = await supabase.from('profiles').delete().eq('id', targetUserId);

    if (profileDeleteError) {
      console.error("[DeleteAccount] Profile delete error:", profileDeleteError);
      return res.status(500).json({ error: "Failed to delete database profile", details: profileDeleteError, success: false });
    }

    // D. Delete the user from auth.users via Admin Auth API
    console.log(`[DeleteAccount] Deleting auth user...`);
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(targetUserId);
    if (authDeleteError) {
      console.error("[DeleteAccount] Auth user deletion error (ignoring if user already missing):", authDeleteError);
    }

    return res.status(200).json({ success: true, message: "Account and all associated records permanently destroyed." });
  } catch (error: any) {
    console.error("[DeleteAccount] Fatal deletion error:", error);
    res.status(500).json({ error: error.message || "Account deletion failed", success: false });
  }
}
