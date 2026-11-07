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

/* ---------- Sessão do membro (entra só com o telefone) ---------- */

export const MEMBER_COOKIE = "ala_membro";
export const MEMBER_MAX_AGE_SECONDS = 60 * 24 * 60 * 60; // 60 dias: o membro não precisa entrar de novo a cada visita

/** Cookie "<telefone E.164>.<expiração>.<assinatura>". Assinado para ninguém trocar o telefone no navegador. */
export async function createMemberToken(phone: string, secret: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + MEMBER_MAX_AGE_SECONDS;
  return `${phone}.${exp}.${await hmac(secret, `member.${phone}.${exp}`)}`;
}

/** Telefone da sessão, ou null se o cookie for inválido/expirado. */
export async function verifyMemberToken(
  token: string | undefined,
  secret: string,
  nowMs = Date.now(),
): Promise<string | null> {
  if (!token) return null;
  const [phone, expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!phone || !/^\d{12,13}$/.test(phone) || !sig || !Number.isInteger(exp) || exp * 1000 < nowMs) return null;
  return constantTimeEqual(sig, await hmac(secret, `member.${phone}.${exp}`)) ? phone : null;
}

export function memberCookieOptions(maxAge = MEMBER_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" para o cookie ir junto quando o membro abre o site por um link (ex.: WhatsApp).
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
