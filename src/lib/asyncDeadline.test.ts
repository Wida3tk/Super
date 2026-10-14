import { afterEach, expect, it, vi } from "vitest";
import { withDeadline } from "./asyncDeadline";
afterEach(() => vi.useRealTimers());
it("preserves results and clears timeout timers", async () => { vi.useFakeTimers(); expect(await withDeadline(Promise.resolve(5), 100)).toBe(5); expect(vi.getTimerCount()).toBe(0); });
it("preserves service failures rather than bypassing checks", async () => { await expect(withDeadline(Promise.reject(new Error("QUOTA")), 100)).rejects.toThrow("QUOTA"); });
it("bounds a hung operation", async () => { vi.useFakeTimers(); const task = withDeadline(new Promise(() => {}), 100); const assertion = expect(task).rejects.toThrow("REQUEST_TIMEOUT"); await vi.advanceTimersByTimeAsync(100); await assertion; expect(vi.getTimerCount()).toBe(0); });
