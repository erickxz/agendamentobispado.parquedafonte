import { NextResponse, type NextRequest } from "next/server";
import { DateTime } from "luxon";
import { availability } from "@/config/availability";
import { getBusyIntervals } from "@/lib/google/freebusy";
import { listMarks } from "@/lib/google/marks";
import { toDayDto } from "@/lib/presenters";
import { bookingHorizon, computeAvailability } from "@/lib/slots";
import { nowInTz, parseDate } from "@/lib/time";
import { slotsQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = slotsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }

  const now = nowInTz();
  const horizon = bookingHorizon(availability, now);
  const requestedFrom = parsed.data.from ? parseDate(parsed.data.from) : horizon.first;
  const requestedTo = parsed.data.to ? parseDate(parsed.data.to) : horizon.last;
  if (!requestedFrom.isValid || !requestedTo.isValid || requestedTo < requestedFrom) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }

  const from = DateTime.max(requestedFrom, horizon.first);
  const to = DateTime.min(requestedTo, horizon.last);
  if (to < from) {
    return NextResponse.json({ days: [] }, { headers: cacheHeaders() });
  }

  try {
    const [busy, openings] = await Promise.all([
      getBusyIntervals(from, to.plus({ days: 1 })),
      listMarks("opening", from, to.plus({ days: 1 })),
    ]);
    const days = computeAvailability({ config: availability, from, to, busy, now, openings });
    return NextResponse.json({ days: days.map(toDayDto) }, { headers: cacheHeaders() });
  } catch (err) {
    console.error("[api/slots] erro ao consultar a agenda", err);
    return NextResponse.json(
      { error: "Não foi possível carregar os horários agora. Tente novamente em alguns minutos." },
      { status: 503 },
    );
  }
}

function cacheHeaders() {
  return { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=5" };
}
