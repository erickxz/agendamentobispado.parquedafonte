import { DateTime } from "luxon";

/** Fuso fixo da ala. Nunca usar o fuso do servidor. */
export const TZ = "America/Sao_Paulo";
export const LOCALE = "pt-BR";

export function nowInTz(): DateTime {
  return DateTime.now().setZone(TZ);
}

/** Interpreta "YYYY-MM-DD" como um dia no fuso da ala. */
export function parseDate(isoDate: string): DateTime {
  return DateTime.fromISO(isoDate, { zone: TZ }).startOf("day");
}

/** Interpreta um ISO com offset (ou Z) e converte para o fuso da ala. */
export function parseInstant(iso: string): DateTime {
  return DateTime.fromISO(iso, { setZone: true }).setZone(TZ);
}

export function toDateKey(dt: DateTime): string {
  return dt.setZone(TZ).toISODate()!;
}

/** "domingo, 8 de novembro" */
export function formatLongDate(dt: DateTime): string {
  return dt.setZone(TZ).setLocale(LOCALE).toFormat("cccc, d 'de' LLLL");
}

/** "12:00" */
export function formatTime(dt: DateTime): string {
  return dt.setZone(TZ).toFormat("HH:mm");
}

/** "dom", "seg"... sem o ponto que o Intl acrescenta. */
export function formatWeekdayShort(dt: DateTime): string {
  return dt.setZone(TZ).setLocale(LOCALE).toFormat("ccc").replace(".", "");
}

/** "nov", "dez"... */
export function formatMonthShort(dt: DateTime): string {
  return dt.setZone(TZ).setLocale(LOCALE).toFormat("LLL").replace(".", "");
}
