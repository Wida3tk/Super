import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, adminSubpath, resolveAdminLocation } from "./adminNav";

describe("admin navigation", () => {
  it("strips locale and admin prefix", () => {
    expect(adminSubpath("/ar/admin")).toBe("");
    expect(adminSubpath("/ar/admin/")).toBe("");
    expect(adminSubpath("/en/admin/trainees/TR-1")).toBe("/trainees/TR-1");
  });

  it("maps every legacy admin route to a section", () => {
    const expected: Record<string, string> = {
      "/ar/admin": "today",
      "/ar/admin/trainees": "trainees",
      "/ar/admin/trainees/abc": "trainees",
      "/ar/admin/onboarding": "trainees",
      "/ar/admin/assignment": "trainees",
      "/ar/admin/trainee-requests": "trainees",
      "/ar/admin/accounts": "trainees",
      "/ar/admin/import": "trainees",
      "/ar/admin/supervisors": "supervisors",
      "/ar/admin/supervisors/SUP-1": "supervisors",
      "/ar/admin/bookings": "supervisors",
      "/ar/admin/productivity": "supervisors",
      "/ar/admin/import-supervisor": "supervisors",
      "/ar/admin/months": "months",
      "/ar/admin/notifications": "notifications",
      "/ar/admin/cms": "system",
      "/ar/admin/export": "system",
      "/ar/admin/operations": "system",
    };
    for (const [path, key] of Object.entries(expected)) expect(resolveAdminLocation(path).section.key, path).toBe(key);
  });

  it("does not confuse a trainee id with another tab", () => {
    const location = resolveAdminLocation("/ar/admin/trainees/onboarding");
    expect(location.tab.path).toBe("/trainees");
    expect(location.isDetail).toBe(true);
  });

  it("keeps the sidebar at six sections", () => {
    expect(ADMIN_SECTIONS).toHaveLength(6);
  });
});
