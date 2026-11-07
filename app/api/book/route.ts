import { NextResponse, type NextRequest } from "next/server";
import { availability, locationText, mapsUrl } from "@/config/availability";
import { createBookingEvent } from "@/lib/google/events";
import { getBusyIntervals, invalidateBusyCache } from "@/lib/google/freebusy";
import { listMarks } from "@/lib/google/marks";
import { icsPath, memberGoogleCalendarUrl } from "@/lib/memberCalendar";
import type { BookingConfirmationDto } from "@/lib/presenters";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { findValidSlot, overlapsBusy } from "@/lib/slots";
import { formatLongDate, formatMonthShort, formatTime, formatWeekdayShort, nowInTz, parseInstant } from "@/lib/time";
import { verifyTurnstile } from "@/lib/turnstile";
import { bookingSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const SLOT_INVALID = "Esse horário não está mais disponível. Escolha outro horário.";
const SLOT_TAKEN = "Esse horário acabou de ser ocupado. Escolha outro horário.";

function error(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);

  const limit = await rateLimit("book", ip ?? "desconhecido");
  if (!limit.ok) {
    return error(429, "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.", "rate_limited");
  }

  const body = await request.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    const message =
      field === "nome" || field === "telefone" ? issue.message : "Não foi possível ler os dados enviados. Recarregue a página.";
    return error(400, message, typeof field === "string" ? `invalid_${field}` : "invalid");
  }
  const { nome, telefone, start, turnstileToken, website } = parsed.data;

  if (website) {
    console.warn("[api/book] honeypot preenchido", { ip });
    return error(400, "Não foi possível concluir o agendamento. Recarregue a página e tente novamente.", "rejected");
  }

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return error(
      400,
      "Não conseguimos confirmar a verificação de segurança. Aguarde a verificação concluir e tente de novo.",
      "turnstile",
    );
  }

  const now = nowInTz();
  const requested = parseInstant(start);
  if (!requested.isValid) return error(409, SLOT_INVALID, "slot_invalid");

  try {
    const day = requested.startOf("day");
    const openings = await listMarks("opening", day, day.plus({ days: 1 }), { fresh: true });
    const slot = findValidSlot(availability, start, now, openings);
    if (!slot) return error(409, SLOT_INVALID, "slot_invalid");

    const buffer = { minutes: availability.bufferMinutes };
    const busy = await getBusyIntervals(slot.start.minus(buffer), slot.end.plus(buffer), { fresh: true });
    if (overlapsBusy(slot, busy, availability.bufferMinutes)) return error(409, SLOT_TAKEN, "slot_taken");

    const result = await createBookingEvent(slot, nome, telefone);
    if (result.status === "taken") return error(409, SLOT_TAKEN, "slot_taken");
    invalidateBusyCache();

    const confirmation: BookingConfirmationDto = {
      start: slot.start.toISO()!,
      dateLabel: formatLongDate(slot.start),
      timeLabel: formatTime(slot.start),
      endTimeLabel: formatTime(slot.end),
      weekday: formatWeekdayShort(slot.start),
      day: String(slot.start.day),
      month: formatMonthShort(slot.start),
      location: locationText(availability),
      mapsUrl: mapsUrl(),
      googleCalendarUrl: memberGoogleCalendarUrl(slot),
      icsUrl: icsPath(slot),
    };
    return NextResponse.json({ booking: confirmation }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[api/book] erro ao criar evento", err);
    return error(503, "Não foi possível marcar agora. Tente novamente em alguns minutos.", "server");
  }
}
