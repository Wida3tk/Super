import { timingSafeEqual } from "node:crypto";

export function verifyBearerSecret(
  authorizationHeader: string | null,
  configuredSecret: string | undefined,
) {
  const secret = configuredSecret?.trim();
  if (!secret || secret.length < 16 || !authorizationHeader?.startsWith("Bearer "))
    return false;

  const provided = authorizationHeader.slice("Bearer ".length);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(secret);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}
