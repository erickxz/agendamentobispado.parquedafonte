import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getUpstashEnv, isProduction } from "./env";

type Bucket = "book" | "login";

const LIMITS: Record<Bucket, { max: number; windowSeconds: number }> = {
  book: { max: 5, windowSeconds: 10 * 60 }, // 5 agendamentos a cada 10 min por IP
  login: { max: 10, windowSeconds: 15 * 60 }, // 10 senhas erradas a cada 15 min por IP (acertos não contam)
};

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

let upstash: Record<Bucket, Ratelimit> | null | undefined;

function getUpstash(): Record<Bucket, Ratelimit> | null {
  if (upstash !== undefined) return upstash;
  const env = getUpstashEnv();
  if (!env) {
    if (isProduction) console.warn("[rate-limit] Upstash não configurado — usando memória (não compartilhada entre instâncias)");
    upstash = null;
    return null;
  }
  const redis = new Redis({ url: env.url, token: env.token });
  const make = (bucket: Bucket) =>
    new Ratelimit({
      redis,
      prefix: `ala-agendamento:${bucket}`,
      limiter: Ratelimit.slidingWindow(LIMITS[bucket].max, `${LIMITS[bucket].windowSeconds} s`),
    });
  upstash = { book: make("book"), login: make("login") };
  return upstash;
}

// Fallback em memória (desenvolvimento): janela deslizante simples por chave.
const memory = new Map<string, number[]>();

function memoryLimit(bucket: Bucket, key: string): RateLimitResult {
  const { max, windowSeconds } = LIMITS[bucket];
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const id = `${bucket}:${key}`;
  const hits = (memory.get(id) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    memory.set(id, hits);
    return { ok: false, retryAfterSeconds: Math.ceil((hits[0] + windowMs - now) / 1000) };
  }
  hits.push(now);
  memory.set(id, hits);
  if (memory.size > 5000) memory.clear();
  return { ok: true, retryAfterSeconds: 0 };
}

export async function rateLimit(bucket: Bucket, key: string): Promise<RateLimitResult> {
  const limiter = getUpstash();
  if (!limiter) return memoryLimit(bucket, key);
  try {
    const res = await limiter[bucket].limit(key);
    return { ok: res.success, retryAfterSeconds: Math.max(0, Math.ceil((res.reset - Date.now()) / 1000)) };
  } catch (err) {
    // Se o Redis cair, não bloqueia o membro; o Turnstile continua protegendo.
    console.error("[rate-limit] erro no Upstash, usando memória", err);
    return memoryLimit(bucket, key);
  }
}

/** Consulta se a chave já estourou o limite, sem contar uma nova tentativa. */
export async function isRateLimited(bucket: Bucket, key: string): Promise<RateLimitResult> {
  const limiter = getUpstash();
  if (limiter) {
    try {
      const { remaining, reset } = await limiter[bucket].getRemaining(key);
      return { ok: remaining > 0, retryAfterSeconds: Math.max(0, Math.ceil((reset - Date.now()) / 1000)) };
    } catch (err) {
      console.error("[rate-limit] erro no Upstash, usando memória", err);
    }
  }
  const { max, windowSeconds } = LIMITS[bucket];
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const hits = (memory.get(`${bucket}:${key}`) ?? []).filter((t) => now - t < windowMs);
  if (hits.length < max) return { ok: true, retryAfterSeconds: 0 };
  return { ok: false, retryAfterSeconds: Math.ceil((hits[0] + windowMs - now) / 1000) };
}

/** IP do cliente atrás do proxy da Vercel. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || null;
  return headers.get("x-real-ip");
}
