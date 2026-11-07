import { NextResponse, type NextRequest } from "next/server";
import { availability } from "@/config/availability";
import { cancelBooking, createBookingEvent, getBooking } from "@/lib/google/events";
import { getBusyIntervals, invalidateBusyCache } from "@/lib/google/freebusy";
import { listMarks } from "@/lib/google/marks";
import { getMemberPhone } from "@/lib/memberAuth";
import { canMemberChange, toMemberAppointmentDto, withoutInterval } from "@/lib/memberBookings";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { findValidSlot, overlapsBusy } from "@/lib/slots";
import { nowInTz, parseInstant } from "@/lib/time";
import { memberRescheduleSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const SLOT_INVALID = "Esse horário não está mais disponível. Escolha outro horário.";
const SLOT_TAKEN = "Esse horário acabou de ser ocupado. Escolha outro horário.";

function error(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Remarcar: cria a entrevista no novo horário e só depois apaga a antiga,
 * para o membro nunca ficar sem horário se algo falhar no meio.
 */
export async function POST(request: NextRequest) {
  const phone = await getMemberPhone();
  if (!phone) return error(401, "Informe seu WhatsApp para continuar.");

  const limit = await rateLimit("book", clientIp(request.headers) ?? "desconhecido");
  if (!limit.ok) return error(429, "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.");

  const parsed = memberRescheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, "Dados inválidos.");
  const { eventId, start } = parsed.data;

  const now = nowInTz();
  const requested = parseInstant(start);
  if (!requested.isValid) return error(409, SLOT_INVALID, "slot_invalid");

  try {
    const booking = await getBooking(eventId);
    if (!booking || booking.telefone !== phone) return error(404, "Entrevista não encontrada.");
    if (!canMemberChange(booking, now)) {
      return error(403, "Essa entrevista não pode ser remarcada por aqui. Fale com o secretário da ala.");
    }

    const day = requested.startOf("day");
    const openings = await listMarks("opening", day, day.plus({ days: 1 }), { fresh: true });
    const slot = findValidSlot(availability, start, now, openings);
    if (!slot) return error(409, SLOT_INVALID, "slot_invalid");
    if (slot.start.toMillis() === booking.start.toMillis()) {
      return error(400, "Esse já é o horário da sua entrevista. Escolha outro.", "same_slot");
    }

    const buffer = { minutes: availability.bufferMinutes };
    const busy = await getBusyIntervals(slot.start.minus(buffer), slot.end.plus(buffer), { fresh: true });
    if (overlapsBusy(slot, withoutInterval(busy, booking), availability.bufferMinutes)) {
      return error(409, SLOT_TAKEN, "slot_taken");
    }

    const created = await createBookingEvent(slot, booking.nome, phone);
    if (created.status === "taken") return error(409, SLOT_TAKEN, "slot_taken");

    try {
      await cancelBooking(booking.eventId);
    } catch (err) {
      // Não conseguiu apagar a antiga: desfaz a nova para não deixar duas entrevistas.
      console.error("[member/reschedule] erro ao apagar a entrevista antiga; desfazendo", err);
      await cancelBooking(created.eventId).catch((e) => console.error("[member/reschedule] erro ao desfazer", e));
      throw err;
    }
    invalidateBusyCache();
    console.info("[member/reschedule] entrevista remarcada pelo membro", { from: booking.eventId, to: created.eventId });

    const item = toMemberAppointmentDto(
      { ...booking, eventId: created.eventId, start: slot.start, end: slot.end, lembreteEnviado: false, lembreteEnviadoEm: null },
      now,
    );
    return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[member/reschedule] erro ao remarcar", err);
    return error(503, "Não foi possível remarcar agora. Tente novamente em alguns minutos.", "server");
  }
}
