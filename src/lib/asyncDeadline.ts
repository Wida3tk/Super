// Bounds UI/server waits without bypassing authorization or rate limiting.
export async function withDeadline<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), ms); })]);
  } finally { if (timer) clearTimeout(timer); }
}
