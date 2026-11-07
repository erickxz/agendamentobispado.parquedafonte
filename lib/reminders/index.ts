import { availability, locationText } from "@/config/availability";
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

export function prepareReminder(booking: Booking): { message: string; url?: string } {
  const message = buildReminderMessage(availability.reminderTemplate, {
    nome: booking.nome,
    start: booking.start,
    local: locationText(availability),
  });
  return { message, ...reminderChannel.prepare({ telefone: booking.telefone, message }) };
}
