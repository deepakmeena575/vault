import { getDriveClient } from '../../lib/googleDrive';

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

  const drive_file_id = req.query?.drive_file_id as string;
  if (!drive_file_id) {
    return res.status(400).json({ success: false, error: "Missing drive_file_id" });
  }

  if (req.method === 'GET') {
    try {
      const drive = getDriveClient();
      if (!drive) return res.status(500).json({ success: false, error: "No Drive client" });

      const file = await drive.files.get({
        fileId: drive_file_id,
        fields: "webViewLink, webContentLink",
      });

      return res.status(200).json(file.data);
    } catch (e: any) {
      console.error("[Photo API] GET error:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const drive = getDriveClient();
      if (!drive) return res.status(500).json({ success: false, error: "No Drive client" });

      await drive.files.delete({ fileId: drive_file_id });
      return res.status(200).json({ success: true });
    } catch (e: any) {
      console.error("[Photo API] DELETE error:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}
