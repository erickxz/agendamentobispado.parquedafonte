/**
 * Sessão do painel admin: cookie com "<expiração>.<assinatura HMAC>".
 * Usa Web Crypto para funcionar tanto no proxy quanto nos route handlers.
 * Sem "server-only" porque o proxy também importa este módulo; nunca importar em componentes de cliente.
 */

export const SESSION_COOKIE = "ala_admin";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(secret: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS;
  return `${exp}.${await hmac(secret, `admin.${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, nowMs = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isInteger(exp) || exp * 1000 < nowMs) return false;
  return constantTimeEqual(sig, await hmac(secret, `admin.${exp}`));
}

/** Compara a senha sem vazar tempo (compara as HMACs, que têm o mesmo tamanho). */
export async function passwordMatches(input: string, expected: string, secret: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmac(secret, `pw.${input}`), hmac(secret, `pw.${expected}`)]);
  return constantTimeEqual(a, b);
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}
