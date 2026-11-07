"use client";

import type { SlotDto } from "@/lib/presenters";
import styles from "./SlotGrid.module.css";

interface Props {
  slots: SlotDto[];
  selected: string | null;
  labelledBy: string;
  onSelect: (start: string) => void;
}

export function SlotGrid({ slots, selected, labelledBy, onSelect }: Props) {
  return (
    <div role="group" aria-labelledby={labelledBy} className={styles.grid}>
      {slots.map((slot) => {
        const isSelected = slot.start === selected;
        return (
          <button
            key={slot.start}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${slot.time} às ${slot.endTime}`}
            className={`${styles.slot} ${isSelected ? styles.selected : ""}`}
            onClick={() => onSelect(slot.start)}
          >
            <span className={styles.time}>{slot.time}</span>
            <span className={styles.end}>até {slot.endTime}</span>
          </button>
        );
      })}
    </div>
  );
}
