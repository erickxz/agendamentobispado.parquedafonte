import type { ReminderChannel } from "./index";

/**
 * Canal atual: abre o WhatsApp do secretário com a mensagem pronta. Custo zero, envio manual.
 * Sem telefone (entrevista criada à mão), o WhatsApp abre para escolher o contato.
 */
export const waMeChannel: ReminderChannel = {
  kind: "link",
  prepare({ telefone, message }) {
    return { url: `https://wa.me/${telefone}?text=${encodeURIComponent(message)}` };
  },
};
