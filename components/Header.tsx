"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./Header.module.css";

const SYMBOL_URL = "https://id.churchofjesuschrist.org/images/symbolFull.webp";

export function Header() {
  const [symbolFailed, setSymbolFailed] = useState(false);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.lockup}>
          {!symbolFailed && (
            <>
              <Image
                src={SYMBOL_URL}
                alt="Símbolo de A Igreja de Jesus Cristo dos Santos dos Últimos Dias"
                width={116}
                height={229}
                className={styles.symbol}
                priority
                onError={() => setSymbolFailed(true)}
              />
              <span className={styles.divider} aria-hidden="true" />
            </>
          )}
          <span className={styles.text}>
            <span className={styles.name}>Ala Parque da Fonte</span>
            <span className={styles.sub}>
              <span className={styles.church}>A Igreja de Jesus Cristo dos Santos dos Últimos Dias</span>
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
              <span>São José dos Pinhais – PR</span>
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
