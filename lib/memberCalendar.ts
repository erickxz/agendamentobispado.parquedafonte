import { availability, locationText } from "@/config/availability";
import { eventIdForSlot } from "./eventId";
import { buildIcs, googleCalendarUrl, type CalendarEntry } from "./calendarLinks";
import type { Slot } from "./slots";
import { nowInTz } from "./time";

/** Evento que o membro adiciona à própria agenda. Sem nome nem telefone: só o compromisso. */
export function memberCalendarEntry(slot: Slot): CalendarEntry {
  return {
    uid: `${eventIdForSlot(slot.start)}@ala-parque-da-fonte`,
    title: "Entrevista com o bispado",
    start: slot.start,
    end: slot.end,
    location: locationText(availability),
    description: "Ala Parque da Fonte. Se não puder comparecer, avise o secretário da ala.",
  };
}

export function memberGoogleCalendarUrl(slot: Slot): string {
  return googleCalendarUrl(memberCalendarEntry(slot));
}

export function memberIcs(slot: Slot): string {
  return buildIcs(memberCalendarEntry(slot), nowInTz());
}

export function icsPath(slot: Slot): string {
  return `/api/ics?start=${encodeURIComponent(slot.start.toISO()!)}`;
}
