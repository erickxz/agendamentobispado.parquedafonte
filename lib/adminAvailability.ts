import "server-only";
import type { DateTime } from "luxon";
import type { AvailabilityConfig } from "@/config/availability";
import type { Booking } from "./google/events";
import type { Mark } from "./google/marks";
import type { AdminDayDto, AdminSlotDto } from "./presenters";
import {
  candidatesForDay,
  isBlockedDate,
  offWeekWindowsForDay,
  overlapsBusy,
  serviceDays,
  type BusyInterval,
} from "./slots";
import { formatLongDate, formatTime, toDateKey } from "./time";

/**
 * Situação de cada horário para o painel, na ordem de prioridade:
 * entrevista marcada > bloqueio > outro compromisso na agenda > prazo encerrado > livre.
 * Inclui também os dias de semana de folga (ex.: quarta de conselho), para o painel poder abri-los.
 */
export function buildAdminAvailability(params: {
  config: AvailabilityConfig;
  from: DateTime;
  to: DateTime;
  now: DateTime;
  busy: BusyInterval[];
  bookings: Booking[];
  blocks: Mark[];
  openings: Mark[];
}): AdminDayDto[] {
  const { config, from, to, now, busy, bookings, blocks, openings } = params;
  const minStart = now.plus({ hours: config.minNoticeHours });
  const own = [...bookings, ...blocks];
  // "Outros compromissos" = ocupações do freebusy que não são entrevistas nem bloqueios do sistema.
  const others = busy.filter((b) => !own.some((o) => o.start <= b.start && o.end >= b.end));

  const days = new Map<string, DateTime>();
  for (const d of serviceDays(config, from, to, openings)) days.set(toDateKey(d), d);
  for (let d = from.startOf("day"); d <= to; d = d.plus({ days: 1 })) {
    if (offWeekWindowsForDay(config, d).length > 0) days.set(toDateKey(d), d);
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => {
      const dayBlock = blocks.find(
        (b) => b.allDay && toDateKey(b.start) <= date && toDateKey(b.end.minus({ minutes: 1 })) >= date,
      );
      const dayOpenings = openings.filter((o) => toDateKey(o.start) === date);
      const offWindow = offWeekWindowsForDay(config, day)[0];

      const slots: AdminSlotDto[] = candidatesForDay(config, day, dayOpenings).map((slot) => {
        const base = { start: slot.start.toISO()!, time: formatTime(slot.start), endTime: formatTime(slot.end) };
        const booking = bookings.find((b) => b.start < slot.end && b.end > slot.start);
        if (booking) return { ...base, status: "booked", nome: booking.nome, bookingId: booking.eventId };
        const block = blocks.find((b) => !b.allDay && b.start < slot.end && b.end > slot.start);
        if (block) return { ...base, status: "blocked", blockId: block.eventId };
        if (dayBlock) return { ...base, status: "blocked" };
        if (overlapsBusy(slot, others, config.bufferMinutes)) return { ...base, status: "busy" };
        if (slot.start < minStart) return { ...base, status: "closed" };
        return { ...base, status: "free" };
      });

      return {
        date,
        label: formatLongDate(day),
        dayBlockId: dayBlock?.eventId ?? null,
        configBlocked: isBlockedDate(date, config.blockedDates),
        openings: dayOpenings.map((o) => ({
          eventId: o.eventId,
          label: `${formatTime(o.start)} às ${formatTime(o.end)}`,
        })),
        offWeek: offWindow
          ? { note: offWindow.offWeekNote ?? "Sem atendimento nesta semana", from: offWindow.start, to: offWindow.end }
          : null,
        slots,
      };
    });
}
