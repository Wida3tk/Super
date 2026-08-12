export function normalizeProviderPhotoUrl(url?: string): string {
  if (!url) return "";
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch)
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "drive.google.com") {
      const id = parsed.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
  } catch {}
  return url;
}
