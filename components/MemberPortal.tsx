"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { maskPhone } from "@/lib/phone";
import type { DayDto, MemberAppointmentDto } from "@/lib/presenters";
import { phoneSchema } from "@/lib/validation";
import { readSavedContact } from "./BookingForm";
import { ConfirmDialog } from "./ConfirmDialog";
import { DatePicker } from "./DatePicker";
import { SlotGrid } from "./SlotGrid";
import { SlotsSkeleton } from "./Skeleton";
import formStyles from "./BookingForm.module.css";
import tile from "./Confirmation.module.css";
import styles from "./MemberPortal.module.css";

interface Props {
  loggedIn: boolean;
  /** Número vindo do link do lembrete (?tel=), em E.164. */
  linkPhone: string | null;
  secretaryWhatsApp: string | null;
}

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; telefone: string; items: MemberAppointmentDto[] };

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Marcado quando o membro clica em "Usar outro número": aí não entra mais sozinho com o número salvo. */
const NO_AUTO_KEY = "ala-parque-da-fonte:sem-entrada-automatica";

function setNoAuto(on: boolean) {
  try {
    if (on) localStorage.setItem(NO_AUTO_KEY, "1");
    else localStorage.removeItem(NO_AUTO_KEY);
  } catch {
    // Navegação privada: só deixa de lembrar a escolha.
  }
}

function noAuto(): boolean {
  try {
    return localStorage.getItem(NO_AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function MemberPortal({ loggedIn, linkPhone, secretaryWhatsApp }: Props) {
  // "auto": tenta entrar sozinho com o número do link do lembrete ou o salvo neste aparelho.
  const [view, setView] = useState<"auto" | "login" | "list">(loggedIn ? "list" : "auto");

  useEffect(() => {
    if (view !== "auto") return;
    // O número do link vale mesmo depois de "Usar outro número": a pessoa abriu o próprio lembrete.
    const saved = readSavedContact();
    const telefone = linkPhone ?? (noAuto() ? null : saved?.telefone);
    if (!telefone || !phoneSchema.safeParse(telefone).success) {
      setView("login");
      return;
    }
    fetch("/api/member/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefone }),
    })
      .then((res) => {
        if (res.ok && linkPhone) setNoAuto(false);
        setView(res.ok ? "list" : "login");
      })
      .catch(() => setView("login"))
      .finally(() => {
        // Tira o ?tel= da barra de endereço para não ficar no histórico nem ser compartilhado sem querer.
        if (linkPhone) window.history.replaceState(null, "", window.location.pathname);
      });
  }, [view, linkPhone]);

  async function logout() {
    setNoAuto(true);
    await fetch("/api/member/logout", { method: "POST" }).catch(() => undefined);
    setView("login");
  }

  if (view === "auto") return <SlotsSkeleton />;
  if (view === "login")
    return (
      <LoginForm
        onLoggedIn={() => {
          setNoAuto(false);
          setView("list");
        }}
      />
    );
  return <AppointmentList secretaryWhatsApp={secretaryWhatsApp} onLogout={logout} onExpired={() => setView("login")} />;
}

/* ---------- Entrar com o telefone ---------- */

function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const id = useId();
  const [telefone, setTelefone] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<{ field?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quem já marcou neste aparelho encontra o número preenchido.
  useEffect(() => {
    const saved = readSavedContact();
    if (saved?.telefone) setTelefone(maskPhone(saved.telefone));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const check = phoneSchema.safeParse(telefone);
    if (!check.success) {
      setError({ field: check.error.issues[0]?.message });
      inputRef.current?.focus();
      return;
    }
    setError({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/member/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone, website }),
      });
      if (res.ok) {
        onLoggedIn();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError({ form: data.error ?? "Não foi possível continuar. Tente novamente." });
    } catch {
      setError({ form: "Sem conexão. Verifique sua internet e tente novamente." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${styles.panel} ${styles.loginCard}`}>
      <div className={styles.loginBody}>
        <div className={styles.loginHead}>
          <span className={styles.loginIcon} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <h2 className={styles.loginTitle}>Informe seu WhatsApp</h2>
          <p className={styles.muted}>Use o mesmo número que você informou ao marcar a entrevista.</p>
        </div>

        <form className={`${formStyles.form} ${styles.loginForm}`} onSubmit={handleSubmit} noValidate>
          <div className={formStyles.field}>
            <label htmlFor={`${id}-tel`}>WhatsApp com DDD</label>
            <input
              ref={inputRef}
              id={`${id}-tel`}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(41) 99999-8888"
              value={telefone}
              onChange={(e) => setTelefone(maskPhone(e.target.value))}
              aria-invalid={Boolean(error.field)}
              aria-describedby={error.field ? `${id}-tel-erro` : undefined}
            />
            {error.field && (
              <p id={`${id}-tel-erro`} className={formStyles.error}>
                {error.field}
              </p>
            )}
          </div>

          {/* Honeypot: invisível para pessoas, bots costumam preencher. */}
          <div className={formStyles.honeypot} aria-hidden="true">
            <label htmlFor={`${id}-site`}>Não preencha este campo</label>
            <input
              id={`${id}-site`}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {error.form && (
            <p className="alert alert-error" role="alert">
              {error.form}
            </p>
          )}

          <button type="submit" className={`btn btn-primary ${styles.fullBtn}`} disabled={submitting}>
            {submitting ? "Buscando…" : "Ver minhas entrevistas"}
          </button>
        </form>

        <p className={styles.loginFoot}>
          Ainda não marcou? <Link href="/">Marcar entrevista</Link>
        </p>
      </div>
    </div>
  );
}

/* ---------- Lista de entrevistas ---------- */

function AppointmentList({
  secretaryWhatsApp,
  onLogout,
  onExpired,
}: {
  secretaryWhatsApp: string | null;
  onLogout: () => void;
  onExpired: () => void;
}) {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<MemberAppointmentDto | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const noticeRef = useRef<HTMLParagraphElement>(null);

  const load = useCallback(async () => {
    setList({ status: "loading" });
    try {
      const res = await fetch("/api/member/appointments", { cache: "no-store" });
      if (res.status === 401) {
        onExpired();
        return;
      }
      const data = (await res.json()) as { telefone?: string; items?: MemberAppointmentDto[]; error?: string };
      if (!res.ok || !data.items) throw new Error(data.error);
      setList({ status: "ready", telefone: data.telefone ?? "", items: data.items });
    } catch (err) {
      setList({
        status: "error",
        message: err instanceof Error && err.message ? err.message : "Não foi possível carregar suas entrevistas.",
      });
    }
  }, [onExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  function replaceItem(eventId: string, next: MemberAppointmentDto | null) {
    setList((s) =>
      s.status === "ready"
        ? {
            ...s,
            items: next
              ? s.items.map((i) => (i.eventId === eventId ? next : i)).sort((a, b) => a.start.localeCompare(b.start))
              : s.items.filter((i) => i.eventId !== eventId),
          }
        : s,
    );
  }

  async function cancel(item: MemberAppointmentDto) {
    setCancelling(item.eventId);
    setItemErrors(({ [item.eventId]: _, ...rest }) => rest);
    try {
      const res = await fetch("/api/member/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: item.eventId }),
      });
      if (res.status === 401) return onExpired();
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error);
      }
      replaceItem(item.eventId, null);
      setNotice(`Entrevista de ${item.dateLabel}, às ${item.timeLabel}, cancelada. O horário ficou livre para outra pessoa.`);
    } catch (err) {
      setItemErrors((e) => ({
        ...e,
        [item.eventId]: err instanceof Error && err.message ? err.message : "Não foi possível cancelar. Tente de novo.",
      }));
    } finally {
      setCancelling(null);
    }
  }

  if (list.status === "loading") return <SlotsSkeleton />;

  if (list.status === "error") {
    return (
      <div className={styles.panel}>
        <div className={styles.body}>
          <p className="alert alert-error" role="alert">
            {list.message}
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <ConfirmDialog
        open={confirmCancel !== null}
        title="Cancelar a entrevista?"
        confirmLabel="Cancelar entrevista"
        cancelLabel="Manter"
        onCancel={() => setConfirmCancel(null)}
        onConfirm={() => {
          if (confirmCancel) void cancel(confirmCancel);
          setConfirmCancel(null);
        }}
      >
        {confirmCancel && (
          <p>
            {capitalize(confirmCancel.dateLabel)}, às {confirmCancel.timeLabel}. O horário fica livre para outro membro
            marcar.
          </p>
        )}
      </ConfirmDialog>

      <div className={styles.who}>
        <span>
          Entrevistas do número <strong>{list.telefone}</strong>
        </span>
        <button type="button" className="link-button" onClick={onLogout}>
          Usar outro número
        </button>
      </div>

      {notice && (
        <p ref={noticeRef} tabIndex={-1} className="alert alert-success" role="status">
          {notice}
        </p>
      )}

      {list.items.length === 0 ? (
        <div className={styles.panel}>
          <div className={styles.body}>
            <p className={styles.empty}>Nenhuma entrevista marcada com este número.</p>
            <p className={styles.muted}>
              Marcou com outro número? Use o link &ldquo;Usar outro número&rdquo; acima. Entrevistas marcadas direto com o
              secretário podem não aparecer aqui.
            </p>
            <Link href="/" className="btn btn-primary">
              Marcar entrevista
            </Link>
          </div>
        </div>
      ) : (
        list.items.map((item) => (
          <section key={item.eventId} className={styles.panel} aria-labelledby={`e-${item.eventId}`}>
            <div className={styles.body}>
              <div className={tile.summary}>
                <div className={tile.dateTile} aria-hidden="true">
                  <span className={tile.tileMonth}>{item.month}</span>
                  <span className={tile.tileDay}>{item.day}</span>
                  <span className={tile.tileWeekday}>{item.weekday}</span>
                </div>
                <dl className={tile.details}>
                  <div>
                    <dt>Nome</dt>
                    <dd className={styles.name}>{item.nome}</dd>
                  </div>
                  <div>
                    <dt id={`e-${item.eventId}`}>Data</dt>
                    <dd className={tile.capitalize}>{item.dateLabel}</dd>
                  </div>
                  <div>
                    <dt>Horário</dt>
                    <dd>
                      {item.timeLabel} às {item.endTimeLabel}
                    </dd>
                  </div>
                  <div>
                    <dt>Local</dt>
                    <dd>
                      {item.location}{" "}
                      <a href={item.mapsUrl} target="_blank" rel="noopener noreferrer" className={tile.map}>
                        Ver no mapa
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>

              {itemErrors[item.eventId] && (
                <p className="alert alert-error" role="alert">
                  {itemErrors[item.eventId]}
                </p>
              )}

              {item.canChange ? (
                rescheduling === item.eventId ? (
                  <Reschedule
                    item={item}
                    onCancel={() => setRescheduling(null)}
                    onExpired={onExpired}
                    onDone={(next) => {
                      replaceItem(item.eventId, next);
                      setRescheduling(null);
                      setNotice(`Entrevista remarcada para ${next.dateLabel}, às ${next.timeLabel}.`);
                    }}
                  />
                ) : (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={cancelling !== null}
                      onClick={() => {
                        setNotice(null);
                        setRescheduling(item.eventId);
                      }}
                    >
                      Remarcar
                    </button>
                    <button
                      type="button"
                      className={`btn btn-secondary ${styles.danger}`}
                      disabled={cancelling !== null}
                      onClick={() => setConfirmCancel(item)}
                    >
                      {cancelling === item.eventId ? "Cancelando…" : "Cancelar entrevista"}
                    </button>
                    <a className={styles.calLink} href={item.googleCalendarUrl} target="_blank" rel="noopener noreferrer">
                      Adicionar ao Google Agenda
                    </a>
                  </div>
                )
              ) : (
                <p className={styles.muted}>
                  Esta entrevista foi marcada pelo bispado. Para mudar,{" "}
                  {secretaryWhatsApp ? (
                    <a href={`https://wa.me/${secretaryWhatsApp}`} target="_blank" rel="noopener noreferrer">
                      fale com o secretário da ala
                    </a>
                  ) : (
                    "fale com o secretário da ala"
                  )}
                  .
                </p>
              )}
            </div>
          </section>
        ))
      )}

      {list.items.length > 0 && (
        <Link href="/" className={styles.newLink}>
          Marcar outra entrevista
        </Link>
      )}
    </div>
  );
}

/* ---------- Remarcar: escolher novo dia e horário ---------- */

type SlotsState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; days: DayDto[] };

function Reschedule({
  item,
  onCancel,
  onDone,
  onExpired,
}: {
  item: MemberAppointmentDto;
  onCancel: () => void;
  onDone: (next: MemberAppointmentDto) => void;
  onExpired: () => void;
}) {
  const [slots, setSlots] = useState<SlotsState>({ status: "loading" });
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const labelId = useId();

  const loadSlots = useCallback(async (keepDate: string | null) => {
    try {
      const res = await fetch("/api/slots", { cache: "no-store" });
      const data = (await res.json()) as { days?: DayDto[]; error?: string };
      if (!res.ok || !data.days) throw new Error(data.error);
      setSlots({ status: "ready", days: data.days });
      const kept = data.days.find((d) => d.date === keepDate && d.slots.length > 0);
      setDate(kept?.date ?? data.days.find((d) => d.slots.length > 0)?.date ?? null);
    } catch (err) {
      setSlots({
        status: "error",
        message: err instanceof Error && err.message ? err.message : "Não foi possível carregar os horários.",
      });
    }
  }, []);

  useEffect(() => {
    void loadSlots(null);
  }, [loadSlots]);

  async function confirm() {
    if (!start) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/member/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: item.eventId, start }),
      });
      if (res.status === 401) return onExpired();
      const data = (await res.json().catch(() => ({}))) as { item?: MemberAppointmentDto; error?: string; code?: string };
      if (res.ok && data.item) {
        onDone(data.item);
        return;
      }
      setError(data.error ?? "Não foi possível remarcar. Tente de novo.");
      if (data.code === "slot_taken" || data.code === "slot_invalid") {
        setStart(null);
        void loadSlots(date);
      }
    } catch {
      setError("Sem conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const days = slots.status === "ready" ? slots.days : [];
  const day = days.find((d) => d.date === date) ?? null;
  const slot = day?.slots.find((s) => s.start === start) ?? null;

  return (
    <div className={styles.reschedule}>
      <div className={styles.rescheduleHead}>
        <h3 className={styles.heading} id={`${labelId}-dia`}>
          Escolha o novo dia
        </h3>
        <button type="button" className="link-button" onClick={onCancel}>
          Voltar
        </button>
      </div>

      {slots.status === "loading" && <SlotsSkeleton />}
      {slots.status === "error" && (
        <p className="alert alert-error" role="alert">
          {slots.message}
        </p>
      )}

      {slots.status === "ready" &&
        (days.some((d) => d.slots.length > 0) ? (
          <>
            <DatePicker
              days={days}
              selected={date}
              labelledBy={`${labelId}-dia`}
              onSelect={(d) => {
                setDate(d);
                setStart(null);
                setError(null);
              }}
            />
            {day && (
              <>
                <h3 className={styles.heading} id={`${labelId}-hora`}>
                  Escolha o novo horário
                </h3>
                {day.slots.length > 0 ? (
                  <SlotGrid slots={day.slots} selected={start} labelledBy={`${labelId}-hora`} onSelect={setStart} />
                ) : (
                  <p className={styles.empty}>Nenhum horário livre neste dia. Escolha outro dia.</p>
                )}
              </>
            )}
          </>
        ) : (
          <p className={styles.empty}>Nenhum outro horário disponível nos próximos dias.</p>
        ))}

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {day && slot && (
        <div className={styles.confirmRow}>
          <p>
            De <strong>{capitalize(item.dateLabel)}, {item.timeLabel}</strong> para{" "}
            <strong>
              {capitalize(day.label)}, {slot.time}
            </strong>
          </p>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void confirm()}>
            {saving ? "Remarcando…" : "Confirmar novo horário"}
          </button>
        </div>
      )}
    </div>
  );
}
