import "server-only";
import { DateTime } from "luxon";
import { availability } from "@/config/availability";
import type { BusyInterval, Slot } from "../slots";
import { candidatesForDay, serviceDays } from "../slots";
import { TZ, nowInTz } from "../time";
import type { Mark, MarkKind } from "./marks";
import type { Attendance, Booking, CreateBookingResult } from "./events";

/**
 * Agenda simulada em memória para desenvolvimento (MOCK_CALENDAR=true).
 * Nunca é usada em produção. Os dados somem quando o servidor reinicia.
 */

type MockEvent =
  | { kind: "busy"; id: string; start: DateTime; end: DateTime }
  | { kind: "mark"; markKind: MarkKind; id: string; start: DateTime; end: DateTime; allDay: boolean }
  | {
      kind: "booking";
      id: string;
      start: DateTime;
      end: DateTime;
      nome: string;
      telefone: string;
      lembreteEnviado: boolean;
      lembreteEnviadoEm?: DateTime;
      compareceu: Attendance;
    };

const store = globalThis as unknown as { __mockCalendar?: Map<string, MockEvent>; __mockSeq?: number };

export function isMockCalendar(): boolean {
  return process.env.MOCK_CALENDAR === "true" && process.env.NODE_ENV !== "production";
}

const delay = () => new Promise((r) => setTimeout(r, 300));

function events(): Map<string, MockEvent> {
  if (store.__mockCalendar) return store.__mockCalendar;
  const map = new Map<string, MockEvent>();
  const now = nowInTz();
  const days = serviceDays(availability, now.startOf("day"), now.plus({ days: availability.daysAhead }));
  const names = ["Ana Paula Ribeiro", "Marcos Vinícius Lopes", "Helena Duarte"];

  // Compromissos do bispo, um dia lotado e entrevistas já marcadas, para a tela ter variedade.
  days.forEach((day, i) => {
    const slots = candidatesForDay(availability, day);
    if (i % 3 === 0 && slots[0]) addBusy(map, `bispo${i}`, slots[0].start, slots[0].end);
    if (i === 1) slots.forEach((s, j) => addBusy(map, `reuniao${i}x${j}`, s.start, s.end));
    const last = slots[slots.length - 1];
    if (i !== 1 && last) addBooking(map, last, names[i % 3]);
  });

  // Histórico: entrevistas das últimas 8 semanas, parte com presença registrada.
  const past = serviceDays(availability, now.minus({ weeks: 8 }).startOf("day"), now.minus({ days: 1 }));
  const pastNames = [
    "Carlos Eduardo Moraes",
    "Fernanda Lima",
    "Paulo Henrique Souza",
    "Luciana Martins",
    "Gabriel Rocha",
    "Sônia Batista",
  ];
  past.forEach((day, i) => {
    candidatesForDay(availability, day)
      .slice(0, 1 + (i % 2))
      .forEach((slot, j) => {
        const k = i + j;
        const compareceu: Attendance = i >= past.length - 3 ? null : k % 5 === 0 ? "nao" : "sim";
        addBooking(map, slot, pastNames[k % pastNames.length], true, compareceu);
      });
  });

  // Entrevistas hoje e amanhã para o painel de lembretes.
  const tomorrow = now.plus({ days: 1 }).startOf("day");
  addBooking(map, slotAt(tomorrow, 19, 0), "João Pedro Almeida", true);
  addBooking(map, slotAt(tomorrow, 19, 35), "Mariana Costa Silva");
  addBooking(map, slotAt(tomorrow, 20, 10), "Rafael Nunes");
  addBooking(map, slotAt(now.startOf("day"), 20, 0), "Beatriz Fontana");

  store.__mockCalendar = map;
  return map;
}

function slotAt(day: DateTime, hour: number, minute: number): Slot {
  const start = day.set({ hour, minute });
  return { start, end: start.plus({ minutes: availability.durationMinutes }) };
}

function addBusy(map: Map<string, MockEvent>, id: string, start: DateTime, end: DateTime) {
  map.set(id, { kind: "busy", id, start, end });
}

function addBooking(
  map: Map<string, MockEvent>,
  slot: Slot,
  nome: string,
  lembreteEnviado = false,
  compareceu: Attendance = null,
) {
  const id = `mock${slot.start.toFormat("yyyyMMddHHmm")}`;
  const telefone = `55419${String(Math.abs(hash(nome))).padStart(8, "0").slice(0, 8)}`;
  map.set(id, { kind: "booking", id, start: slot.start, end: slot.end, nome, telefone, lembreteEnviado, compareceu });
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

function overlapping(timeMin: DateTime, timeMax: DateTime): MockEvent[] {
  return [...events().values()]
    .filter((e) => e.start < timeMax && e.end > timeMin)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());
}

export async function mockBusy(timeMin: DateTime, timeMax: DateTime): Promise<BusyInterval[]> {
  await delay();
  // Aberturas são transparentes: não ocupam a agenda.
  return overlapping(timeMin, timeMax)
    .filter((e) => !(e.kind === "mark" && e.markKind === "opening"))
    .map((e) => ({ start: e.start.setZone(TZ), end: e.end.setZone(TZ) }));
}

export async function mockCreate(eventId: string, slot: Slot, nome: string, telefone: string): Promise<CreateBookingResult> {
  await delay();
  const map = events();
  if (map.has(eventId)) return { status: "taken" };
  map.set(eventId, {
    kind: "booking",
    id: eventId,
    start: slot.start,
    end: slot.end,
    nome,
    telefone,
    lembreteEnviado: false,
    compareceu: null,
  });
  return { status: "created", eventId };
}

export async function mockList(timeMin: DateTime, timeMax: DateTime): Promise<Booking[]> {
  await delay();
  return overlapping(timeMin, timeMax).flatMap((e) =>
    e.kind === "booking" && e.start >= timeMin
      ? [
          {
            eventId: e.id,
            start: e.start,
            end: e.end,
            nome: e.nome,
            telefone: e.telefone,
            lembreteEnviado: e.lembreteEnviado,
            lembreteEnviadoEm: e.lembreteEnviadoEm ?? null,
            compareceu: e.compareceu,
            origem: "site" as const,
          },
        ]
      : [],
  );
}

export async function mockMarkSent(eventId: string, at: DateTime): Promise<boolean> {
  await delay();
  const ev = events().get(eventId);
  if (ev?.kind !== "booking") return false;
  ev.lembreteEnviado = true;
  ev.lembreteEnviadoEm = at;
  return true;
}

export async function mockSetPhone(eventId: string, telefone: string): Promise<boolean> {
  await delay();
  const ev = events().get(eventId);
  if (ev?.kind !== "booking") return false;
  ev.telefone = telefone;
  return true;
}

export async function mockSetAttendance(eventId: string, value: Attendance): Promise<boolean> {
  await delay();
  const ev = events().get(eventId);
  if (ev?.kind !== "booking") return false;
  ev.compareceu = value;
  return true;
}

export async function mockCreateMark(markKind: MarkKind, start: DateTime, end: DateTime | null): Promise<Mark> {
  await delay();
  store.__mockSeq = (store.__mockSeq ?? 0) + 1;
  const id = `mrk${Date.now()}${store.__mockSeq}`;
  const allDay = end === null;
  const s = allDay ? start.setZone(TZ).startOf("day") : start;
  const e = allDay ? s.plus({ days: 1 }) : end;
  events().set(id, { kind: "mark", markKind, id, start: s, end: e, allDay });
  return { eventId: id, kind: markKind, start: s, end: e, allDay };
}

export async function mockListMarks(markKind: MarkKind, timeMin: DateTime, timeMax: DateTime): Promise<Mark[]> {
  await delay();
  return overlapping(timeMin, timeMax).flatMap((e) =>
    e.kind === "mark" && e.markKind === markKind
      ? [{ eventId: e.id, kind: markKind, start: e.start, end: e.end, allDay: e.allDay }]
      : [],
  );
}

export async function mockDeleteMark(markKind: MarkKind, eventId: string): Promise<boolean> {
  await delay();
  const ev = events().get(eventId);
  if (ev && !(ev.kind === "mark" && ev.markKind === markKind)) return false;
  events().delete(eventId);
  return true;
}
