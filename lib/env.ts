import "server-only";
import { z } from "zod";

/** Leitura das variáveis de ambiente, feita sob demanda para o build não exigir credenciais. */

const googleSchema = z.object({
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  GOOGLE_PRIVATE_KEY: z.string().min(100),
  GOOGLE_CALENDAR_ID: z.string().min(5),
});

const adminSchema = z.object({
  ADMIN_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(32),
});

/**
 * A chave privada costuma chegar com "\n" literais (Vercel, .env) e às vezes entre aspas.
 * Converte para quebras de linha reais, que é o formato esperado pela biblioteca.
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

export function getGoogleEnv() {
  const env = googleSchema.parse(process.env);
  return {
    clientEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: normalizePrivateKey(env.GOOGLE_PRIVATE_KEY),
    calendarId: env.GOOGLE_CALENDAR_ID,
  };
}

export function getAdminEnv() {
  const env = adminSchema.parse(process.env);
  return { password: env.ADMIN_PASSWORD, sessionSecret: env.SESSION_SECRET };
}

export function getTurnstileSecret(): string | null {
  return process.env.TURNSTILE_SECRET_KEY || null;
}

export function getTurnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY || null;
}

export function getUpstashEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/** Gmail usado para avisar o secretário por e-mail. null = avisos desligados. */
export function getMailEnv(): { user: string; pass: string; to: string[] } | null {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ""); // a senha de app vem com espaços: "abcd efgh ..."
  const to = (process.env.NOTIFY_EMAIL_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return user && pass && to.length > 0 ? { user, pass, to } : null;
}

export const isProduction = process.env.NODE_ENV === "production";
