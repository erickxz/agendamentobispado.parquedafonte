import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { setPhone } from "@/lib/google/events";
import { formatE164ForDisplay } from "@/lib/phone";
import { phoneUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Salva ou corrige o WhatsApp de uma entrevista. */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const parsed = phoneUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === "telefone");
    return NextResponse.json({ error: issue?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const ok = await setPhone(parsed.data.eventId, parsed.data.telefone);
    if (!ok) return NextResponse.json({ error: "Entrevista não encontrada." }, { status: 404 });
    return NextResponse.json({ telefone: formatE164ForDisplay(parsed.data.telefone) });
  } catch (err) {
    console.error("[admin/phone] erro ao atualizar evento", err);
    return NextResponse.json({ error: "Não foi possível salvar. Tente novamente." }, { status: 503 });
  }
}
