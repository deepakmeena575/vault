import { supabase } from '../lib/server-supabase.js';
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
    
    console.log("UPLOAD_START");
    const { folder_id, user_id } = req.body;
    const file = req.file;
    
    console.log("UPLOAD_USER_ID", user_id);

    if (!file) {
      console.log('[Upload] Error: No file provided');
      return res.status(400).json({ error: "No file provided", success: false });
    }
    
    if (!user_id) {
      console.log('[Upload] Error: No user ID provided');
      return res.status(400).json({ error: "No user ID provided", success: false });
    }

    console.log("FILE_NAME", file.originalname);
    console.log("FILE_SIZE", file.size);

    if (!supabase) {
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
    
    console.log("STORAGE_UPLOAD_SUCCESS", uploadData.path);

    console.log('[Upload] Starting Supabase database insert');
    
    const insertData = {
      user_id,
      folder_id: folder_id || null,
      file_name: file.originalname,
      storage_path: storagePath,
      file_url: null
    };
      
    const { data, error } = await supabase.from('photos').insert(insertData).select().single();
      
    if (error) {
      console.error("PHOTO_DB_INSERT_ERROR", error);
      // Clean up the uploaded file if database insert fails
      await supabase.storage.from('photos').remove([storagePath]);
      return res.status(500).json({ error: "Failed to save metadata to DB", details: error, success: false });
    }
      
    console.log("PHOTO_DB_INSERT_SUCCESS", data.id);
    console.log('[Upload] Response sent (Success)');
    
    return res.status(200).json({ 
      photo: data, 
      success: true, 
      file_name: file.originalname, 
      file_url: null, 
      storage_path: storagePath 
    });

  } catch (error: any) {
    console.error("UPLOAD_ERROR", error);
    return res.status(500).json({ error: String(error), details: error, stack: error?.stack, success: false });
  }
}
