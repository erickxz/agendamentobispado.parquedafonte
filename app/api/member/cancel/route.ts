import { NextResponse, type NextRequest } from "next/server";
import { cancelBooking, getBooking } from "@/lib/google/events";
import { invalidateBusyCache } from "@/lib/google/freebusy";
import { getMemberPhone } from "@/lib/memberAuth";
import { canMemberChange } from "@/lib/memberBookings";
import { nowInTz } from "@/lib/time";
import { memberCancelSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** O membro cancela uma entrevista que marcou pelo site. O horário volta a ficar livre. */
export async function POST(request: NextRequest) {
  const phone = await getMemberPhone();
  if (!phone) return error(401, "Informe seu WhatsApp para continuar.");

  const parsed = memberCancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, "Dados inválidos.");

  try {
    const booking = await getBooking(parsed.data.eventId);
    // Mesmo erro para "não existe" e "é de outro telefone": não revela entrevistas alheias.
    if (!booking || booking.telefone !== phone) return error(404, "Entrevista não encontrada.");
    if (!canMemberChange(booking, nowInTz())) {
      return error(403, "Essa entrevista não pode ser cancelada por aqui. Fale com o secretário da ala.");
    }
    await cancelBooking(booking.eventId);
    invalidateBusyCache();
    console.info("[member/cancel] entrevista cancelada pelo membro", { eventId: booking.eventId });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[member/cancel] erro ao cancelar", err);
    return error(503, "Não foi possível cancelar agora. Tente novamente em alguns minutos.");
  }
}
