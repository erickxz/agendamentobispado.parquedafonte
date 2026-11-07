import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/admin/LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Entrar · Painel da secretaria" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  // Só aceita destinos internos do painel (evita redirecionamento aberto).
  const target =
    typeof next === "string" && /^\/admin(\/[\w-]*)*$/.test(next) && next !== "/admin/login" ? next : "/admin/lembretes";

  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <section className={styles.card} aria-labelledby="login-titulo">
          <header className={styles.cardHeader}>
            <h1 id="login-titulo" className={styles.title}>
              Painel da secretaria
            </h1>
            <p className={styles.subtitle}>Entre com a senha para gerenciar entrevistas, horários e lembretes.</p>
          </header>
          <LoginForm next={target} />
        </section>

        <p className={styles.note}>
          Acesso restrito ao secretário e ao bispado da Ala Parque da Fonte. Se esqueceu a senha, fale com quem administra o
          sistema.
        </p>
        <Link href="/" className={styles.back}>
          Voltar para o agendamento
        </Link>
      </div>
    </main>
  );
}
