import { NextResponse, type NextRequest } from "next/server";
import { availability } from "@/config/availability";
import { isAdmin } from "@/lib/adminAuth";
import { buildAdminAvailability } from "@/lib/adminAvailability";
import { listBookings } from "@/lib/google/events";
import { getBusyIntervals } from "@/lib/google/freebusy";
import { listMarks } from "@/lib/google/marks";
import { nowInTz } from "@/lib/time";
import { adminAvailabilityQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const parsed = adminAvailabilityQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Período inválido." }, { status: 400 });

  const now = nowInTz();
  const from = now.startOf("day");
  const to = from.plus({ days: parsed.data.days ?? availability.daysAhead });
  const timeMax = to.plus({ days: 1 });

  try {
    const [busy, bookings, blocks, openings] = await Promise.all([
      getBusyIntervals(from, timeMax, { fresh: true }),
      listBookings(from, timeMax),
      listMarks("block", from, timeMax, { fresh: true }),
      listMarks("opening", from, timeMax, { fresh: true }),
    ]);
    const days = buildAdminAvailability({ config: availability, from, to, now, busy, bookings, blocks, openings });
    return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin/availability] erro ao consultar a agenda", err);
    return NextResponse.json({ error: "Não foi possível carregar a agenda. Tente novamente." }, { status: 503 });
  }
}
