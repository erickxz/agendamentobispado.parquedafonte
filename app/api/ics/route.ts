import { type NextRequest } from "next/server";
import { availability } from "@/config/availability";
import { memberIcs } from "@/lib/memberCalendar";
import { slotFromStart } from "@/lib/slots";

export const dynamic = "force-dynamic";

/** .ics do compromisso. Só recebe o horário: nenhum dado pessoal passa pela URL. */
export async function GET(request: NextRequest) {
  const start = request.nextUrl.searchParams.get("start") ?? "";
  const slot = slotFromStart(availability, start);
  if (!slot) return new Response("Horário inválido.", { status: 400 });

  return new Response(memberIcs(slot), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="entrevista-ala-parque-da-fonte.ics"',
      "Cache-Control": "no-store",
    },
  });
}
