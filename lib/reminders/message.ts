import { DateTime } from "luxon";
import { LOCALE, TZ } from "../time";

export interface ReminderData {
  nome: string;
  start: DateTime;
  local: string;
  /** Frase final: link para remarcar/cancelar, ou pedido para avisar por mensagem. */
  remarcar: string;
  /** Referência para "hoje"/"amanhã" (padrão: agora). */
  now?: DateTime;
}

/**
 * Preenche o modelo da config: {nome}, {nomeCompleto}, {quando}, {dia}, {diaData}, {data}, {hora},
 * {local}, {remarcar}.
 */
export function buildReminderMessage(template: string, data: ReminderData): string {
  const start = data.start.setZone(TZ).setLocale(LOCALE);
  const today = (data.now ?? DateTime.now()).setZone(TZ).startOf("day");
  const daysAway = Math.round(start.startOf("day").diff(today, "days").days);
  const dia = start.toFormat("cccc");
  const diaData = `${capitalize(dia)}, ${start.toFormat("dd/MM")}`;
  const values: Record<string, string> = {
    // Casais ("Adriana e Eric") ficam com o nome inteiro; pessoas, só o primeiro nome.
    nome: /\s(e|&)\s/i.test(data.nome) ? data.nome.trim() : (data.nome.trim().split(/\s+/)[0] ?? data.nome),
    nomeCompleto: data.nome.trim(),
    quando: daysAway === 0 ? "hoje" : daysAway === 1 ? "amanhã" : dia,
    dia,
    diaData,
    data: start.toFormat("dd/MM"),
    hora: start.toFormat("HH:mm"),
    local: data.local,
    remarcar: data.remarcar,
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
