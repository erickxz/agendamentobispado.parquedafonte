import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { setAttendance } from "@/lib/google/events";
import { attendanceSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const parsed = attendanceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  try {
    const ok = await setAttendance(parsed.data.eventId, parsed.data.compareceu);
    if (!ok) return NextResponse.json({ error: "Entrevista não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/attendance] erro ao atualizar evento", err);
    return NextResponse.json({ error: "Não foi possível salvar. Tente novamente." }, { status: 503 });
  }
}
