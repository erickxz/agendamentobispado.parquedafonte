import styles from "./Skeleton.module.css";

/** Esqueleto discreto enquanto os horários carregam. */
export function SlotsSkeleton() {
  return (
    <div className={styles.panel} aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Carregando horários…</span>
      <div className={styles.stepper}>
        <div className={`${styles.block} ${styles.stepBar}`} />
      </div>
      <div className={styles.body}>
        <div className={`${styles.block} ${styles.title}`} />
        <div className={styles.days}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${styles.block} ${styles.day}`} />
          ))}
        </div>
        <div className={`${styles.block} ${styles.title}`} />
        <div className={styles.slots}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${styles.block} ${styles.slot}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
