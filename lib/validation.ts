import { z } from "zod";
import { toE164 } from "./phone";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const slotsQuerySchema = z.object({
  from: z.string().regex(DATE).optional(),
  to: z.string().regex(DATE).optional(),
});

export const nameSchema = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(3, "Informe seu nome completo.")
      .max(80, "Nome muito longo.")
      .regex(/^[\p{L}][\p{L}' .-]*$/u, "Use apenas letras no nome.")
      .refine((v) => v.includes(" "), "Informe nome e sobrenome."),
  );

export const phoneSchema = z
  .string()
  .max(30)
  .transform((v, ctx) => {
    const e164 = toE164(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "Informe um WhatsApp válido com DDD." });
      return z.NEVER;
    }
    return e164;
  });

export const bookingSchema = z.object({
  nome: nameSchema,
  telefone: phoneSchema,
  start: z.string().min(16).max(40),
  turnstileToken: z.string().max(4096).default(""),
  /** Honeypot: precisa chegar vazio. */
  website: z.string().max(200).optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

/** ID de evento do Google: os do sistema são base32hex, os criados à mão podem ter "_" e maiúsculas. */
const eventIdSchema = z.string().regex(/^[A-Za-z0-9_-]{5,1024}$/);

export const phoneUpdateSchema = z.object({
  eventId: eventIdSchema,
  telefone: phoneSchema,
});

export const loginSchema = z.object({
  password: z.string().min(1).max(200),
});

export const reminderSentSchema = z.object({
  eventId: eventIdSchema,
});

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const markCreateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("block-slot"), start: z.string().min(16).max(40) }),
  z.object({ action: z.literal("block-day"), date: z.string().regex(DATE) }),
  z.object({
    action: z.literal("open"),
    date: z.string().regex(DATE),
    from: z.string().regex(HM),
    to: z.string().regex(HM),
  }),
]);

export const markDeleteSchema = z.object({
  kind: z.enum(["block", "opening"]),
  eventId: eventIdSchema,
});

export const historyQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const attendanceSchema = z.object({
  eventId: eventIdSchema,
  compareceu: z.enum(["sim", "nao"]).nullable(),
});

export const adminAvailabilityQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(180).optional(),
});

export const appointmentsQuerySchema = z.object({
  range: z.enum(["today", "tomorrow", "week"]).default("tomorrow"),
});

/* ---------- Área do membro (entra só com o telefone) ---------- */

export const memberLoginSchema = z.object({
  telefone: phoneSchema,
  /** Honeypot: precisa chegar vazio. */
  website: z.string().max(200).optional(),
});

export const memberCancelSchema = z.object({
  eventId: eventIdSchema,
});

export const memberRescheduleSchema = z.object({
  eventId: eventIdSchema,
  start: z.string().min(16).max(40),
});
