import { supabase } from '../lib/server-supabase';
import { getDriveClient } from '../lib/googleDrive';
import { Readable } from 'stream';
import multer from 'multer';

// Vercel serverless function config to allow multer parsing
export const config = {
  api: {
    bodyParser: false,
  },
};

const upload = multer({ storage: multer.memoryStorage() });

function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

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
    await runMiddleware(req, res, upload.single('file'));
    
    console.log('[Upload] Request received directly in serverless function');
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

    let targetDriveFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER;

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

    if (supabase) {
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
      return res.status(200).json({ photo: data, success: true, file_name: file.originalname, file_url, drive_file_id });
    }

    console.log('[Upload] Response sent (Success - No Supabase)');
    return res.status(200).json({ drive_file_id, file_url, file_name: file.originalname, success: true });
  } catch (error: any) {
    console.error("[Upload] Upload error:", error);
    return res.status(500).json({ error: error.message || "Upload failed" });
  }
}
