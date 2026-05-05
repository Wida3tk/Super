// src/types/index.ts

export type BookingStatus = 'confirmed' | 'cancelled' | 'rescheduled' | 'completed';

export interface Supervisor {
  id: string;
  name: string;
  email: string;
  photo: string;
  bio: string;
  totalSessions: number;
  ratingAverage: number;
  isActive: boolean;
}

export interface AvailabilitySlot {
  id: string;
  supervisorId: string;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:mm
  isBooked: boolean;
  bookingId?: string;
}

export interface Booking {
  id: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  supervisorId: string;
  supervisorName?: string;
  date: string;
  time: string;
  meetLink: string;
  googleEventId: string;
  status: BookingStatus;
  managementToken: string;
  referenceNumber?: string;
  availabilitySlotId?: string;
  reminderSent?: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  supervisorId: string;
  rating: number;        // 1–5
  comment: string;
  createdAt: string;
}

export interface CreateBookingPayload {
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  supervisorId: string;
  availabilitySlotId: string;
  date: string;
  time: string;
}

export interface CalendarEventPayload {
  summary: string;
  startDateTime: string;
  endDateTime: string;
  attendees: string[];
  description?: string;
}

export interface AdminStats {
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  occupancyRate: number;
  sessionsBySupervisor: { supervisorId: string; name: string; count: number }[];
}
