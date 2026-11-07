import Link from "next/link";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p>
          Ala Parque da Fonte · A Igreja de Jesus Cristo dos Santos dos Últimos Dias
          <br />
          Seus dados ficam apenas na agenda da ala e são usados só para esta entrevista.
        </p>
        <Link href="/admin/lembretes" className={styles.admin}>
          Área da secretaria
        </Link>
      </div>
    </footer>
  );
}
