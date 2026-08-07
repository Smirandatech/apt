// src/utils/uploadToDrive.ts
import { google } from "googleapis";
import { Readable } from "stream";
import path from "path";

// Prefer env JSON on Vercel; fall back to local key file for Railway/dev.
function getGoogleAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(json),
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
  }

  return new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "../../apts-456214-b1990b89d6ae.json"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

const auth = getGoogleAuth();

export const drive = google.drive({ version: "v3", auth });

export async function uploadToDrive(
  buffer: Buffer,
  filename: string,
  folderId?: string,
  template?: boolean,
): Promise<string> {
  const fileMetadata: any = {
    name: filename,
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const media = {
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    body: Readable.from((function* () { yield buffer; })()),
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, webViewLink, webContentLink",
    supportsAllDrives: true
  });

  const fileId = file.data.id;

  // Make it publicly viewable
  if (!fileId) {
    throw new Error("Failed to retrieve file ID.");
  }

  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
    supportsAllDrives: true
  });
  if(template) return file.data.webContentLink || "";

  return file.data.webViewLink || file.data.webContentLink || "";
}
