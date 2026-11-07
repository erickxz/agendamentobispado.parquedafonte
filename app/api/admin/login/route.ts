import { NextResponse, type NextRequest } from "next/server";
import { getAdminEnv } from "@/lib/env";
import { clientIp, isRateLimited, rateLimit } from "@/lib/rateLimit";
import { SESSION_COOKIE, createSessionToken, passwordMatches, sessionCookieOptions } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers) ?? "desconhecido";
  // Só senhas erradas contam para o limite; quem acerta nunca é bloqueado por ter entrado várias vezes.
  const limit = await isRateLimited("login", ip);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: `Senha errada muitas vezes seguidas. Aguarde ${Math.ceil(limit.retryAfterSeconds / 60)} min e tente de novo.`,
      },
      { status: 429 },
    );
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe a senha." }, { status: 400 });

  try {
    const { password, sessionSecret } = getAdminEnv();
    if (!(await passwordMatches(parsed.data.password, password, sessionSecret))) {
      console.warn("[admin/login] senha incorreta", { ip });
      await rateLimit("login", ip);
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, await createSessionToken(sessionSecret), sessionCookieOptions());
    return response;
  } catch (err) {
    console.error("[admin/login] configuração ausente", err);
    return NextResponse.json({ error: "Painel indisponível no momento." }, { status: 503 });
  }
}
