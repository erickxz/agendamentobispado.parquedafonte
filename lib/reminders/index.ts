import { availability } from "@/config/availability";
import type { Booking } from "../google/events";
import { buildReminderMessage } from "./message";
import { waMeChannel } from "./waMe";

/**
 * Ponto único de envio de lembretes.
 * Hoje: "link" — o painel abre o wa.me e o secretário envia manualmente.
 * Futuro: um canal "automatic" (ex.: API oficial do WhatsApp) implementa `send` e o painel/cron
 * passa a chamá-lo, sem mudar o restante do sistema.
 */
export interface ReminderChannel {
  kind: "link" | "automatic";
  prepare(input: { telefone: string; message: string }): { url?: string };
  send?(input: { telefone: string; message: string }): Promise<void>;
}

export const reminderChannel: ReminderChannel = waMeChannel;

/**
 * `siteUrl` (ex.: "https://agendamento.exemplo.com"): endereço do site, para o link de remarcar/cancelar.
 * Entrevistas criadas à mão na agenda não podem ser mudadas pelo site, então pedem para avisar por mensagem.
 */
export function prepareReminder(booking: Booking, siteUrl?: string): { message: string; url?: string } {
  const canSelfServe = booking.origem === "site" && booking.telefone && siteUrl;
  const remarcar = canSelfServe
    ? `🔁 Não vai conseguir ir? Remarque ou cancele aqui:\n${memberLink(siteUrl, booking.telefone)}`
    : "Se não puder comparecer, é só avisar por aqui. 🙏";
  const message = buildReminderMessage(availability.reminderTemplate, {
    nome: booking.nome,
    start: booking.start,
    local: `${availability.location.name}\n${availability.location.address}`,
    remarcar,
  });
  return { message, ...reminderChannel.prepare({ telefone: booking.telefone, message }) };
}

/** Link de Minhas entrevistas já com o número da pessoa (sem o 55), para ela entrar direto. */
export function memberLink(siteUrl: string, e164: string): string {
  const national = e164.startsWith("55") ? e164.slice(2) : e164;
  return `${siteUrl.replace(/\/+$/, "")}/minhas-entrevistas?tel=${national}`;
}
