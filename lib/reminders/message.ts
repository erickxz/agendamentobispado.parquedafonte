import type { DateTime } from "luxon";
import { LOCALE, TZ } from "../time";

export interface ReminderData {
  nome: string;
  start: DateTime;
  local: string;
}

/** Preenche o modelo da config: {nome}, {nomeCompleto}, {dia}, {data}, {hora}, {local}. */
export function buildReminderMessage(template: string, data: ReminderData): string {
  const start = data.start.setZone(TZ).setLocale(LOCALE);
  const values: Record<string, string> = {
    // Casais ("Adriana e Eric") ficam com o nome inteiro; pessoas, só o primeiro nome.
    nome: /\s(e|&)\s/i.test(data.nome) ? data.nome.trim() : (data.nome.trim().split(/\s+/)[0] ?? data.nome),
    nomeCompleto: data.nome.trim(),
    dia: start.toFormat("cccc"),
    data: start.toFormat("dd/MM"),
    hora: start.toFormat("HH:mm"),
    local: data.local,
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
