export type UploadCategory =
  | "approvals"
  | "meeting_minutes"
  | "activity_evidence"
  | "videos";

export async function uploadTraineeFile(params: {
  traineeId: string;
  file: File;
  category: UploadCategory;
  type?: string;
  title?: string;
  notes?: string;
  issuedAt?: string;
  centerName?: string;
  clientCode?: string;
  expiresAt?: string;
  onProgress?: (percent: number) => void;
}) {
  const initiated = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "initiate",
      traineeId: params.traineeId,
      category: params.category,
      fileName: params.file.name,
      mimeType: params.file.type,
      size: params.file.size,
    }),
  });
  const initData = await initiated.json().catch(() => ({}));
  if (!initiated.ok || !initData.uploadUrl)
    throw new Error(initData.error || "UPLOAD_INIT_FAILED");

  const uploaded: any = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", initData.uploadUrl);
    xhr.setRequestHeader("Content-Type", params.file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        params.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("UPLOAD_CONNECTION_FAILED"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300)
        return reject(new Error(`UPLOAD_FAILED:${xhr.status}`));
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error("UPLOAD_RESPONSE_INVALID"));
      }
    };
    xhr.send(params.file);
  });

  const completed = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "complete",
      traineeId: params.traineeId,
      fileId: uploaded.id,
      type: params.type,
      title: params.title || params.file.name,
      notes: params.notes,
      issuedAt: params.issuedAt,
      centerName: params.centerName,
      clientCode: params.clientCode,
      expiresAt: params.expiresAt,
    }),
  });
  const completeData = await completed.json().catch(() => ({}));
  if (!completed.ok) throw new Error(completeData.error || "UPLOAD_COMPLETE_FAILED");
  return completeData;
}
