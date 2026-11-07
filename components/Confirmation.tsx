"use client";

import { useEffect, useRef } from "react";
import type { BookingConfirmationDto } from "@/lib/presenters";
import styles from "./Confirmation.module.css";

interface Props {
  booking: BookingConfirmationDto;
  onNew: () => void;
}

export function Confirmation({ booking, onNew }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.status}>
        <span className={styles.check} aria-hidden="true" />
        <div>
          <h2 ref={headingRef} tabIndex={-1} className={styles.title}>
            Entrevista marcada
          </h2>
          <p className={styles.subtitle}>O horário já está reservado na agenda do bispado.</p>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.summary}>
          <div className={styles.dateTile} aria-hidden="true">
            <span className={styles.tileMonth}>{booking.month}</span>
            <span className={styles.tileDay}>{booking.day}</span>
            <span className={styles.tileWeekday}>{booking.weekday}</span>
          </div>
          <dl className={styles.details}>
            <div>
              <dt>Data</dt>
              <dd className={styles.capitalize}>{booking.dateLabel}</dd>
            </div>
            <div>
              <dt>Horário</dt>
              <dd>
                {booking.timeLabel} às {booking.endTimeLabel}
              </dd>
            </div>
            <div>
              <dt>Local</dt>
              <dd>
                {booking.location}{" "}
                <a href={booking.mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.map}>
                  Ver no mapa
                </a>
              </dd>
            </div>
          </dl>
        </div>

        <div className={styles.actions}>
          <a className="btn btn-primary" href={booking.googleCalendarUrl} target="_blank" rel="noopener noreferrer">
            Adicionar ao Google Agenda
          </a>
          <a className="btn btn-secondary" href={booking.icsUrl} download="entrevista-ala-parque-da-fonte.ics">
            Adicionar a outra agenda
          </a>
        </div>

        <div className={styles.next}>
          <h3 className={styles.nextTitle}>Próximos passos</h3>
          <ul>
            <li>Você receberá um lembrete pelo WhatsApp no dia anterior.</li>
            <li>Chegue alguns minutos antes do horário.</li>
            <li>Se não puder comparecer, avise o secretário da ala para liberar o horário.</li>
          </ul>
        </div>

        <button type="button" className="link-button" onClick={onNew}>
          Marcar outra entrevista
        </button>
      </div>
    </div>
  );
}
