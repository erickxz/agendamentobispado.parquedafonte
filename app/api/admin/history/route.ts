import { NextResponse, type NextRequest } from "next/server";
import { DateTime } from "luxon";
import { isAdmin } from "@/lib/adminAuth";
import { listBookings } from "@/lib/google/events";
import { formatE164ForDisplay } from "@/lib/phone";
import type { HistoryItemDto } from "@/lib/presenters";
import { LOCALE, TZ, formatTime, nowInTz } from "@/lib/time";
import { historyQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Entrevistas já realizadas no mês (até agora), da mais recente para a mais antiga. */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const parsed = historyQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Mês inválido." }, { status: 400 });

  const now = nowInTz();
  const month = parsed.data.month
    ? DateTime.fromFormat(parsed.data.month, "yyyy-MM", { zone: TZ })
    : now.startOf("month");
  if (!month.isValid || month > now) return NextResponse.json({ error: "Mês inválido." }, { status: 400 });

  const end = DateTime.min(month.plus({ months: 1 }), now);

  try {
    const bookings = await listBookings(month, end);
    const items: HistoryItemDto[] = bookings
      .filter((b) => b.start < now)
      .reverse()
      .map((b) => ({
        eventId: b.eventId,
        nome: b.nome,
        telefone: b.telefone ? formatE164ForDisplay(b.telefone) : "Sem telefone",
        dateLabel: b.start.setLocale(LOCALE).toFormat("ccc, dd/MM").replace(".", ""),
        timeLabel: formatTime(b.start),
        compareceu: b.compareceu,
      }));
    return NextResponse.json(
      {
        month: month.toFormat("yyyy-MM"),
        monthLabel: month.setLocale(LOCALE).toFormat("LLLL 'de' yyyy"),
        hasNext: month.plus({ months: 1 }) <= now,
        items,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[admin/history] erro ao listar", err);
    return NextResponse.json({ error: "Não foi possível carregar o histórico. Tente novamente." }, { status: 503 });
  }
}
