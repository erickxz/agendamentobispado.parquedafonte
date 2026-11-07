import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getAdminEnv } from "./env";
import { MEMBER_COOKIE, createMemberToken, memberCookieOptions, verifyMemberToken } from "./session";

/**
 * Acesso do membro: só o telefone, sem senha (decisão da ala).
 * Usa o mesmo SESSION_SECRET do painel para assinar o cookie.
 */
export async function getMemberPhone(): Promise<string | null> {
  const store = await cookies();
  return verifyMemberToken(store.get(MEMBER_COOKIE)?.value, getAdminEnv().sessionSecret);
}

export async function setMemberCookie(response: NextResponse, phone: string): Promise<void> {
  response.cookies.set(MEMBER_COOKIE, await createMemberToken(phone, getAdminEnv().sessionSecret), memberCookieOptions());
}

export function clearMemberCookie(response: NextResponse): void {
  response.cookies.set(MEMBER_COOKIE, "", memberCookieOptions(0));
}
