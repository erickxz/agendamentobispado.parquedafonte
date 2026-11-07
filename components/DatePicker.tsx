"use client";

import { useRef, type KeyboardEvent } from "react";
import type { DayDto } from "@/lib/presenters";
import styles from "./DatePicker.module.css";

interface Props {
  days: DayDto[];
  selected: string | null;
  labelledBy: string;
  onSelect: (date: string) => void;
}

/**
 * Faixa de dias no padrão radiogroup: Tab entra no dia selecionado,
 * setas/Home/End movem entre os dias com horário (dias sem horário são pulados).
 */
export function DatePicker({ days, selected, labelledBy, onSelect }: Props) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const enabled = days.filter((d) => d.slots.length > 0);
  const focusDate = selected ?? enabled[0]?.date;

  function move(e: KeyboardEvent<HTMLButtonElement>, current: string) {
    const index = enabled.findIndex((d) => d.date === current);
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(index + 1, enabled.length - 1);
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(index - 1, 0);
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = enabled.length - 1;
    if (next === null || next === index) return;
    e.preventDefault();
    const date = enabled[next].date;
    onSelect(date);
    const el = refs.current.get(date);
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={styles.strip}>
      {days.map((day) => {
        const disabled = day.slots.length === 0;
        const isSelected = day.date === selected;
        return (
          <button
            key={day.date}
            ref={(el) => {
              if (el) refs.current.set(day.date, el);
              else refs.current.delete(day.date);
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={disabled || undefined}
            aria-label={`${day.label}, ${disabled ? "sem horários" : `${day.slots.length} ${day.slots.length === 1 ? "horário livre" : "horários livres"}`}`}
            tabIndex={!disabled && day.date === focusDate ? 0 : -1}
            className={`${styles.day} ${isSelected ? styles.selected : ""} ${disabled ? styles.disabled : ""}`}
            onClick={() => !disabled && onSelect(day.date)}
            onKeyDown={(e) => !disabled && move(e, day.date)}
          >
            <span className={styles.weekday}>{day.weekday}</span>
            <span className={styles.number}>{day.day}</span>
            <span className={styles.month}>{day.month}</span>
            <span className={styles.count} aria-hidden="true">
              {disabled ? "Lotado" : `${day.slots.length} ${day.slots.length === 1 ? "livre" : "livres"}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
