import "server-only";
import type { DateTime } from "luxon";
import { availability, locationText, mapsUrl } from "@/config/availability";
import { listBookings, type Booking } from "./google/events";
import { icsPath, memberGoogleCalendarUrl } from "./memberCalendar";
import type { MemberAppointmentDto } from "./presenters";
import type { BusyInterval } from "./slots";
import { formatLongDate, formatMonthShort, formatTime, formatWeekdayShort } from "./time";

/** Até quando procurar entrevistas futuras do membro. */
const LOOKAHEAD_DAYS = 365;

/** Entrevistas futuras (ou em andamento) marcadas com este telefone, em ordem de horário. */
export async function listMemberBookings(phone: string, now: DateTime): Promise<Booking[]> {
  const bookings = await listBookings(now.startOf("day"), now.plus({ days: LOOKAHEAD_DAYS }));
  return bookings.filter((b) => b.telefone === phone && b.end > now);
}

export function toMemberAppointmentDto(b: Booking, now: DateTime): MemberAppointmentDto {
  return {
    eventId: b.eventId,
    nome: b.nome,
    start: b.start.toISO()!,
    dateLabel: formatLongDate(b.start),
    timeLabel: formatTime(b.start),
    endTimeLabel: formatTime(b.end),
    weekday: formatWeekdayShort(b.start),
    day: String(b.start.day),
    month: formatMonthShort(b.start),
    location: locationText(availability),
    mapsUrl: mapsUrl(),
    googleCalendarUrl: memberGoogleCalendarUrl(b),
    icsUrl: icsPath(b),
    canChange: canMemberChange(b, now),
  };
}

/** O membro só mexe nas entrevistas que marcou pelo site e que ainda não começaram. */
export function canMemberChange(b: Booking, now: DateTime): boolean {
  return b.origem === "site" && b.start > now;
}

/**
 * Tira o horário da própria entrevista dos blocos ocupados, para o membro poder remarcar
 * para um horário vizinho (ex.: 30 min depois) sem o sistema achar que está ocupado por ele mesmo.
 */
export function withoutInterval(busy: BusyInterval[], own: { start: DateTime; end: DateTime }): BusyInterval[] {
  return busy.flatMap((b) => {
    if (b.end <= own.start || b.start >= own.end) return [b];
    const parts: BusyInterval[] = [];
    if (b.start < own.start) parts.push({ start: b.start, end: own.start });
    if (b.end > own.end) parts.push({ start: own.end, end: b.end });
    return parts;
  });
}
