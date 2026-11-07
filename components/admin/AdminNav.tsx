import Link from "next/link";
import styles from "@/app/admin/admin.module.css";
import { LogoutButton } from "./LogoutButton";

const LINKS = [
  { href: "/admin/lembretes", label: "Lembretes" },
  { href: "/admin/disponibilidade", label: "Disponibilidade" },
  { href: "/admin/historico", label: "Histórico" },
] as const;

export function AdminNav({ current }: { current: (typeof LINKS)[number]["href"] }) {
  return (
    <nav className={styles.nav} aria-label="Painel da secretaria">
      <ul>
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} aria-current={l.href === current ? "page" : undefined}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
      <LogoutButton />
    </nav>
  );
}
