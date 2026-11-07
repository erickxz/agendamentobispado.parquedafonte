import { NextResponse } from "next/server";
import { clearMemberCookie } from "@/lib/memberAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearMemberCookie(response);
  return response;
}
