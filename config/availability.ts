/**
 * Configuração de disponibilidade da ala.
 * Edite este arquivo para mudar dias, horários, duração e textos. Depois faça um novo deploy.
 *
 * Dias da semana seguem o padrão ISO (Luxon): 1 = segunda ... 6 = sábado, 7 = domingo.
 * Horários no formato "HH:mm", sempre no fuso America/Sao_Paulo.
 */

import { DateTime } from "luxon";

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WeeklyWindow {
  weekday: Weekday;
  start: string; // "HH:mm" — primeiro horário
  end: string; // "HH:mm" — a última entrevista precisa terminar até este horário
  /** Janela quinzenal: vale a cada N semanas, contando a partir de uma data em que há atendimento. */
  repeat?: { everyWeeks: number; startingFrom: string };
  /** Texto mostrado no painel nas semanas sem atendimento (ex.: "Reunião de conselho"). */
  offWeekNote?: string;
}

export type BlockedDate =
  | { date: string; reason?: string } // "YYYY-MM-DD"
  | { from: string; to: string; reason?: string }; // intervalo inclusivo

export interface AvailabilityConfig {
  timezone: string;
  windows: WeeklyWindow[];
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  daysAhead: number;
  blockedDates: BlockedDate[];
  location: { name: string; address: string };
  /**
   * Mensagem do lembrete por WhatsApp. Variáveis disponíveis:
   * {nome} (primeiro nome), {nomeCompleto}, {dia} (dia da semana), {data} (dd/mm), {hora}, {local}
   */
  reminderTemplate: string;
  /** WhatsApp do secretário em E.164 sem "+" (ex.: "5541999998888"). Vazio esconde o link de contato. */
  secretaryWhatsApp: string;
}

export const availability: AvailabilityConfig = {
  timezone: "America/Sao_Paulo",

  windows: [
    { weekday: 7, start: "09:00", end: "10:00" }, // domingo: 9:00 e 9:30
    { weekday: 2, start: "19:00", end: "21:30" }, // terça: 19:00 a 21:00 (última termina 21:30)
    {
      // quarta: 20:30 e 21:00, semana sim, semana não (na outra semana há reunião de conselho)
      weekday: 3,
      start: "20:30",
      end: "21:30",
      repeat: { everyWeeks: 2, startingFrom: "2026-11-11" },
      offWeekNote: "Reunião de conselho",
    },
  ],

  durationMinutes: 30,
  bufferMinutes: 0,
  minNoticeHours: 12,
  daysAhead: 21,

  blockedDates: [
    // Exemplos — ajuste conforme o calendário da estaca e da ala:
    { date: "2026-12-27", reason: "Domingo entre Natal e Ano-Novo" },
    // { from: "2027-04-03", to: "2027-04-04", reason: "Conferência geral" },
  ],

  location: {
    name: "Sede da Estaca Jardim Ipê",
    address: "Rua Tavares de Lyra, 1859 – Iná, São José dos Pinhais – PR, 83065-180",
  },

  reminderTemplate:
    "Olá, {nome}! Passando para lembrar da sua entrevista com o bispado {dia}, {data}, às {hora}, na {local}. Se não puder comparecer, é só avisar por aqui.",

  secretaryWhatsApp: "",
};

/** Texto do local em uma linha, usado no evento, no .ics e na tela. */
export function locationText(config: AvailabilityConfig = availability): string {
  return `${config.location.name} – ${config.location.address}`;
}

export function mapsUrl(config: AvailabilityConfig = availability): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.location.address)}`;
}

const WEEKDAY_PLURAL: Record<Weekday, string> = {
  1: "Segundas",
  2: "Terças",
  3: "Quartas",
  4: "Quintas",
  5: "Sextas",
  6: "Sábados",
  7: "Domingos",
};

/** ["Domingos, 09:00 às 09:30", ...] — horário do primeiro ao último início, domingo primeiro. */
export function scheduleSummary(config: AvailabilityConfig = availability): string[] {
  return [...config.windows]
    .sort((a, b) => (a.weekday % 7) - (b.weekday % 7) || a.start.localeCompare(b.start))
    .map((w) => {
      const lastStart = DateTime.fromFormat(w.end, "HH:mm").minus({ minutes: config.durationMinutes }).toFormat("HH:mm");
      const range = lastStart === w.start ? w.start : `${w.start} às ${lastStart}`;
      return `${WEEKDAY_PLURAL[w.weekday]}${w.repeat ? " (quinzenal)" : ""}, ${range}`;
    });
}
