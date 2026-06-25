import { supabase } from '../lib/server-supabase.js';

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

    if (!user_id) {
      return res.status(400).json({ error: "Missing user ID", success: false });
    }

    if (!supabase) {
      return res.status(500).json({ error: "Supabase service role is not configured on server", success: false });
    }

    console.log(`[DeleteAccount] Starting account deletion for user: ${user_id}`);

    // A. Fetch all user photos from database to know their storage paths
    const { data: photos, error: fetchPhotosError } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('user_id', user_id);

    if (fetchPhotosError) {
      console.error("[DeleteAccount] Fetch photos error:", fetchPhotosError);
    }

    // B. Clean up storage folder
    try {
      const { data: fileList, error: listError } = await supabase.storage.from('photos').list(user_id);
      if (!listError && fileList && fileList.length > 0) {
        const fullPaths = fileList.map(f => `${user_id}/${f.name}`);
        console.log(`[DeleteAccount] Removing ${fullPaths.length} objects from storage for ${user_id}`);
        await supabase.storage.from('photos').remove(fullPaths);
      }
    } catch (storErr) {
      console.error("[DeleteAccount] Storage files deletion exception:", storErr);
    }

    // C. Delete records (Cascading relations clean up photos/folders if we delete profile, but let's be safe and explicit)
    console.log(`[DeleteAccount] Cleaning up database records...`);
    await supabase.from('photos').delete().eq('user_id', user_id);
    await supabase.from('folders').delete().eq('user_id', user_id);
    const { error: profileDeleteError } = await supabase.from('profiles').delete().eq('id', user_id);

    if (profileDeleteError) {
      console.error("[DeleteAccount] Profile delete error:", profileDeleteError);
      return res.status(500).json({ error: "Failed to delete database profile", details: profileDeleteError, success: false });
    }

    // D. Delete the user from auth.users via Admin Auth API
    console.log(`[DeleteAccount] Deleting auth user...`);
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user_id);
    if (authDeleteError) {
      console.error("[DeleteAccount] Auth user deletion error (ignoring if user already missing):", authDeleteError);
    }

    return res.status(200).json({ success: true, message: "Account and all associated records permanently destroyed." });
  } catch (error: any) {
    console.error("[DeleteAccount] Fatal deletion error:", error);
    res.status(500).json({ error: error.message || "Account deletion failed", success: false });
  }
}
