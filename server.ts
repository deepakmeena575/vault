import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize Supabase Client for backend verifications/admin if needed
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey || 'dummy');

const upload = multer({ storage: multer.memoryStorage() });

// --- API ROUTES ---

// 1. Upload API
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    console.log('[Upload] Request received in Express');
    const { folder_id, user_id } = req.body;
    const file = req.file;

    if (!file) {
      console.log('[Upload] Error: No file provided');
      return res.status(400).json({ error: "No file provided", success: false });
    }

    if (!user_id) {
      console.log('[Upload] Error: No user ID provided');
      return res.status(400).json({ error: "No user ID provided", success: false });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('[Upload] Error: Supabase client not configured');
      return res.status(500).json({ error: "Supabase is not configured.", success: false });
    }

    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const storagePath = `${user_id}/${fileName}`;

    console.log(`[Upload] Uploading to Supabase Storage: ${storagePath}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error("SUPABASE_STORAGE_UPLOAD_ERROR", uploadError);
      return res.status(500).json({ error: "Failed to upload to storage", details: uploadError, success: false });
    }
    
    // Generate a temporary signed URL for immediate use if needed
    const { data: signedUrlData } = await supabase.storage.from('photos').createSignedUrl(storagePath, 60 * 60);
    const fileUrl = signedUrlData?.signedUrl || '';

    const insertData = {
      user_id,
      folder_id: folder_id || null,
      file_name: file.originalname,
      storage_path: storagePath,
      file_url: fileUrl
    };
      
    const { data, error } = await supabase.from('photos').insert(insertData).select().single();
      
    if (error) {
      console.error("PHOTO_DB_INSERT_ERROR", error);
      await supabase.storage.from('photos').remove([storagePath]);
      return res.status(500).json({ error: "Failed to save metadata to DB", details: error, success: false });
    }
      
    return res.status(200).json({ 
      photo: data, 
      success: true, 
      file_name: file.originalname, 
      file_url: fileUrl, 
      storage_path: storagePath 
    });

  } catch (error: any) {
    console.error("[Upload] Upload error:", error);
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

// Profile creation API to bypass RLS during signup
app.post("/api/profile", async (req, res) => {
  try {
    const { id, full_name, mobile_number, email, role } = req.body;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("Supabase not configured on server. VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
      return res.status(500).json({ error: "Supabase not configured on server" });
    }

    const { data, error } = await supabase.from('profiles').insert([
      { id, full_name, mobile_number, email, role: role || 'user' }
    ]).select().single();

    if (error) {
      console.error("Profile creation error from backend:", error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true, profile: data });
  } catch (error: any) {
    console.error("Profile error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Profile retrieval API
app.get("/api/profile", async (req, res) => {
  try {
    const userId = req.query.id as string;
    
    if (!userId) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Supabase not configured on server" });
    }

    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

    if (error) {
      return res.status(404).json({ error: "Profile not found" });
    }
    
    res.json({ success: true, profile: data });
  } catch (error: any) {
    console.error("Profile get error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Secure Deletion API (bypasses standard client limitations)
app.post("/api/delete-account", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: "Missing user ID", success: false });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
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
});

// Catch-all 404 for unhandled API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ success: false, error: "API route not found" });
});

// Global error handler to prevent HTML responses
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express global error handler caught:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});

// --- VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
