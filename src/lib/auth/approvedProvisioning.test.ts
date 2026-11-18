import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const { provision } = createRequire(import.meta.url)('../../../scripts/provision-approved-assistant.cjs');

function setup(existing?: Record<string, unknown>) {
  const marker = { get: vi.fn().mockResolvedValue({ exists: !!existing, data: () => existing }), create: vi.fn(), update: vi.fn() };
  const staff = { get: vi.fn().mockResolvedValue({ exists: false }) };
  const batch = { create: vi.fn(), update: vi.fn(), commit: vi.fn() };
  const query = { where: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), get: vi.fn().mockResolvedValue({ empty: true }) };
  const db = { collection: vi.fn((name: string) => name === 'assistantProvisioningRequests' ? { doc: () => marker } : name === 'administrativeAssistants' ? { doc: () => staff } : name === 'activityLog' ? { doc: () => ({}) } : query), batch: vi.fn(() => batch) };
  const auth = { getUserByEmail: vi.fn().mockRejectedValue({ code: 'auth/user-not-found' }), createUser: vi.fn().mockResolvedValue({}), setCustomUserClaims: vi.fn() };
  const sendReset = vi.fn();
  return { db, auth, sendReset, marker, staff, batch };
}
describe('approved production assistant provisioning', () => {
  it('creates only the approved assistant without a password and records the scope atomically', async () => {
    const s = setup();
    await expect(provision(s)).resolves.toBe('created');
    expect(s.auth.createUser).toHaveBeenCalledWith({ uid: 'approved_assistant_ehamdan_20261118', email: 'ehamdan@sulukera.com', displayName: 'إيمان حمدان' });
    expect(s.auth.setCustomUserClaims).toHaveBeenCalledWith('approved_assistant_ehamdan_20261118', { role: 'administrative_assistant' });
    expect(s.batch.create).toHaveBeenCalledWith(s.staff, expect.objectContaining({ active: true, scope: 'all', supervisorIds: [] }));
    expect(s.sendReset).toHaveBeenCalledWith('ehamdan@sulukera.com');
  });
  it('never restores permissions or resends email on subsequent builds', async () => {
    const s = setup({ accountCreated: true, resetEmailAccepted: true });
    await expect(provision(s)).resolves.toBe('already-created');
    expect(s.auth.createUser).not.toHaveBeenCalled();
    expect(s.auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(s.db.batch).not.toHaveBeenCalled();
    expect(s.sendReset).not.toHaveBeenCalled();
  });
  it('retries email only after an already committed creation', async () => {
    const s = setup({ accountCreated: true, resetEmailAccepted: false });
    await provision(s);
    expect(s.sendReset).toHaveBeenCalledOnce();
    expect(s.db.batch).not.toHaveBeenCalled();
  });
  it('never adopts a preexisting account with the same email', async () => {
    const s = setup();
    s.auth.getUserByEmail.mockResolvedValueOnce({ uid: 'existing-user' });
    await expect(provision(s)).rejects.toThrow('APPROVED_EMAIL_ALREADY_EXISTS');
    expect(s.auth.setCustomUserClaims).not.toHaveBeenCalled();
    expect(s.db.batch).not.toHaveBeenCalled();
  });
});
