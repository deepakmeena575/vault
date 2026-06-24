import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

let driveClient: any = null;

export function getDriveClient() {
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
    return google.drive({ version: 'v3', auth });
  } catch (e) {
    console.error("Failed to initialize Google Drive client:", e);
    throw e;
  }
}
