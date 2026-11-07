import { NextResponse, type NextRequest } from "next/server";
import { setMemberCookie } from "@/lib/memberAuth";
import { clientIp } from "@/lib/rateLimit";
import { memberLoginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Entrar na área do membro só com o telefone (sem senha, decisão da ala).
 * Sem limite de consultas (decisão da ala); só o honeypot barra bots simples.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);

  const parsed = memberLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === "telefone");
    return error(400, issue?.message ?? "Não foi possível ler os dados enviados. Recarregue a página.");
  }
  const { telefone, website } = parsed.data;

  if (website) {
    console.warn("[member/login] honeypot preenchido", { ip });
    return error(400, "Não foi possível entrar. Recarregue a página e tente novamente.");
  }

  try {
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    await setMemberCookie(response, telefone);
    return response;
  } catch (err) {
    console.error("[member/login] configuração ausente", err);
    return error(503, "Indisponível no momento. Tente novamente mais tarde.");
  }
}
