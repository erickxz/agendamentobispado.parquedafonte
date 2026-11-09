import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { formatSentAt, listBookings } from "@/lib/google/events";
import { formatE164ForDisplay } from "@/lib/phone";
import type { AppointmentDto } from "@/lib/presenters";
import { prepareReminder } from "@/lib/reminders";
import { formatLongDate, formatTime, nowInTz } from "@/lib/time";
import { appointmentsQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const parsed = appointmentsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Período inválido." }, { status: 400 });

  const now = nowInTz();
  const today = now.startOf("day");
  const [timeMin, timeMax] =
    parsed.data.range === "today"
      ? [today, today.plus({ days: 1 })]
      : parsed.data.range === "tomorrow"
        ? [today.plus({ days: 1 }), today.plus({ days: 2 })]
        : [now, today.plus({ days: 8 })];

  try {
    const bookings = await listBookings(timeMin, timeMax);
    const items: AppointmentDto[] = bookings.map((b) => ({
      eventId: b.eventId,
      nome: b.nome,
      telefone: b.telefone ? formatE164ForDisplay(b.telefone) : "",
      origem: b.origem,
      dateLabel: formatLongDate(b.start),
      timeLabel: formatTime(b.start),
      lembreteEnviado: b.lembreteEnviado,
      lembreteEnviadoEm: b.lembreteEnviadoEm ? formatSentAt(b.lembreteEnviadoEm) : null,
      reminderUrl: prepareReminder(b, request.nextUrl.origin).url ?? null,
    }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin/appointments] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar as entrevistas. Tente novamente." }, { status: 503 });
  }
}
