import "server-only";
import { DateTime } from "luxon";
import type { BusyInterval } from "../slots";
import { TZ } from "../time";
import { getCalendar } from "./client";
import { isMockCalendar, mockBusy } from "./mock";

// Curto de propósito: mudanças feitas direto no Google Agenda aparecem no site em até ~10 s.
const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { expires: number; busy: BusyInterval[] }>();

/**
 * Blocos ocupados da agenda da ala no intervalo.
 * Eventos marcados como "Disponível" (transparentes) não aparecem como ocupados — comportamento do Google.
 * `fresh: true` ignora o cache (usado antes de criar o evento).
 */
export async function getBusyIntervals(
  timeMin: DateTime,
  timeMax: DateTime,
  options: { fresh?: boolean } = {},
): Promise<BusyInterval[]> {
  if (isMockCalendar()) return mockBusy(timeMin, timeMax);
  const key = `${timeMin.toMillis()}-${timeMax.toMillis()}`;
  const hit = cache.get(key);
  if (!options.fresh && hit && hit.expires > Date.now()) return hit.busy;

  const { calendar, calendarId } = getCalendar();
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toUTC().toISO()!,
      timeMax: timeMax.toUTC().toISO()!,
      timeZone: TZ,
      items: [{ id: calendarId }],
    },
  });

  const entry = res.data.calendars?.[calendarId];
  if (!entry) throw new Error("freebusy: agenda ausente na resposta");
  if (entry.errors?.length) {
    // Ex.: "notFound" quando a agenda não foi compartilhada com a service account.
    throw new Error(`freebusy: ${entry.errors.map((e) => e.reason).join(", ")}`);
  }

  const busy = (entry.busy ?? [])
    .filter((b) => b.start && b.end)
    .map((b) => ({
      start: DateTime.fromISO(b.start!, { setZone: true }).setZone(TZ),
      end: DateTime.fromISO(b.end!, { setZone: true }).setZone(TZ),
    }));

  if (cache.size > 50) cache.clear();
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, busy });
  return busy;
}

export function invalidateBusyCache(): void {
  cache.clear();
}
