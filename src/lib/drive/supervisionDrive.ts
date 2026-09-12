import "server-only";

import { google, drive_v3 } from "googleapis";

export const SUPERVISION_DRIVE_ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() ||
  "1ryH6iA_o8sSchRH-SNF6I8c-qBghpw2k";

export const DRIVE_CATEGORIES = {
  approvals: "الموافقات والمستندات",
  meeting_minutes: "محاضر الاجتماعات",
  activity_evidence: "أدلة الأنشطة",
  videos: "فيديوهات التطبيق",
} as const;

export type DriveCategory = keyof typeof DRIVE_CATEGORIES;

function authClient() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
    subject:
      process.env.GOOGLE_DRIVE_IMPERSONATED_EMAIL?.trim() ||
      process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL?.trim(),
  });
}

export function getDriveClient() {
  return google.drive({ version: "v3", auth: authClient() });
}

function escapeQuery(value: string) {
  return value.replace(/'/g, "\\'");
}

async function findOrCreateFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
  appProperties: Record<string, string>,
) {
  const found = await drive.files.list({
    q: `'${escapeQuery(parentId)}' in parents and name='${escapeQuery(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existing = found.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    supportsAllDrives: true,
    fields: "id",
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
      appProperties,
    },
  });
  if (!created.data.id) throw new Error("DRIVE_FOLDER_CREATE_FAILED");
  return created.data.id;
}

export async function ensureTraineeDriveFolder(params: {
  traineeId: string;
  traineeName: string;
  category: DriveCategory;
}) {
  const drive = getDriveClient();
  const safeName = params.traineeName.replace(/[\\/:*?"<>|]/g, "-").trim();
  const traineeFolder = await findOrCreateFolder(
    drive,
    SUPERVISION_DRIVE_ROOT_FOLDER_ID,
    `${safeName || "متدرب"} — ${params.traineeId.slice(0, 8)}`,
    { sulukeraType: "trainee", traineeId: params.traineeId },
  );
  const categoryFolder = await findOrCreateFolder(
    drive,
    traineeFolder,
    DRIVE_CATEGORIES[params.category],
    {
      sulukeraType: "category",
      traineeId: params.traineeId,
      category: params.category,
    },
  );
  return { drive, traineeFolder, categoryFolder };
}

export async function createResumableDriveUpload(params: {
  traineeId: string;
  traineeName: string;
  category: DriveCategory;
  fileName: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  uploaderRole: string;
  readerEmails: Array<string | undefined>;
}) {
  const { drive, traineeFolder, categoryFolder } =
    await ensureTraineeDriveFolder(params);
  await syncTraineeFolderReaders(drive, traineeFolder, params.readerEmails);
  const tokenResult = await authClient().getAccessToken();
  const token = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;
  if (!token) throw new Error("DRIVE_AUTH_FAILED");

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": params.mimeType,
        "X-Upload-Content-Length": String(params.size),
      },
      body: JSON.stringify({
        name: params.fileName,
        parents: [categoryFolder],
        appProperties: {
          sulukeraType: "traineeFile",
          traineeId: params.traineeId,
          category: params.category,
          uploaderId: params.uploaderId,
          uploaderRole: params.uploaderRole,
        },
      }),
    },
  );
  const uploadUrl = response.headers.get("location");
  if (!response.ok || !uploadUrl) {
    throw new Error(`DRIVE_UPLOAD_INIT_FAILED:${response.status}`);
  }
  return uploadUrl;
}

/**
 * Keeps each trainee folder private to the trainee, their current supervisor,
 * and the Workspace owner. Direct reader permissions left by a previous
 * supervisor assignment are removed. Inherited/owner permissions are never
 * touched.
 */
export async function syncTraineeFolderReaders(
  drive: drive_v3.Drive,
  folderId: string,
  emails: Array<string | undefined>,
) {
  const desired = new Set(
    emails
      .map((email) => email?.trim().toLowerCase())
      .filter(Boolean) as string[],
  );
  const current = await drive.permissions.list({
    fileId: folderId,
    supportsAllDrives: true,
    fields:
      "permissions(id,type,role,emailAddress,permissionDetails(inherited))",
  });
  const directUserPermissions = (current.data.permissions || []).filter(
    (permission) =>
      permission.id &&
      permission.type === "user" &&
      permission.role === "reader" &&
      !permission.permissionDetails?.some((detail) => detail.inherited),
  );

  await Promise.all(
    directUserPermissions
      .filter(
        (permission) =>
          permission.emailAddress &&
          !desired.has(permission.emailAddress.toLowerCase()),
      )
      .map((permission) =>
        drive.permissions.delete({
          fileId: folderId,
          permissionId: permission.id!,
          supportsAllDrives: true,
        }),
      ),
  );

  const existing = new Set(
    (current.data.permissions || [])
      .map((permission) => permission.emailAddress?.toLowerCase())
      .filter(Boolean),
  );
  await Promise.all(
    [...desired]
      .filter((email) => !existing.has(email))
      .map(async (email) => {
        try {
          await drive.permissions.create({
            fileId: folderId,
            supportsAllDrives: true,
            sendNotificationEmail: false,
            requestBody: { type: "user", role: "reader", emailAddress: email },
          });
        } catch (error: any) {
          if (![400, 409].includes(Number(error?.code))) throw error;
        }
      }),
  );
}

export async function getVerifiedDriveFile(fileId: string, traineeId: string) {
  const drive = getDriveClient();
  const result = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields:
      "id,name,mimeType,size,webViewLink,webContentLink,appProperties,createdTime,modifiedTime",
  });
  if (
    result.data.appProperties?.sulukeraType !== "traineeFile" ||
    result.data.appProperties?.traineeId !== traineeId
  ) {
    throw new Error("DRIVE_FILE_MISMATCH");
  }
  return { drive, file: result.data };
}

export async function grantDriveFileReaders(
  drive: drive_v3.Drive,
  fileId: string,
  emails: Array<string | undefined>,
) {
  const unique = [...new Set(emails.map((email) => email?.trim().toLowerCase()).filter(Boolean))] as string[];
  await Promise.all(
    unique.map(async (email) => {
      try {
        await drive.permissions.create({
          fileId,
          supportsAllDrives: true,
          sendNotificationEmail: false,
          requestBody: { type: "user", role: "reader", emailAddress: email },
        });
      } catch (error: any) {
        if (![400, 403, 409].includes(Number(error?.code))) throw error;
      }
    }),
  );
}
