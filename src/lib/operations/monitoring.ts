import "server-only";

import { adminDb } from "@/lib/firebase/admin";

export type OperationalService = "google_calendar" | "email" | "data_sync";

export async function recordOperationalFailure(input: {
  service: OperationalService;
  operation: string;
  entityType: string;
  entityId: string;
  error: unknown;
  retryPayload?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const message = input.error instanceof Error ? input.error.message : String(input.error || "Unknown error");
  await adminDb.collection("operationalIncidents").add({
    service: input.service,
    operation: input.operation,
    entityType: input.entityType,
    entityId: input.entityId,
    status: "open",
    attempts: 1,
    lastError: message.slice(0, 1000),
    // Payloads contain identifiers only; personal data and credentials are
    // deliberately excluded from the operational queue.
    retryPayload: input.retryPayload || {},
    createdAt: now,
    updatedAt: now,
  });
}
