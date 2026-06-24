import { getDriveClient } from '../lib/googleDrive.js';
import { Readable } from 'stream';

export default async function handler(req: any, res: any) {
  try {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    let targetDriveFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER;

    const envState = {
      emailPresent: !!serviceAccountEmail,
      privateKeyPresent: !!privateKey,
      folderPresent: !!targetDriveFolderId
    };

    console.log("UPLOAD_TEST_ENV", envState);

    console.log("Before getDriveClient");
    const drive = getDriveClient();
    if (!drive) {
      return res.status(500).json({ 
        error: "Google Drive is not configured.", 
        success: false,
        env: envState
      });
    }

    const fileContent = "This is a test upload.";
    const bufferStream = new Readable();
    bufferStream.push(Buffer.from(fileContent, 'utf-8'));
    bufferStream.push(null);

    const fileMetadata: any = {
      name: "test-upload.txt",
      parents: targetDriveFolderId ? [targetDriveFolderId] : [],
    };

    const media = {
      mimeType: "text/plain",
      body: bufferStream,
    };

    console.log("Before drive.files.create");
    const driveRes = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });
    console.log("After drive.files.create", driveRes.data.id);

    return res.status(200).json({
      success: true,
      drive_file_id: driveRes.data.id,
      file_url: driveRes.data.webViewLink || driveRes.data.webContentLink || '',
      env: envState
    });
  } catch (error: any) {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    let targetDriveFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER;

    console.error("UPLOAD_TEST_ERROR", error);
    return res.status(500).json({
      success: false,
      error: String(error),
      details: error,
      stack: error?.stack,
      env: {
        emailPresent: !!serviceAccountEmail,
        privateKeyPresent: !!privateKey,
        folderPresent: !!targetDriveFolderId
      }
    });
  }
}
