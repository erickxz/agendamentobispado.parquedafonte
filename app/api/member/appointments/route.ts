import { NextResponse } from "next/server";
import { getMemberPhone } from "@/lib/memberAuth";
import { listMemberBookings, toMemberAppointmentDto } from "@/lib/memberBookings";
import { formatE164ForDisplay } from "@/lib/phone";
import { nowInTz } from "@/lib/time";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Entrevistas futuras do telefone da sessão. */
export async function GET() {
  const phone = await getMemberPhone();
  if (!phone) return NextResponse.json({ error: "Informe seu WhatsApp para continuar." }, { status: 401, headers: NO_STORE });

  try {
    const now = nowInTz();
    const bookings = await listMemberBookings(phone, now);
    return NextResponse.json(
      { telefone: formatE164ForDisplay(phone), items: bookings.map((b) => toMemberAppointmentDto(b, now)) },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("[member/appointments] erro ao consultar a agenda", err);
    return NextResponse.json(
      { error: "Não foi possível carregar suas entrevistas. Tente novamente em alguns minutos." },
      { status: 503, headers: NO_STORE },
    );
  }
}
