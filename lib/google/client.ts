import "server-only";
import { google, type calendar_v3 } from "googleapis";
import { getGoogleEnv } from "../env";

let cached: { calendar: calendar_v3.Calendar; calendarId: string } | null = null;

/** Cliente da Calendar API autenticado com a service account (reaproveitado entre requisições). */
export function getCalendar(): { calendar: calendar_v3.Calendar; calendarId: string } {
  if (cached) return cached;
  const env = getGoogleEnv();
  const auth = new google.auth.JWT({
    email: env.clientEmail,
    key: env.privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  cached = { calendar: google.calendar({ version: "v3", auth }), calendarId: env.calendarId };
  return cached;
}

/** Status HTTP de um erro do googleapis (Gaxios), se houver. */
export function httpStatusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  for (const v of [e.status, e.response?.status, e.code]) {
    if (typeof v === "number") return v;
    if (typeof v === "string" && /^\d{3}$/.test(v)) return Number(v);
  }
  return undefined;
}
