"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BookingConfirmationDto, DayDto } from "@/lib/presenters";
import { maskPhone } from "@/lib/phone";
import { BookingForm, readSavedContact, type Contact } from "./BookingForm";
import { Confirmation } from "./Confirmation";
import { DatePicker } from "./DatePicker";
import { SlotGrid } from "./SlotGrid";
import { SlotsSkeleton } from "./Skeleton";
import styles from "./BookingFlow.module.css";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; days: DayDto[] };

interface Props {
  siteKey: string | null;
  invite: { nome: string; telefone: string };
}

const LOAD_ERROR = "Não foi possível carregar os horários. Verifique sua conexão e tente novamente.";
const STEPS = ["Dia", "Horário", "Seus dados"];

function scrollTo(el: HTMLElement | null) {
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className={styles.stepper} aria-label="Etapas">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} className={styles.stepItem} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className={styles.stepMarker} aria-hidden="true">
              {state === "done" ? "" : i + 1}
            </span>
            <span className={styles.stepLabel}>
              {label}
              {state === "done" && <span className="visually-hidden"> (concluído)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function BookingFlow({ siteKey, invite }: Props) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmationDto | null>(null);
  const [contact, setContact] = useState<Contact>({ nome: "", telefone: "", prefilled: false });
  const slotsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Convite do secretário (?nome=&tel=) tem prioridade; senão, dados salvos neste aparelho.
  useEffect(() => {
    const source = invite.nome || invite.telefone ? invite : readSavedContact();
    if (source && (source.nome || source.telefone)) {
      setContact({ nome: source.nome, telefone: maskPhone(source.telefone), prefilled: true });
    }
  }, [invite]);

  /** `silent` mantém a tela atual enquanto recarrega (usado depois de um conflito de horário). */
  const loadSlots = useCallback(async (keepDate: string | null, silent = false) => {
    if (!silent) setLoad({ status: "loading" });
    try {
      const res = await fetch("/api/slots", { cache: "no-store" });
      const data = (await res.json()) as { days?: DayDto[]; error?: string };
      if (!res.ok || !data.days) throw new Error(data.error ?? LOAD_ERROR);
      const days = data.days;
      setLoad({ status: "ready", days });
      const kept = days.find((d) => d.date === keepDate && d.slots.length > 0);
      setSelectedDate(kept?.date ?? days.find((d) => d.slots.length > 0)?.date ?? null);
    } catch (err) {
      setLoad({ status: "error", message: err instanceof Error && err.message ? err.message : LOAD_ERROR });
    }
  }, []);

  useEffect(() => {
    void loadSlots(null);
  }, [loadSlots]);

  // Quem volta para a aba vê os horários atualizados (ex.: o bispo liberou um dia no Google Agenda).
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const busyRef = useRef(false);
  busyRef.current = Boolean(selectedStart) || Boolean(confirmation);
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && !busyRef.current) void loadSlots(selectedDateRef.current, true);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadSlots]);

  useEffect(() => {
    if (selectedStart) scrollTo(formRef.current);
  }, [selectedStart]);

  if (confirmation) {
    return (
      <Confirmation
        booking={confirmation}
        onNew={() => {
          setConfirmation(null);
          setSelectedStart(null);
          void loadSlots(null);
        }}
      />
    );
  }

  if (load.status === "loading") return <SlotsSkeleton />;

  if (load.status === "error") {
    return (
      <div className={styles.panel}>
        <div className={styles.body}>
          <p className="alert alert-error" role="alert">
            {load.message}
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => void loadSlots(selectedDate)}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const { days } = load;
  const hasAny = days.some((d) => d.slots.length > 0);
  const day = days.find((d) => d.date === selectedDate) ?? null;
  const slot = day?.slots.find((s) => s.start === selectedStart) ?? null;
  const current = slot ? 2 : day ? 1 : 0;

  if (!hasAny) {
    return (
      <div className={styles.panel}>
        <div className={styles.body}>
          <h2 className={styles.heading}>Escolha o dia</h2>
          <p className={styles.empty}>Nenhum horário disponível nestes dias. Tente a próxima semana.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <Stepper current={current} />

      <div className={styles.body}>
        <div className={styles.step}>
          <div className={styles.headingRow}>
            <h2 className={styles.heading} id="dia-label">
              Escolha o dia
            </h2>
            {day && <span className={styles.headingMeta}>{capitalize(day.monthLabel)}</span>}
          </div>
          <DatePicker
            days={days}
            selected={selectedDate}
            labelledBy="dia-label"
            onSelect={(date) => {
              setSelectedDate(date);
              setSelectedStart(null);
              setNotice(null);
            }}
          />
        </div>

        {day && (
          <div ref={slotsRef} className={styles.step}>
            <div className={styles.headingRow}>
              <h2 className={styles.heading} id="horario-label">
                Escolha o horário
              </h2>
              <span className={styles.headingMeta}>
                {capitalize(day.label)} · {day.slots.length} {day.slots.length === 1 ? "livre" : "livres"}
              </span>
            </div>
            {notice && (
              <p className="alert alert-error" role="alert">
                {notice}
              </p>
            )}
            {day.slots.length > 0 ? (
              <SlotGrid
                slots={day.slots}
                selected={selectedStart}
                labelledBy="horario-label"
                onSelect={(start) => {
                  setSelectedStart(start);
                  setNotice(null);
                }}
              />
            ) : (
              <p className={styles.empty}>Nenhum horário livre neste dia. Escolha outro dia.</p>
            )}
          </div>
        )}

        {day && slot && (
          <div ref={formRef} className={`${styles.step} ${styles.formStep}`}>
            <div className={styles.selection}>
              <div className={styles.selectionText}>
                <span className={styles.selectionLabel}>Horário escolhido</span>
                <span className={styles.selectionValue}>
                  {capitalize(day.label)}, {slot.time} às {slot.endTime}
                </span>
              </div>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setSelectedStart(null);
                  scrollTo(slotsRef.current);
                }}
              >
                Alterar
              </button>
            </div>

            <h2 className={styles.heading}>Seus dados</h2>
            <BookingForm
              start={slot.start}
              siteKey={siteKey}
              contact={contact}
              onContactChange={setContact}
              onBooked={(booking) => {
                setContact((c) => ({ ...c, prefilled: true }));
                setConfirmation(booking);
              }}
              onSlotTaken={(message) => {
                setNotice(message);
                setSelectedStart(null);
                void loadSlots(selectedDate, true);
                scrollTo(slotsRef.current);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
