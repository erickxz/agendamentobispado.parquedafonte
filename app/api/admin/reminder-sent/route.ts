import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { formatSentAt, markReminderSent } from "@/lib/google/events";
import { nowInTz } from "@/lib/time";
import { reminderSentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const parsed = reminderSentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Entrevista inválida." }, { status: 400 });

  try {
    const at = nowInTz();
    const ok = await markReminderSent(parsed.data.eventId, at);
    if (!ok) return NextResponse.json({ error: "Entrevista não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true, enviadoEm: formatSentAt(at) });
  } catch (err) {
    console.error("[admin/reminder-sent] erro ao atualizar evento", err);
    return NextResponse.json({ error: "Não foi possível marcar como enviado. Tente novamente." }, { status: 503 });
  }
}
