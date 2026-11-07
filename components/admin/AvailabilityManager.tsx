"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminDayDto, AdminSlotDto } from "@/lib/presenters";
import { ConfirmDialog } from "../ConfirmDialog";
import styles from "./AvailabilityManager.module.css";
import { DateField, TimeField, addDays, timeOptions, todayKey } from "./PickerFields";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; days: AdminDayDto[] };

type MarkRequest =
  | { method: "POST"; body: { action: "block-slot"; start: string } }
  | { method: "POST"; body: { action: "block-day"; date: string } }
  | { method: "POST"; body: { action: "open"; date: string; from: string; to: string } }
  | { method: "DELETE"; body: { kind: "block" | "opening"; eventId: string } };

const MAX_DAYS = 180;
const STEP_DAYS = 28;
const FORM_KEY = "form";
const ALL_TIMES = timeOptions(6, 23);
const FROM_OPTIONS = ALL_TIMES.slice(0, -1); // começar até 22:30
const TO_OPTIONS = ALL_TIMES.slice(1); // terminar a partir de 06:30

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Entrevistas do dia, uma por evento (uma entrevista de 1 hora ocupa dois horários). */
function bookedInterviews(day: AdminDayDto): AdminSlotDto[] {
  const seen = new Set<string>();
  return day.slots.filter((s) => {
    if (s.status !== "booked") return false;
    const key = s.bookingId ?? s.start;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function AvailabilityManager({ defaultDays }: { defaultDays: number }) {
  const [days, setDays] = useState(defaultDays);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDay, setConfirmDay] = useState<AdminDayDto | null>(null);

  const fetchDays = useCallback(async (n: number, silent = false) => {
    if (!silent) setLoad({ status: "loading" });
    try {
      const res = await fetch(`/api/admin/availability?days=${n}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/admin/login?next=/admin/disponibilidade";
        return;
      }
      const data = (await res.json()) as { days?: AdminDayDto[]; error?: string };
      if (!res.ok || !data.days) throw new Error(data.error);
      setLoad({ status: "ready", days: data.days });
    } catch (err) {
      setLoad({
        status: "error",
        message: err instanceof Error && err.message ? err.message : "Não foi possível carregar a agenda.",
      });
    }
  }, []);

  const [loadedOnce, setLoadedOnce] = useState(false);
  useEffect(() => {
    void fetchDays(days, loadedOnce).then(() => setLoadedOnce(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando o período muda
  }, [days, fetchDays]);

  /** Envia a alteração para a agenda e recarrega. `errorKey` indica onde mostrar o erro. */
  async function act(key: string, errorKey: string, request: MarkRequest): Promise<boolean> {
    setPending(key);
    setErrors(({ [errorKey]: _, ...rest }) => rest);
    try {
      const res = await fetch("/api/admin/marks", {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error);
      }
      await fetchDays(days, true);
      return true;
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [errorKey]: err instanceof Error && err.message ? err.message : "Não foi possível salvar. Tente novamente.",
      }));
      return false;
    } finally {
      setPending(null);
    }
  }

  function doBlockDay(day: AdminDayDto) {
    void act(`day:${day.date}`, day.date, { method: "POST", body: { action: "block-day", date: day.date } });
  }

  /** Dia com entrevistas marcadas pede confirmação; dia vazio bloqueia direto. */
  function blockDay(day: AdminDayDto) {
    if (day.slots.some((s) => s.status === "booked")) setConfirmDay(day);
    else doBlockDay(day);
  }

  const confirmBooked = confirmDay ? bookedInterviews(confirmDay) : [];
  const dialog = (
    <ConfirmDialog
      open={confirmDay !== null}
      title="Bloquear o dia inteiro?"
      confirmLabel="Bloquear dia"
      onCancel={() => setConfirmDay(null)}
      onConfirm={() => {
        if (confirmDay) doBlockDay(confirmDay);
        setConfirmDay(null);
      }}
    >
      {confirmDay && (
        <>
          <div>
            {capitalize(confirmDay.label)} já tem{" "}
            {confirmBooked.length === 1 ? "uma entrevista marcada" : `${confirmBooked.length} entrevistas marcadas`}:
          </div>
          <ul>
            {confirmBooked.map((s) => (
              <li key={s.start}>
                {s.time} · {s.nome}
              </li>
            ))}
          </ul>
          <p>
            {confirmBooked.length === 1 ? "Ela continua valendo" : "Elas continuam valendo"}. O bloqueio só impede que
            outros membros marquem novos horários nesse dia.
          </p>
        </>
      )}
    </ConfirmDialog>
  );

  if (load.status === "loading") {
    return (
      <div className={styles.list} aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={`${styles.day} ${styles.skeleton}`} />
        ))}
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className={styles.day}>
        <p className="alert alert-error" role="alert">
          {load.message}
        </p>
        <p style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={() => void fetchDays(days)}>
            Tentar novamente
          </button>
        </p>
      </div>
    );
  }

  return (
    <>
      {dialog}
      <OpeningForm
        pending={pending === FORM_KEY}
        disabled={pending !== null}
        error={errors[FORM_KEY]}
        onSubmit={(date, from, to) => act(FORM_KEY, FORM_KEY, { method: "POST", body: { action: "open", date, from, to } })}
      />

      <ul className={styles.legend} aria-label="Legenda">
        <li>
          <span className={`${styles.swatch} ${styles.free}`} /> Livre
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.booked}`} /> Entrevista marcada
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.blocked}`} /> Bloqueado
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.busy}`} /> Outro compromisso ou encerrado
        </li>
      </ul>

      <div className={styles.list}>
        {load.days.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            pending={pending}
            error={errors[day.date]}
            onBlockDay={() => blockDay(day)}
            onAct={(key, request) => void act(key, day.date, request)}
          />
        ))}
      </div>

      {days < MAX_DAYS && (
        <button
          type="button"
          className={`btn btn-secondary ${styles.more}`}
          onClick={() => setDays((d) => Math.min(d + STEP_DAYS, MAX_DAYS))}
        >
          Ver mais 4 semanas
        </button>
      )}
    </>
  );
}

function DayCard({
  day,
  pending,
  error,
  onBlockDay,
  onAct,
}: {
  day: AdminDayDto;
  pending: string | null;
  error?: string;
  onBlockDay: () => void;
  onAct: (key: string, request: MarkRequest) => void;
}) {
  const free = day.slots.filter((s) => s.status === "free").length;
  const booked = bookedInterviews(day).length;
  const dayKey = `day:${day.date}`;
  const offWeekClosed = day.offWeek && day.openings.length === 0;
  const busy = pending !== null;

  let meta: string;
  if (day.configBlocked) meta = "Bloqueado na configuração do sistema";
  else if (offWeekClosed) meta = `${day.offWeek!.note} · sem atendimento nesta semana`;
  else if (day.dayBlockId)
    meta = `Dia bloqueado${booked ? ` · ${plural(booked, "entrevista mantida", "entrevistas mantidas")}` : ""}`;
  else meta = `${plural(free, "livre", "livres")} · ${plural(booked, "marcada", "marcadas")}`;

  return (
    <section className={`${styles.day} ${offWeekClosed ? styles.dayOff : ""}`} aria-labelledby={`d-${day.date}`}>
      <header className={styles.dayHeader}>
        <div>
          <h2 id={`d-${day.date}`} className={styles.dayTitle}>
            {capitalize(day.label)}
          </h2>
          <p className={styles.dayMeta}>{meta}</p>
        </div>

        {!day.configBlocked && offWeekClosed && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              onAct(dayKey, {
                method: "POST",
                body: { action: "open", date: day.date, from: day.offWeek!.from, to: day.offWeek!.to },
              })
            }
          >
            {pending === dayKey ? "Abrindo…" : `Abrir ${day.offWeek!.from} às ${day.offWeek!.to}`}
          </button>
        )}

        {!day.configBlocked &&
          !offWeekClosed &&
          (day.dayBlockId ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => onAct(dayKey, { method: "DELETE", body: { kind: "block", eventId: day.dayBlockId! } })}
            >
              {pending === dayKey ? "Liberando…" : "Liberar dia"}
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onBlockDay}>
              {pending === dayKey ? "Bloqueando…" : "Bloquear dia"}
            </button>
          ))}
      </header>

      {day.openings.length > 0 && (
        <ul className={styles.openings}>
          {day.openings.map((o) => {
            const key = `open:${o.eventId}`;
            return (
              <li key={o.eventId}>
                <span>
                  Horários extras abertos: <strong>{o.label}</strong>
                </span>
                <button
                  type="button"
                  className="link-button"
                  disabled={busy}
                  onClick={() => onAct(key, { method: "DELETE", body: { kind: "opening", eventId: o.eventId } })}
                >
                  {pending === key ? "Fechando…" : "Fechar"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {!day.configBlocked && day.slots.length > 0 && (
        <div className={styles.slots}>
          {day.slots.map((slot) => (
            <SlotChip
              key={slot.start}
              slot={slot}
              dayBlocked={Boolean(day.dayBlockId)}
              pending={pending === slot.start}
              disabled={busy}
              onBlock={() => onAct(slot.start, { method: "POST", body: { action: "block-slot", start: slot.start } })}
              onUnblock={(id) => onAct(slot.start, { method: "DELETE", body: { kind: "block", eventId: id } })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OpeningForm({
  pending,
  disabled,
  error,
  onSubmit,
}: {
  pending: boolean;
  disabled: boolean;
  error?: string;
  onSubmit: (date: string, from: string, to: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("19:00");
  const [to, setTo] = useState("21:30");
  const [done, setDone] = useState(false);
  const [missingDate, setMissingDate] = useState(false);
  const today = todayKey();

  /** Mudar o início para depois do fim empurra o fim junto (mantém pelo menos 30 min). */
  function changeFrom(value: string) {
    setFrom(value);
    if (to <= value) setTo(FROM_OPTIONS[FROM_OPTIONS.indexOf(value) + 1] ?? TO_OPTIONS[TO_OPTIONS.length - 1]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setDone(false);
    if (!date) {
      setMissingDate(true);
      return;
    }
    if (await onSubmit(date, from, to)) {
      setDone(true);
      setDate("");
    }
  }

  if (!open) {
    return (
      <button type="button" className={`btn btn-secondary ${styles.more}`} onClick={() => setOpen(true)}>
        Abrir horários em outro dia
      </button>
    );
  }

  return (
    <form className={styles.openForm} onSubmit={handleSubmit}>
      <div>
        <h2 className={styles.dayTitle}>Abrir horários em outro dia</h2>
        <p className={styles.dayMeta}>
          Cria um evento &ldquo;Aberto para entrevistas&rdquo; na agenda. Os horários dentro dele ficam disponíveis para
          os membros, exceto os que já estiverem ocupados.
        </p>
      </div>
      <div className={styles.formRow}>
        <DateField
          label="Data"
          value={date}
          min={today}
          max={addDays(today, MAX_DAYS)}
          invalid={missingDate && !date}
          onChange={(d) => {
            setDate(d);
            setMissingDate(false);
          }}
        />
        <TimeField label="Das" value={from} options={FROM_OPTIONS} onChange={changeFrom} />
        <TimeField label="Até" value={to} options={TO_OPTIONS.filter((t) => t > from)} onChange={setTo} />
      </div>
      {missingDate && !date && (
        <p className="alert alert-error" role="alert">
          Escolha o dia.
        </p>
      )}
      <p className={styles.dayMeta}>&ldquo;Até&rdquo; é quando a última entrevista termina.</p>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {done && !error && (
        <p className="alert alert-success" role="status">
          Horários abertos. Já aparecem para os membros.
        </p>
      )}
      <div className={styles.formActions}>
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          {pending ? "Abrindo…" : "Abrir horários"}
        </button>
        <button type="button" className="link-button" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function SlotChip({
  slot,
  dayBlocked,
  pending,
  disabled,
  onBlock,
  onUnblock,
}: {
  slot: AdminSlotDto;
  dayBlocked: boolean;
  pending: boolean;
  disabled: boolean;
  onBlock: () => void;
  onUnblock: (blockId: string) => void;
}) {
  const time = (
    <span className={styles.time}>
      {slot.time}–{slot.endTime}
    </span>
  );

  if (slot.status === "free" && !dayBlocked) {
    return (
      <button
        type="button"
        className={`${styles.chip} ${styles.free} ${styles.action}`}
        disabled={disabled}
        onClick={onBlock}
        aria-label={`${slot.time}, livre. Bloquear horário`}
      >
        {time}
        <span className={styles.status}>{pending ? "Bloqueando…" : "Livre"}</span>
        <span className={styles.hint}>Bloquear</span>
      </button>
    );
  }

  if (slot.status === "blocked" && slot.blockId) {
    const blockId = slot.blockId;
    return (
      <button
        type="button"
        className={`${styles.chip} ${styles.blocked} ${styles.action}`}
        disabled={disabled}
        onClick={() => onUnblock(blockId)}
        aria-label={`${slot.time}, bloqueado. Liberar horário`}
      >
        {time}
        <span className={styles.status}>{pending ? "Liberando…" : "Bloqueado"}</span>
        <span className={styles.hint}>Liberar</span>
      </button>
    );
  }

  const variant =
    slot.status === "booked" ? styles.booked : slot.status === "blocked" || dayBlocked ? styles.blocked : styles.busy;
  const label =
    slot.status === "booked"
      ? slot.nome
      : slot.status === "busy"
        ? "Outro compromisso"
        : slot.status === "closed"
          ? "Encerrado"
          : "Dia bloqueado";

  return (
    <div className={`${styles.chip} ${variant}`}>
      {time}
      <span className={styles.status} title={label}>
        {label}
      </span>
    </div>
  );
}
