"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./PickerFields.module.css";

/* ---------- Datas como "YYYY-MM-DD" (aritmética em UTC, sem depender do fuso do navegador) ---------- */

const TZ = "America/Sao_Paulo";
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

function toUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const fromUtc = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (key: string, n: number) => fromUtc(new Date(toUtc(key).getTime() + n * 86_400_000));
const monthOf = (key: string) => key.slice(0, 7);

function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  return fromUtc(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7);
}

/** Semanas completas (domingo a sábado) que cobrem o mês. */
function monthGrid(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = fromUtc(new Date(Date.UTC(y, m, 0)));
  const start = addDays(first, -toUtc(first).getUTCDay());
  const end = addDays(last, 6 - toUtc(last).getUTCDay());
  const keys: string[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) keys.push(k);
  return keys;
}

const fmt = (key: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { ...opts, timeZone: "UTC" }).format(toUtc(key));

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Popover: fecha ao clicar fora ou com Esc ---------- */

function usePopover() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  /** Fecha quando o foco sai do campo (ex.: Tab para o próximo campo). */
  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
  }

  return { open, setOpen, close, wrapRef, triggerRef, onBlur };
}

function Trigger({
  id,
  labelId,
  open,
  popup,
  icon,
  placeholder,
  children,
  invalid,
  triggerRef,
  onToggle,
}: {
  id: string;
  labelId: string;
  open: boolean;
  popup: "dialog" | "listbox";
  icon: ReactNode;
  placeholder?: boolean;
  children: ReactNode;
  invalid?: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
}) {
  return (
    <button
      ref={triggerRef}
      id={id}
      type="button"
      className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
      aria-haspopup={popup}
      aria-expanded={open}
      aria-labelledby={`${labelId} ${id}`}
      aria-invalid={invalid || undefined}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" && !open) {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={`${styles.value} ${placeholder ? styles.placeholder : ""}`}>{children}</span>
      <svg className={styles.caret} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

const CalendarIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ClockIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ---------- Campo de data ---------- */

export function DateField({
  label,
  value,
  min,
  max,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  invalid?: boolean;
  onChange: (date: string) => void;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const { open, setOpen, close, wrapRef, triggerRef, onBlur } = usePopover();
  const [month, setMonth] = useState(monthOf(value || min));
  const [focusKey, setFocusKey] = useState(value || min);
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  function toggle() {
    if (!open) {
      const start = value || min;
      setMonth(monthOf(start));
      setFocusKey(start);
      moveFocus.current = true;
    }
    setOpen(!open);
  }

  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusKey}"]`)?.focus();
  }, [open, focusKey, month]);

  function pick(key: string) {
    onChange(key);
    close();
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, key: string) {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (delta === undefined) return;
    e.preventDefault();
    const target = addDays(key, delta);
    if (target < min || target > max) return;
    moveFocus.current = true;
    setFocusKey(target);
    if (monthOf(target) !== month) setMonth(monthOf(target));
  }

  const minMonth = monthOf(min);
  const maxMonth = monthOf(max);
  const grid = monthGrid(month);
  const today = todayKey();
  const tabKey = monthOf(focusKey) === month ? focusKey : grid.find((k) => monthOf(k) === month && k >= min && k <= max);

  return (
    <div className={styles.field} ref={wrapRef} onBlur={onBlur}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <Trigger
        id={id}
        labelId={labelId}
        open={open}
        popup="dialog"
        icon={CalendarIcon}
        placeholder={!value}
        invalid={invalid}
        triggerRef={triggerRef}
        onToggle={toggle}
      >
        {value ? capitalize(fmt(value, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "")) : "Escolha o dia"}
      </Trigger>

      {open && (
        <div className={`${styles.popover} ${styles.calendar}`} tabIndex={-1} role="dialog" aria-label={`Escolher ${label.toLowerCase()}`}>
          <div className={styles.calHeader}>
            <button
              type="button"
              className={styles.navBtn}
              disabled={month <= minMonth}
              onClick={() => setMonth(addMonths(month, -1))}
              aria-label="Mês anterior"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className={styles.calTitle} aria-live="polite">
              {capitalize(fmt(`${month}-01`, { month: "long", year: "numeric" }))}
            </span>
            <button
              type="button"
              className={styles.navBtn}
              disabled={month >= maxMonth}
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label="Próximo mês"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAYS.map((w, i) => (
              <span key={i} title={WEEKDAY_NAMES[i]}>
                {w}
              </span>
            ))}
          </div>

          <div className={styles.days} ref={gridRef}>
            {grid.map((key) => {
              const inMonth = monthOf(key) === month;
              if (!inMonth) return <span key={key} />;
              const disabled = key < min || key > max;
              const selected = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  data-date={key}
                  className={[styles.day, selected ? styles.daySelected : "", key === today ? styles.dayToday : ""].join(" ")}
                  disabled={disabled}
                  tabIndex={key === tabKey ? 0 : -1}
                  aria-pressed={selected}
                  aria-label={fmt(key, { weekday: "long", day: "numeric", month: "long" }) + (key === today ? ", hoje" : "")}
                  onClick={() => pick(key)}
                  onKeyDown={(e) => onKey(e, key)}
                >
                  {Number(key.slice(8))}
                </button>
              );
            })}
          </div>

          <div className={styles.calFooter}>
            <button type="button" className="link-button" onClick={() => pick(today)} disabled={today < min || today > max}>
              Hoje
            </button>
            <button type="button" className="link-button" onClick={() => pick(addDays(today, 1))}>
              Amanhã
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Campo de horário ---------- */

/** "06:00" … "23:00" de 30 em 30 minutos. */
export function timeOptions(fromHour = 6, toHour = 23): string[] {
  const out: string[] = [];
  for (let h = fromHour; h <= toHour; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < toHour) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}

export function TimeField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (time: string) => void;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const { open, setOpen, close, wrapRef, triggerRef, onBlur } = usePopover();
  const [active, setActive] = useState(value);
  const listRef = useRef<HTMLUListElement>(null);

  function toggle() {
    if (!open) setActive(options.includes(value) ? value : options[0]);
    setOpen(!open);
  }

  // Ao abrir, foca a lista e rola até o horário escolhido; depois acompanha o item ativo.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    if (document.activeElement !== list) list.focus();
    list.querySelector<HTMLElement>(`[data-time="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function pick(time: string) {
    onChange(time);
    close();
  }

  function onKey(e: KeyboardEvent<HTMLUListElement>) {
    const i = options.indexOf(active);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = Math.min(i + 1, options.length - 1);
    if (e.key === "ArrowUp") next = Math.max(i - 1, 0);
    if (e.key === "PageDown") next = Math.min(i + 4, options.length - 1);
    if (e.key === "PageUp") next = Math.max(i - 4, 0);
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = options.length - 1;
    if (next !== null) {
      e.preventDefault();
      setActive(options[next]);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <div className={styles.field} ref={wrapRef} onBlur={onBlur}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <Trigger
        id={id}
        labelId={labelId}
        open={open}
        popup="listbox"
        icon={ClockIcon}
        triggerRef={triggerRef}
        onToggle={toggle}
      >
        {value}
      </Trigger>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={`${listId}-${active.replace(":", "")}`}
          className={`${styles.popover} ${styles.list}`}
          onKeyDown={onKey}
        >
          {options.map((t) => (
            <li
              key={t}
              id={`${listId}-${t.replace(":", "")}`}
              data-time={t}
              role="option"
              aria-selected={t === value}
              className={[styles.option, t === active ? styles.optionActive : "", t === value ? styles.optionSelected : ""].join(" ")}
              onPointerEnter={() => setActive(t)}
              onClick={() => pick(t)}
            >
              {t}
              {t === value && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
