import { getDriveClient } from '../lib/googleDrive';
import { Readable } from 'stream';

export default async function handler(req: any, res: any) {
  try {
    const drive = getDriveClient();
    if (!drive) {
      return res.status(500).json({ error: "Google Drive is not configured.", success: false });
    }

    const fileContent = "This is a test upload.";
    const bufferStream = new Readable();
    bufferStream.push(Buffer.from(fileContent, 'utf-8'));
    bufferStream.push(null);

    let targetDriveFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER;

    const fileMetadata: any = {
      name: "test-upload.txt",
      parents: targetDriveFolderId ? [targetDriveFolderId] : [],
    };

    const media = {
      mimeType: "text/plain",
      body: bufferStream,
    };

    const driveRes = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    return res.status(200).json({
      success: true,
      drive_file_id: driveRes.data.id,
      file_url: driveRes.data.webViewLink || driveRes.data.webContentLink || '',
    });
  } catch (error: any) {
    console.error("UPLOAD_TEST_ERROR", error);
    return res.status(500).json({
      success: false,
      error: String(error),
      details: error,
      stack: error?.stack,
    });
  }
}
