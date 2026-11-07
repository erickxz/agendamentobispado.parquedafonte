import { DateTime } from "luxon";
import type { AvailabilityConfig, BlockedDate, WeeklyWindow } from "@/config/availability";
import { TZ, parseDate, parseInstant, toDateKey } from "./time";

export interface Slot {
  start: DateTime;
  end: DateTime;
}

export interface BusyInterval {
  start: DateTime;
  end: DateTime;
}

/** Horários extras abertos pelo painel (evento "Aberto para entrevistas" na agenda). */
export interface Opening {
  start: DateTime;
  end: DateTime;
}

export interface DaySlots {
  date: string; // YYYY-MM-DD
  slots: Slot[];
}

function parseHm(dateStart: DateTime, hm: string): DateTime {
  const [hour, minute] = hm.split(":").map(Number);
  return dateStart.set({ hour, minute, second: 0, millisecond: 0 });
}

export function isBlockedDate(dateKey: string, blocked: BlockedDate[]): boolean {
  return blocked.some((b) => ("date" in b ? b.date === dateKey : dateKey >= b.from && dateKey <= b.to));
}

/** A janela vale nesta semana? (janelas quinzenais usam uma data de referência) */
function isActiveWeek(window: WeeklyWindow, day: DateTime): boolean {
  if (!window.repeat) return true;
  const anchor = parseDate(window.repeat.startingFrom).startOf("week");
  const weeks = Math.round(day.startOf("week").diff(anchor, "weeks").weeks);
  const every = window.repeat.everyWeeks;
  return ((weeks % every) + every) % every === 0;
}

/** Janelas semanais que valem neste dia. */
export function windowsForDay(config: AvailabilityConfig, day: DateTime): WeeklyWindow[] {
  const d = day.setZone(TZ);
  return config.windows.filter((w) => w.weekday === d.weekday && isActiveWeek(w, d));
}

/** Janelas quinzenais que caem neste dia da semana mas estão na semana de folga (ex.: semana de conselho). */
export function offWeekWindowsForDay(config: AvailabilityConfig, day: DateTime): WeeklyWindow[] {
  const d = day.setZone(TZ);
  return config.windows.filter((w) => w.weekday === d.weekday && w.repeat && !isActiveWeek(w, d));
}

/** Primeiro e último dia (inclusive) que podem aparecer para o membro. */
export function bookingHorizon(config: AvailabilityConfig, now: DateTime): { first: DateTime; last: DateTime } {
  const first = now.setZone(TZ).startOf("day");
  return { first, last: first.plus({ days: config.daysAhead }) };
}

function slotsBetween(config: AvailabilityConfig, from: DateTime, until: DateTime): Slot[] {
  const step = config.durationMinutes + config.bufferMinutes;
  const result: Slot[] = [];
  for (let start = from; start.plus({ minutes: config.durationMinutes }) <= until; start = start.plus({ minutes: step })) {
    result.push({ start, end: start.plus({ minutes: config.durationMinutes }) });
  }
  return result;
}

/**
 * Horários candidatos de um dia: janelas semanais + horários extras abertos pelo painel.
 * Não considera agenda ocupada, bloqueios nem antecedência.
 */
export function candidatesForDay(config: AvailabilityConfig, day: DateTime, openings: Opening[] = []): Slot[] {
  const dayStart = day.setZone(TZ).startOf("day");
  const dateKey = toDateKey(dayStart);
  const all: Slot[] = [];

  for (const w of windowsForDay(config, dayStart)) {
    all.push(...slotsBetween(config, parseHm(dayStart, w.start), parseHm(dayStart, w.end)));
  }
  for (const o of openings) {
    if (toDateKey(o.start) === dateKey) all.push(...slotsBetween(config, o.start.setZone(TZ), o.end.setZone(TZ)));
  }

  const unique = new Map(all.map((s) => [s.start.toMillis(), s]));
  return [...unique.values()].sort((a, b) => a.start.toMillis() - b.start.toMillis());
}

/** Dias do intervalo com janela de atendimento ativa ou horário extra aberto. */
export function serviceDays(config: AvailabilityConfig, from: DateTime, to: DateTime, openings: Opening[] = []): DateTime[] {
  const openingDays = new Set(openings.map((o) => toDateKey(o.start)));
  const days: DateTime[] = [];
  for (let d = from.setZone(TZ).startOf("day"); d <= to; d = d.plus({ days: 1 })) {
    if (windowsForDay(config, d).length > 0 || openingDays.has(toDateKey(d))) days.push(d);
  }
  return days;
}

/** O horário conflita com um bloco ocupado, considerando o intervalo (buffer) dos dois lados. */
export function overlapsBusy(slot: Slot, busy: BusyInterval[], bufferMinutes: number): boolean {
  const s = slot.start.toMillis();
  const e = slot.end.toMillis();
  const buffer = bufferMinutes * 60_000;
  return busy.some((b) => s < b.end.toMillis() + buffer && e > b.start.toMillis() - buffer);
}

function earliestBookable(config: AvailabilityConfig, now: DateTime): DateTime {
  return now.plus({ hours: config.minNoticeHours });
}

/**
 * Horários livres agrupados por dia.
 * Retorna todos os dias de atendimento do intervalo, inclusive os sem horário (para aparecerem desabilitados).
 */
export function computeAvailability(params: {
  config: AvailabilityConfig;
  from: DateTime;
  to: DateTime;
  busy: BusyInterval[];
  now: DateTime;
  openings?: Opening[];
}): DaySlots[] {
  const { config, busy, now, openings = [] } = params;
  const horizon = bookingHorizon(config, now);
  const from = DateTime.max(params.from.setZone(TZ).startOf("day"), horizon.first);
  const to = DateTime.min(params.to.setZone(TZ).startOf("day"), horizon.last);
  const minStart = earliestBookable(config, now);

  return serviceDays(config, from, to, openings).map((day) => {
    const date = toDateKey(day);
    if (isBlockedDate(date, config.blockedDates)) return { date, slots: [] };
    const slots = candidatesForDay(config, day, openings).filter(
      (slot) => slot.start >= minStart && !overlapsBusy(slot, busy, config.bufferMinutes),
    );
    return { date, slots };
  });
}

/**
 * Confere se um início enviado pelo cliente corresponde a um horário válido pelas regras
 * (janela semanal ou horário extra, data não bloqueada, dentro do horizonte e da antecedência). Não consulta a agenda.
 */
export function findValidSlot(
  config: AvailabilityConfig,
  startIso: string,
  now: DateTime,
  openings: Opening[] = [],
): Slot | null {
  const start = parseInstant(startIso);
  if (!start.isValid) return null;

  const dateKey = toDateKey(start);
  const horizon = bookingHorizon(config, now);
  const day = parseDate(dateKey);
  if (day < horizon.first || day > horizon.last) return null;
  if (isBlockedDate(dateKey, config.blockedDates)) return null;
  if (start < earliestBookable(config, now)) return null;

  return candidatesForDay(config, day, openings).find((c) => c.start.toMillis() === start.toMillis()) ?? null;
}

/** Horário com a duração padrão a partir de um início qualquer (usado no .ics e nos bloqueios do painel). */
export function slotFromStart(config: AvailabilityConfig, startIso: string): Slot | null {
  const start = parseInstant(startIso);
  if (!start.isValid || start.second !== 0 || start.minute % 5 !== 0) return null;
  return { start, end: start.plus({ minutes: config.durationMinutes }) };
}
