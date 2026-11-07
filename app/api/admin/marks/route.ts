import { NextResponse, type NextRequest } from "next/server";
import { availability } from "@/config/availability";
import { isAdmin } from "@/lib/adminAuth";
import { invalidateBusyCache } from "@/lib/google/freebusy";
import { createMark, deleteMark } from "@/lib/google/marks";
import { slotFromStart } from "@/lib/slots";
import { parseDate } from "@/lib/time";
import { markCreateSchema, markDeleteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const UNAUTHORIZED = { error: "Sessão expirada. Entre novamente." };

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * Cria uma marcação na agenda:
 * - { action: "block-slot", start } bloqueia um horário
 * - { action: "block-day", date } bloqueia o dia inteiro
 * - { action: "open", date, from, to } abre horários extras
 */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const parsed = markCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad("Dados inválidos.");
  const input = parsed.data;

  try {
    let mark;
    if (input.action === "block-slot") {
      const slot = slotFromStart(availability, input.start);
      if (!slot) return bad("Horário inválido.");
      mark = await createMark("block", slot.start, slot.end);
    } else if (input.action === "block-day") {
      const day = parseDate(input.date);
      if (!day.isValid) return bad("Data inválida.");
      mark = await createMark("block", day, null);
    } else {
      const day = parseDate(input.date);
      if (!day.isValid) return bad("Data inválida.");
      const [fh, fm] = input.from.split(":").map(Number);
      const [th, tm] = input.to.split(":").map(Number);
      const start = day.set({ hour: fh, minute: fm });
      const end = day.set({ hour: th, minute: tm });
      if (end.diff(start, "minutes").minutes < availability.durationMinutes) {
        return bad(`O período precisa ter pelo menos ${availability.durationMinutes} minutos.`);
      }
      mark = await createMark("opening", start, end);
    }
    invalidateBusyCache();
    return NextResponse.json({ eventId: mark.eventId }, { status: 201 });
  } catch (err) {
    console.error("[admin/marks] erro ao criar marcação", err);
    return NextResponse.json({ error: "Não foi possível salvar na agenda. Tente novamente." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const parsed = markDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad("Marcação inválida.");

  try {
    if (!(await deleteMark(parsed.data.kind, parsed.data.eventId))) {
      return bad("Esse evento não foi criado pelo painel.");
    }
    invalidateBusyCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/marks] erro ao remover marcação", err);
    return NextResponse.json({ error: "Não foi possível salvar na agenda. Tente novamente." }, { status: 503 });
  }
}
