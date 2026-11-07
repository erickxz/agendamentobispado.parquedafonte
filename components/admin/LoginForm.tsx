"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import styles from "@/app/admin/login/login.module.css";

export function LoginForm({ next }: { next: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function checkCaps(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Informe a senha.");
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Navegação completa: garante que o cookie novo vá na requisição e descarta o cache do
        // roteador (que guardou o redirecionamento para o login). router.replace + router.refresh
        // concorriam entre si e, na primeira vez, o refresh da tela de login cancelava a navegação.
        window.location.replace(next);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Não foi possível entrar. Tente novamente.");
      inputRef.current?.select();
    } catch {
      setError("Sem conexão. Verifique sua internet e tente novamente.");
    }
    // Só reativa o botão em caso de erro; no sucesso ele fica "Entrando…" até a página trocar.
    setSubmitting(false);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="senha">Senha</label>
        <div className={styles.inputWrap}>
          <input
            ref={inputRef}
            id="senha"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={checkCaps}
            onKeyUp={checkCaps}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "senha-erro" : capsLock ? "senha-caps" : undefined}
          />
          <button
            type="button"
            className={styles.toggle}
            onClick={() => {
              setVisible((v) => !v);
              inputRef.current?.focus();
            }}
            aria-pressed={visible}
            aria-controls="senha"
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {capsLock && (
          <p id="senha-caps" className={styles.caps}>
            Caps Lock está ativado.
          </p>
        )}
      </div>

      {error && (
        <p id="senha-erro" className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
        {submitting ? "Entrando…" : "Entrar no painel"}
      </button>
    </form>
  );
}
