import { describe, expect, it } from 'vitest';
import { isManagementToken, validateBookingPayload } from './booking';
import type { CreateBookingPayload } from '@/types';

const validPayload: CreateBookingPayload = {
  studentName: 'Test User',
  studentEmail: 'test@example.com',
  studentPhone: '+966 500 000 000',
  supervisorId: 'supervisor-1',
  availabilitySlotId: 'slot-1',
  date: '2030-05-10',
  time: '09:30',
};

describe('booking validation', () => {
  it('accepts a valid booking', () => {
    expect(validateBookingPayload(validPayload)).toBeNull();
  });

  it('rejects missing slot identity', () => {
    expect(validateBookingPayload({ ...validPayload, availabilitySlotId: '' })).toBe('INVALID_SLOT');
  });

  it('rejects malformed contact data', () => {
    expect(validateBookingPayload({ ...validPayload, studentEmail: 'invalid' })).toBe('INVALID_EMAIL');
    expect(validateBookingPayload({ ...validPayload, studentPhone: '123' })).toBe('INVALID_PHONE');
  });

  it('only accepts 256-bit lowercase hexadecimal management tokens', () => {
    expect(isManagementToken('a'.repeat(64))).toBe(true);
    expect(isManagementToken('A'.repeat(64))).toBe(false);
    expect(isManagementToken('a'.repeat(63))).toBe(false);
  });
});
