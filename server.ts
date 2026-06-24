import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { google } from "googleapis";
import { createServer as createViteServer } from "vite";
import { Readable } from "stream";
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

// Setup Google Drive Auth
let driveClient: any = null;

function getDriveClient() {
  if (!driveClient) {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    if (!serviceAccountEmail || !privateKey) {
      console.warn("Google Drive credentials not set up. Uploads will fail until configured.");
      console.warn("Service account email:", !!serviceAccountEmail, "Private key:", !!privateKey);
      return null;
    }
    
    try {
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
      });
      driveClient = google.drive({ version: 'v3', auth });
    } catch (e) {
      console.error("Failed to initialize Google Drive client:", e);
      return null;
    }
  }
  return driveClient;
}

const upload = multer({ storage: multer.memoryStorage() });

// --- API ROUTES ---

// 1. Upload API
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    console.log('[Upload] Request received in Express');
    const { folder_id, user_id, folder_name } = req.body;
    const file = req.file;

    if (!file) {
      console.log('[Upload] Error: No file provided');
      return res.status(400).json({ error: "No file provided" });
    }

    const drive = getDriveClient();
    if (!drive) {
      console.log('[Upload] Error: Google Drive auth failed');
      return res.status(500).json({ error: "Google Drive is not configured. Please set GOOGLE_PRIVATE_KEY and GOOGLE_SERVICE_ACCOUNT_EMAIL." });
    }
    
    console.log('[Upload] Google Drive authentication success');
    console.log(`[Upload] Upload started for ${file.originalname}`);

    let targetDriveFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER; // default root

    // If a specific folder hierarchy logic is needed, we create or find it
    // For simplicity, we just upload to the root folder or a user-specific folder if we implement it.
    // Let's create a user-specific folder inside root if needed.
    
    // Convert buffer to stream
    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);

    const fileMetadata: any = {
      name: file.originalname,
      parents: targetDriveFolderId ? [targetDriveFolderId] : [],
    };

    const media = {
      mimeType: file.mimetype,
      body: bufferStream,
    };

    const driveRes = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    const drive_file_id = driveRes.data.id;
    const file_url = driveRes.data.webViewLink || driveRes.data.webContentLink || '';
    console.log(`[Upload] Upload completed. Successfully uploaded ${file.originalname} to Drive. ID: ${drive_file_id}`);

    // Save metadata in Supabase backend directly to bypass RLS issues if user hasn't configured them
    if (supabaseUrl && supabaseServiceKey) {
      console.log('[Upload] Starting Supabase insert');
      const insertData = {
        user_id,
        folder_id: folder_id || null,
        file_name: file.originalname,
        drive_file_id,
        file_url
      };
      
      const { data, error } = await supabase.from('photos').insert(insertData).select().single();
      
      if (error) {
        console.error("[Upload] Error: Supabase insert error for photo metadata:", error);
        return res.status(500).json({ error: "Failed to save metadata to DB: " + error.message });
      }
      
      console.log('[Upload] Supabase insert completed');
      console.log('[Upload] Response sent (Success)');
      return res.json({ photo: data, success: true, file_name: file.originalname, file_url, drive_file_id });
    }

    console.log('[Upload] Response sent (Success - No Supabase)');
    res.json({ drive_file_id, file_url, file_name: file.originalname, success: true });
  } catch (error: any) {
    console.error("[Upload] Upload error:", error);
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

// 2. Download/Get Drive Link API
app.get("/api/photo/:drive_file_id", async (req, res) => {
    try {
      const { drive_file_id } = req.params;
      const drive = getDriveClient();
      if (!drive) return res.status(500).json({ error: "No Drive client" });

      const file = await drive.files.get({
        fileId: drive_file_id,
        fields: "webViewLink, webContentLink",
      });

      res.json(file.data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
});

app.delete("/api/photo/:drive_file_id", async (req, res) => {
    try {
      const { drive_file_id } = req.params;
      const drive = getDriveClient();
      if (!drive) return res.status(500).json({ error: "No Drive client" });

      await drive.files.delete({ fileId: drive_file_id });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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

// Unused backend endpoints for profile and admin stats have been removed. 
// The frontend directly communicates with Supabase, relying on Row Level Security (RLS) for protection.

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
