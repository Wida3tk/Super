// src/lib/calendar/googleCalendar.ts
// تكامل Google Calendar API عبر Service Account

import { google } from 'googleapis';

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return google.calendar({ version: 'v3', auth });
}

export interface CreateEventParams {
  summary: string;
  description: string;
  startDateTime: string;   // ISO 8601
  endDateTime: string;     // ISO 8601
  attendeeEmails: string[];
  timeZone?: string;
}

export interface CalendarEventResult {
  googleEventId: string;
  meetLink: string;
  htmlLink: string;
}

/**
 * إنشاء حدث في Google Calendar مع Google Meet
 */
export async function createCalendarEvent(
  params: CreateEventParams
): Promise<CalendarEventResult> {
  const calendar = getCalendarClient();
  const organizerEmail = process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL!;

  const event = await calendar.events.insert({
    calendarId: organizerEmail,
    conferenceDataVersion: 1,  // مطلوب لإنشاء Google Meet
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: {
        dateTime: params.startDateTime,
        timeZone: params.timeZone || 'Asia/Riyadh',
      },
      end: {
        dateTime: params.endDateTime,
        timeZone: params.timeZone || 'Asia/Riyadh',
      },
      attendeeEmails: params.attendeeEmails,(email => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `booking-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },  // 24 ساعة قبل
          { method: 'popup', minutes: 30 },         // 30 دقيقة قبل
        ],
      },
    },
  });

  const eventData = event.data;
  const meetLink =
    eventData.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ||
    eventData.hangoutLink ||
    '';

  return {
    googleEventId: eventData.id!,
    meetLink,
    htmlLink: eventData.htmlLink!,
  };
}

/**
 * إلغاء حدث في Google Calendar
 */
export async function cancelCalendarEvent(googleEventId: string): Promise<void> {
  const calendar = getCalendarClient();
  const organizerEmail = process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL!;

  await calendar.events.delete({
    calendarId: organizerEmail,
    eventId: googleEventId,
    sendUpdates: 'all',  // إرسال إشعار للمدعوين
  });
}

/**
 * تحديث موعد الحدث (إعادة جدولة)
 */
export async function updateCalendarEvent(
  googleEventId: string,
  newStartDateTime: string,
  newEndDateTime: string,
  timeZone = 'Asia/Riyadh'
): Promise<void> {
  const calendar = getCalendarClient();
  const organizerEmail = process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL!;

  await calendar.events.patch({
    calendarId: organizerEmail,
    eventId: googleEventId,
    sendUpdates: 'all',
    requestBody: {
      start: { dateTime: newStartDateTime, timeZone },
      end: { dateTime: newEndDateTime, timeZone },
    },
  });
}
