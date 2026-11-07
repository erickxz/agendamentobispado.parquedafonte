import type { DateTime } from "luxon";
import { TZ } from "./time";

/**
 * O Google Agenda aceita IDs em base32hex: letras minúsculas a–v e dígitos 0–9, de 5 a 1024 caracteres.
 * O prefixo "agd" usa só letras válidas e o restante são dígitos da data/hora no fuso da ala.
 */
const PREFIX = "agd";
const VALID_ID = /^[a-v0-9]{5,1024}$/;

/**
 * ID determinístico do slot. Dois pedidos simultâneos para o mesmo horário geram o mesmo ID,
 * e o Google rejeita o segundo com 409.
 * `attempt` > 0 só é usado quando o ID original está preso a um evento que foi movido para outro horário.
 */
export function eventIdForSlot(start: DateTime, attempt = 0): string {
  const base = PREFIX + start.setZone(TZ).toFormat("yyyyMMddHHmm");
  const id = attempt > 0 ? `${base}v${attempt}` : base;
  if (!VALID_ID.test(id)) throw new Error(`ID de evento inválido: ${id}`);
  return id;
}

export function isValidEventId(id: string): boolean {
  return VALID_ID.test(id);
}
