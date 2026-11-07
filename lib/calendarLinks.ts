import type { DateTime } from "luxon";

export interface CalendarEntry {
  uid: string;
  title: string;
  start: DateTime;
  end: DateTime;
  location: string;
  description: string;
}

function utcStamp(dt: DateTime): string {
  return dt.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
}

/** Link "Adicionar ao Google Agenda" (agenda pessoal do membro). */
export function googleCalendarUrl(entry: Omit<CalendarEntry, "uid">): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: entry.title,
    dates: `${utcStamp(entry.start)}/${utcStamp(entry.end)}`,
    location: entry.location,
    details: entry.description,
    ctz: "America/Sao_Paulo",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Dobra linhas com mais de 75 octetos, como pede a RFC 5545. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // linhas de continuação começam com espaço
    if (size + charSize > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Arquivo .ics com dois alarmes: 1 dia antes e 1 hora antes. */
export function buildIcs(entry: CalendarEntry, now: DateTime): string {
  const alarm = (trigger: string, text: string) => [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(text)}`,
    `TRIGGER:${trigger}`,
    "END:VALARM",
  ];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ala Parque da Fonte//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${entry.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(entry.start)}`,
    `DTEND:${utcStamp(entry.end)}`,
    `SUMMARY:${escapeText(entry.title)}`,
    `LOCATION:${escapeText(entry.location)}`,
    `DESCRIPTION:${escapeText(entry.description)}`,
    ...alarm("-P1D", `Amanhã: ${entry.title}`),
    ...alarm("-PT1H", `Em 1 hora: ${entry.title}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(fold).join("\r\n") + "\r\n";
}
