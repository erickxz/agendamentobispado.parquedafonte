import "server-only";
import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import type { calendar_v3 } from "googleapis";
import { availability, locationText } from "@/config/availability";
import { eventIdForSlot } from "../eventId";
import { formatE164ForDisplay, toE164 } from "../phone";
import type { Slot } from "../slots";
import { TZ } from "../time";
import { getCalendar, httpStatusOf } from "./client";
import { isMockCalendar, mockCreate, mockList, mockMarkSent, mockSetAttendance, mockSetPhone } from "./mock";

export const EVENT_SOURCE = "agendamento-ala";
const MAX_ID_ATTEMPTS = 5;

/** Dados guardados em extendedProperties.private (só visíveis para quem edita a agenda). */
export interface BookingPrivateProps {
  source: typeof EVENT_SOURCE;
  nome: string;
  telefone: string; // E.164 sem "+"
  lembreteEnviado: "true" | "false";
  /** Reservado para a v2 (link de cancelar/remarcar). Ainda não é exposto a ninguém. */
  cancelToken: string;
}

export interface Booking {
  eventId: string;
  start: DateTime;
  end: DateTime;
  nome: string;
  telefone: string;
  lembreteEnviado: boolean;
  /** Quando o último lembrete foi enviado (null em lembretes antigos, de antes de guardar o horário). */
  lembreteEnviadoEm: DateTime | null;
  /** Presença registrada no histórico: "sim", "nao" ou null (não registrado). */
  compareceu: Attendance;
  /** "site": marcada pelo sistema. "manual": evento criado direto na agenda com título "Entrevista ...". */
  origem: "site" | "manual";
}

export type Attendance = "sim" | "nao" | null;

export type CreateBookingResult = { status: "created"; eventId: string } | { status: "taken" };

function buildEventBody(slot: Slot, nome: string, telefone: string): calendar_v3.Schema$Event {
  const privateProps: BookingPrivateProps = {
    source: EVENT_SOURCE,
    nome,
    telefone,
    lembreteEnviado: "false",
    cancelToken: randomBytes(18).toString("base64url"),
  };
  return {
    // Nunca incluir o motivo da entrevista no título ou na descrição.
    summary: `Entrevista – ${nome}`,
    description: `Nome: ${nome}\nTelefone: ${formatE164ForDisplay(telefone)}\n\nAgendado pelo sistema da ala`,
    location: locationText(availability),
    start: { dateTime: slot.start.toISO()!, timeZone: TZ },
    end: { dateTime: slot.end.toISO()!, timeZone: TZ },
    transparency: "opaque",
    status: "confirmed",
    extendedProperties: { private: { ...privateProps } },
    // Sem attendees: service account sem delegação de domínio não pode convidar participantes.
  };
}

/**
 * Cria o evento com ID determinístico. Se dois membros tentarem o mesmo horário ao mesmo tempo,
 * o Google aceita só o primeiro (o segundo recebe 409).
 *
 * Casos especiais do 409:
 * - Evento com esse ID foi excluído (status "cancelled"): o Google mantém o ID reservado, então
 *   reativamos o evento com If-Match para não sobrescrever uma reativação concorrente.
 * - Evento com esse ID foi movido para outro horário: o slot está livre, então tentamos um ID com sufixo.
 */
export async function createBookingEvent(slot: Slot, nome: string, telefone: string): Promise<CreateBookingResult> {
  if (isMockCalendar()) return mockCreate(eventIdForSlot(slot.start), slot, nome, telefone);
  const { calendar, calendarId } = getCalendar();
  const body = buildEventBody(slot, nome, telefone);

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const eventId = eventIdForSlot(slot.start, attempt);

    try {
      await calendar.events.insert({ calendarId, requestBody: { ...body, id: eventId } });
      return { status: "created", eventId };
    } catch (err) {
      if (httpStatusOf(err) !== 409) throw err;
    }

    const existing = await getEventOrNull(calendar, calendarId, eventId);
    if (!existing) return { status: "taken" };

    if (existing.status === "cancelled") {
      try {
        await calendar.events.update(
          { calendarId, eventId, requestBody: { ...body, id: eventId } },
          { headers: { "If-Match": existing.etag ?? "*" } },
        );
        return { status: "created", eventId };
      } catch (err) {
        const status = httpStatusOf(err);
        if (status === 409 || status === 412) return { status: "taken" };
        throw err;
      }
    }

    const existingStart = existing.start?.dateTime
      ? DateTime.fromISO(existing.start.dateTime, { setZone: true }).toMillis()
      : null;
    if (existingStart === slot.start.toMillis()) return { status: "taken" };
    // O evento dono deste ID foi movido; tenta o próximo sufixo.
  }

  return { status: "taken" };
}

async function getEventOrNull(calendar: calendar_v3.Calendar, calendarId: string, eventId: string) {
  try {
    const res = await calendar.events.get({ calendarId, eventId });
    return res.data;
  } catch (err) {
    if (httpStatusOf(err) === 404 || httpStatusOf(err) === 410) return null;
    throw err;
  }
}

const INTERVIEW_TITLE = /^\s*entrevista\b/i;

/** Entrevista marcada pelo site ou criada à mão na agenda com título começando por "Entrevista". */
function isInterview(ev: calendar_v3.Schema$Event): boolean {
  return ev.extendedProperties?.private?.source === EVENT_SOURCE || INTERVIEW_TITLE.test(ev.summary ?? "");
}

/** "Entrevista – Adriana e Eric" / "Entrevista com Nairobi" → "Adriana e Eric" / "Nairobi" */
function nameFromTitle(summary: string): string {
  return summary.replace(/^\s*entrevista\s*[-–—:]?\s*(com\s+)?/i, "").trim() || summary.trim();
}

/** Procura um telefone brasileiro na descrição ou no local do evento (eventos criados à mão). */
function phoneFromText(text: string): string {
  for (const match of text.match(/(?:\+?55\s*)?\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]?\d{4}/g) ?? []) {
    const e164 = toE164(match);
    if (e164) return e164;
  }
  return "";
}

function toBooking(ev: calendar_v3.Schema$Event): Booking | null {
  if (!ev.id || !ev.start?.dateTime || !ev.end?.dateTime || ev.status === "cancelled" || !isInterview(ev)) return null;
  const props = ev.extendedProperties?.private ?? {};
  const fromSite = props.source === EVENT_SOURCE;
  return {
    eventId: ev.id,
    start: DateTime.fromISO(ev.start.dateTime, { setZone: true }).setZone(TZ),
    end: DateTime.fromISO(ev.end.dateTime, { setZone: true }).setZone(TZ),
    nome: props.nome || nameFromTitle(ev.summary ?? ""),
    telefone: props.telefone || phoneFromText(`${ev.description ?? ""} ${ev.location ?? ""}`),
    lembreteEnviado: props.lembreteEnviado === "true",
    lembreteEnviadoEm: props.lembreteEnviadoEm ? DateTime.fromISO(props.lembreteEnviadoEm).setZone(TZ) : null,
    compareceu: props.compareceu === "sim" || props.compareceu === "nao" ? props.compareceu : null,
    origem: fromSite ? "site" : "manual",
  };
}

/** Entrevistas do intervalo (marcadas pelo site ou criadas à mão), em ordem de horário. */
export async function listBookings(timeMin: DateTime, timeMax: DateTime): Promise<Booking[]> {
  if (isMockCalendar()) return mockList(timeMin, timeMax);
  const { calendar, calendarId } = getCalendar();
  const bookings: Booking[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toUTC().toISO()!,
      timeMax: timeMax.toUTC().toISO()!,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false,
      maxResults: 250,
      pageToken,
    });
    for (const ev of res.data.items ?? []) {
      const booking = toBooking(ev);
      if (booking) bookings.push(booking);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return bookings;
}

/**
 * Troca a linha "Rótulo: ..." da descrição, ou acrescenta no fim se ainda não existir.
 * `aliases` são rótulos antigos/equivalentes: se um deles já estiver na descrição, a linha dele é trocada
 * (mantendo o rótulo original), para não deixar duas linhas com a mesma informação.
 * `value` null remove a linha.
 */
function upsertDescriptionLine(
  description: string,
  label: string,
  value: string | null,
  aliases: string[] = [],
): string {
  if (value === null) return description.replace(new RegExp(`^${label}: .*(\\r?\\n|$)`, "m"), "").trimEnd();
  for (const l of [label, ...aliases]) {
    const re = new RegExp(`^${l}: .*$`, "m");
    if (re.test(description)) return description.replace(re, `${l}: ${value}`);
  }
  return [description.trimEnd(), `${label}: ${value}`].filter(Boolean).join("\n");
}

/**
 * Atualiza propriedades privadas de uma entrevista, preservando as demais.
 * `descriptionLine` também grava a informação na descrição, para o bispo ver na própria agenda.
 */
async function patchBookingProps(
  eventId: string,
  changes: Record<string, string>,
  descriptionLine?: { label: string; value: string | null; aliases?: string[] },
): Promise<boolean> {
  const { calendar, calendarId } = getCalendar();
  const existing = await getEventOrNull(calendar, calendarId, eventId);
  if (!existing || existing.status === "cancelled" || !isInterview(existing)) return false;

  const requestBody: calendar_v3.Schema$Event = {
    extendedProperties: { private: { ...existing.extendedProperties?.private, ...changes } },
  };
  if (descriptionLine) {
    requestBody.description = upsertDescriptionLine(
      existing.description ?? "",
      descriptionLine.label,
      descriptionLine.value,
      descriptionLine.aliases,
    );
  }
  await calendar.events.patch({ calendarId, eventId, requestBody });
  return true;
}

/** Registra o envio do lembrete com data e hora (um novo envio atualiza o horário). */
export async function markReminderSent(eventId: string, at: DateTime): Promise<boolean> {
  if (isMockCalendar()) return mockMarkSent(eventId, at);
  return patchBookingProps(
    eventId,
    { lembreteEnviado: "true", lembreteEnviadoEm: at.toUTC().toISO()! },
    { label: "Lembrete enviado", value: formatSentAt(at) },
  );
}

/** "06/11 às 21:40" */
export function formatSentAt(at: DateTime): string {
  return at.setZone(TZ).toFormat("dd/MM 'às' HH:mm");
}

/**
 * Salva ou corrige o WhatsApp de uma entrevista (campo interno + linha na descrição do evento).
 * Entrevistas do site já têm "Telefone: ..." na descrição; nesse caso essa linha é atualizada.
 */
export async function setPhone(eventId: string, e164: string): Promise<boolean> {
  if (isMockCalendar()) return mockSetPhone(eventId, e164);
  return patchBookingProps(
    eventId,
    { telefone: e164 },
    { label: "WhatsApp", value: formatE164ForDisplay(e164), aliases: ["Telefone"] },
  );
}

/**
 * Registra se o membro compareceu (histórico): campo interno + linha "Compareceu: Sim/Não" na descrição,
 * para o bispo ver na própria agenda. `null` limpa o registro e remove a linha.
 */
export async function setAttendance(eventId: string, value: Attendance): Promise<boolean> {
  if (isMockCalendar()) return mockSetAttendance(eventId, value);
  return patchBookingProps(
    eventId,
    { compareceu: value ?? "" },
    { label: "Compareceu", value: value === "sim" ? "Sim" : value === "nao" ? "Não" : null },
  );
}
