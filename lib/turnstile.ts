import "server-only";
import { getTurnstileSecret, isProduction } from "./env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Valida o token do Cloudflare Turnstile no servidor. */
export async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = getTurnstileSecret();
  if (!secret) {
    if (isProduction) {
      console.error("[turnstile] TURNSTILE_SECRET_KEY ausente em produção");
      return false;
    }
    console.warn("[turnstile] sem TURNSTILE_SECRET_KEY — verificação ignorada em desenvolvimento");
    return true;
  }
  if (!token) return false;

  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body: form, signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) console.warn("[turnstile] token recusado", data["error-codes"]);
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] falha ao validar", err);
    return false;
  }
}
