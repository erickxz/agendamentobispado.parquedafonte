import "server-only";
import { cookies } from "next/headers";
import { getAdminEnv } from "./env";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** Verificação no próprio handler/página, além do proxy (defesa em profundidade). */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value, getAdminEnv().sessionSecret);
}
