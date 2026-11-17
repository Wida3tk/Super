/**
 * Marks trainees as graduated: the lifecycle moves to «انتهاء الإشراف»
 * (status completed). Hours and files stay as they are; the trainee keeps
 * their supervisor, so the supervisor still sees them among their graduates.
 * Runs one request at a time so each move is logged on its own.
 */
export async function markGraduated(ids: string[], reason = "تسجيل تخرّج من لوحة الإدارة") {
  const failed: string[] = [];
  for (const traineeId of ids) {
    try {
      const response = await fetch("/api/admin/trainee", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traineeId, action: "updateLifecycle", stage: "completed", reason }),
      });
      if (!response.ok) failed.push(traineeId);
    } catch {
      failed.push(traineeId);
    }
  }
  return { done: ids.length - failed.length, failed };
}
