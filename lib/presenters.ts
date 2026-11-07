import type { DaySlots } from "./slots";
import { formatLongDate, formatMonthShort, formatTime, formatWeekdayShort, parseDate } from "./time";

/** Formatos enviados ao navegador. Os textos de data já vêm prontos do servidor, no fuso da ala. */
export interface SlotDto {
  start: string; // ISO com offset -03:00
  time: string; // "12:00"
  endTime: string; // "12:15"
}

export interface DayDto {
  date: string; // YYYY-MM-DD
  label: string; // "domingo, 8 de novembro"
  weekday: string; // "dom"
  day: string; // "8"
  month: string; // "nov"
  monthLabel: string; // "novembro de 2026"
  slots: SlotDto[];
}

export interface BookingConfirmationDto {
  start: string;
  dateLabel: string;
  timeLabel: string;
  endTimeLabel: string;
  weekday: string;
  day: string;
  month: string;
  location: string;
  mapsUrl: string;
  googleCalendarUrl: string;
  icsUrl: string;
}

export function toDayDto(day: DaySlots): DayDto {
  const dt = parseDate(day.date);
  return {
    date: day.date,
    label: formatLongDate(dt),
    weekday: formatWeekdayShort(dt),
    day: String(dt.day),
    month: formatMonthShort(dt),
    monthLabel: dt.setLocale("pt-BR").toFormat("LLLL 'de' yyyy"),
    slots: day.slots.map((s) => ({ start: s.start.toISO()!, time: formatTime(s.start), endTime: formatTime(s.end) })),
  };
}

export interface AppointmentDto {
  eventId: string;
  nome: string;
  telefone: string; // "(41) 99999-8888" ou "" quando o evento não tem telefone
  origem: "site" | "manual";
  dateLabel: string;
  timeLabel: string;
  lembreteEnviado: boolean;
  lembreteEnviadoEm: string | null; // "06/11 às 21:40"
  reminderUrl: string | null;
}

export type AdminSlotStatus = "free" | "booked" | "blocked" | "busy" | "closed";

export interface AdminSlotDto {
  start: string;
  time: string;
  endTime: string;
  status: AdminSlotStatus;
  nome?: string; // entrevista marcada
  bookingId?: string; // uma entrevista longa ocupa vários horários com o mesmo bookingId
  blockId?: string; // bloqueio só deste horário (removível)
}

export interface AdminDayDto {
  date: string;
  label: string;
  dayBlockId: string | null; // bloqueio do dia inteiro feito pelo painel
  /** Horários extras abertos pelo painel neste dia. */
  openings: { eventId: string; label: string }[];
  /** Semana sem atendimento (janela quinzenal), com o horário que pode ser aberto. */
  offWeek: { note: string; from: string; to: string } | null;
  configBlocked: boolean; // bloqueado em config/availability.ts
  slots: AdminSlotDto[];
}

export interface HistoryItemDto {
  eventId: string;
  nome: string;
  telefone: string;
  dateLabel: string; // "dom, 02/11"
  timeLabel: string;
  compareceu: "sim" | "nao" | null;
}

/** Entrevista vista pelo próprio membro (quem entrou com o telefone usado ao marcar). */
export interface MemberAppointmentDto {
  eventId: string;
  nome: string; // nome informado ao marcar (o mesmo WhatsApp pode marcar para pessoas diferentes da família)
  start: string;
  dateLabel: string; // "domingo, 8 de novembro"
  timeLabel: string;
  endTimeLabel: string;
  weekday: string;
  day: string;
  month: string;
  location: string;
  mapsUrl: string;
  googleCalendarUrl: string;
  icsUrl: string;
  /** false para entrevistas criadas pelo bispado direto na agenda: só o secretário muda. */
  canChange: boolean;
}
