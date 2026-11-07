import "server-only";
import { DateTime } from "luxon";
import type { calendar_v3 } from "googleapis";
import { TZ } from "../time";
import { getCalendar, httpStatusOf } from "./client";
import { isMockCalendar, mockCreateMark, mockDeleteMark, mockListMarks } from "./mock";

/**
 * Marcações feitas pelo painel, guardadas como eventos comuns na agenda da ala:
 * - "block":   "Bloqueado para entrevistas" (ocupado) — tira horários da lista do membro.
 * - "opening": "Aberto para entrevistas" (disponível/transparente) — acrescenta horários extras,
 *              ex.: quarta de conselho em que não houve reunião.
 * O bispo vê as marcações na agenda e pode apagá-las por lá; isso desfaz o efeito.
 */
export type MarkKind = "block" | "opening";

const SOURCE: Record<MarkKind, string> = {
  block: "agendamento-ala-bloqueio",
  opening: "agendamento-ala-abertura",
};

const TITLE: Record<MarkKind, string> = {
  block: "Bloqueado para entrevistas",
  opening: "Aberto para entrevistas",
};

const DESCRIPTION: Record<MarkKind, string> = {
  block: "Criado pelo painel da secretaria. Apague este evento para liberar o horário.",
  opening:
    "Criado pelo painel da secretaria. Os horários dentro deste evento ficam disponíveis para os membros marcarem. Apague para fechar.",
};

export interface Mark {
  eventId: string;
  kind: MarkKind;
  start: DateTime;
  end: DateTime;
  allDay: boolean;
}

const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { expires: number; marks: Mark[] }>();

/** Cria a marcação num intervalo ou, com `end` nulo, no dia inteiro (só bloqueio). */
export async function createMark(kind: MarkKind, start: DateTime, end: DateTime | null): Promise<Mark> {
  cache.clear();
  if (isMockCalendar()) return mockCreateMark(kind, start, end);
  const { calendar, calendarId } = getCalendar();
  const allDay = end === null;
  const day = start.setZone(TZ).startOf("day");

  const requestBody: calendar_v3.Schema$Event = {
    summary: TITLE[kind],
    description: DESCRIPTION[kind],
    // Bloqueio ocupa a agenda (inclusive o de dia inteiro, que por padrão seria "Disponível").
    // Abertura não pode ocupar, senão bloquearia os próprios horários que abre.
    transparency: kind === "block" ? "opaque" : "transparent",
    extendedProperties: { private: { source: SOURCE[kind] } },
    start: allDay ? { date: day.toISODate()! } : { dateTime: start.toISO()!, timeZone: TZ },
    end: allDay ? { date: day.plus({ days: 1 }).toISODate()! } : { dateTime: end.toISO()!, timeZone: TZ },
  };

  const res = await calendar.events.insert({ calendarId, requestBody });
  const mark = toMark(kind, res.data);
  if (!mark) throw new Error("marcação criada sem dados de horário");
  return mark;
}

export async function listMarks(
  kind: MarkKind,
  timeMin: DateTime,
  timeMax: DateTime,
  options: { fresh?: boolean } = {},
): Promise<Mark[]> {
  if (isMockCalendar()) return mockListMarks(kind, timeMin, timeMax);

  const key = `${kind}-${timeMin.toMillis()}-${timeMax.toMillis()}`;
  const hit = cache.get(key);
  if (!options.fresh && hit && hit.expires > Date.now()) return hit.marks;

  const { calendar, calendarId } = getCalendar();
  const marks: Mark[] = [];
  let pageToken: string | undefined;
  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toUTC().toISO()!,
      timeMax: timeMax.toUTC().toISO()!,
      privateExtendedProperty: [`source=${SOURCE[kind]}`],
      singleEvents: true,
      showDeleted: false,
      maxResults: 250,
      pageToken,
    });
    for (const ev of res.data.items ?? []) {
      const mark = toMark(kind, ev);
      if (mark) marks.push(mark);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  if (cache.size > 50) cache.clear();
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, marks });
  return marks;
}

/** Remove uma marcação. Só apaga eventos criados pelo painel com o tipo informado. */
export async function deleteMark(kind: MarkKind, eventId: string): Promise<boolean> {
  cache.clear();
  if (isMockCalendar()) return mockDeleteMark(kind, eventId);
  const { calendar, calendarId } = getCalendar();
  try {
    const ev = await calendar.events.get({ calendarId, eventId });
    if (ev.data.extendedProperties?.private?.source !== SOURCE[kind]) return false;
    if (ev.data.status === "cancelled") return true;
    await calendar.events.delete({ calendarId, eventId });
    return true;
  } catch (err) {
    const status = httpStatusOf(err);
    if (status === 404 || status === 410) return true; // já foi apagado (ex.: pelo bispo na agenda)
    throw err;
  }
}

function toMark(kind: MarkKind, ev: calendar_v3.Schema$Event): Mark | null {
  if (!ev.id || ev.status === "cancelled" || ev.extendedProperties?.private?.source !== SOURCE[kind]) return null;
  if (ev.start?.date && ev.end?.date) {
    return {
      eventId: ev.id,
      kind,
      start: DateTime.fromISO(ev.start.date, { zone: TZ }),
      end: DateTime.fromISO(ev.end.date, { zone: TZ }),
      allDay: true,
    };
  }
  if (ev.start?.dateTime && ev.end?.dateTime) {
    return {
      eventId: ev.id,
      kind,
      start: DateTime.fromISO(ev.start.dateTime, { setZone: true }).setZone(TZ),
      end: DateTime.fromISO(ev.end.dateTime, { setZone: true }).setZone(TZ),
      allDay: false,
    };
  }
  return null;
}
