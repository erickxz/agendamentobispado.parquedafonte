"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { maskPhone } from "@/lib/phone";
import type { BookingConfirmationDto } from "@/lib/presenters";
import { nameSchema, phoneSchema } from "@/lib/validation";
import { Turnstile, type TurnstileHandle } from "./Turnstile";
import styles from "./BookingForm.module.css";

const STORAGE_KEY = "ala-parque-da-fonte:membro";

export interface Contact {
  nome: string;
  telefone: string;
  /** Veio do convite ou dos dados salvos: mostra "Não é você? Trocar dados". */
  prefilled: boolean;
}

interface Props {
  start: string;
  siteKey: string | null;
  contact: Contact;
  onContactChange: (contact: Contact) => void;
  onBooked: (booking: BookingConfirmationDto) => void;
  onSlotTaken: (message: string) => void;
}

type Errors = { nome?: string; telefone?: string; form?: string };

export function readSavedContact(): { nome: string; telefone: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { nome?: unknown; telefone?: unknown };
    if (typeof data.nome !== "string" || typeof data.telefone !== "string") return null;
    return { nome: data.nome, telefone: data.telefone };
  } catch {
    return null;
  }
}

function save(nome: string, telefone: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nome, telefone }));
  } catch {
    // Navegação privada ou armazenamento cheio: só deixa de lembrar os dados.
  }
}

function forget() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorado
  }
}

export function BookingForm({ start, siteKey, contact, onContactChange, onBooked, onSlotTaken }: Props) {
  const id = useId();
  const { nome, telefone, prefilled } = contact;
  const [website, setWebsite] = useState("");
  const [token, setToken] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  function clearData() {
    forget();
    onContactChange({ nome: "", telefone: "", prefilled: false });
    setErrors({});
    nomeRef.current?.focus();
  }

  function validate(): Errors {
    const next: Errors = {};
    const n = nameSchema.safeParse(nome);
    if (!n.success) next.nome = n.error.issues[0]?.message;
    const t = phoneSchema.safeParse(telefone);
    if (!t.success) next.telefone = t.error.issues[0]?.message;
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    if (found.nome || found.telefone) {
      setErrors(found);
      document.getElementById(found.nome ? `${id}-nome` : `${id}-tel`)?.focus();
      return;
    }
    if (siteKey && !token) {
      setErrors({ form: "Aguarde a verificação de segurança concluir e tente de novo." });
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone, start, turnstileToken: token, website }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        booking?: BookingConfirmationDto;
        error?: string;
        code?: string;
      };

      if (res.ok && data.booking) {
        save(nome.trim(), telefone);
        onBooked(data.booking);
        return;
      }

      const message = data.error ?? "Não foi possível marcar agora. Tente novamente em alguns minutos.";
      if (data.code === "slot_taken" || data.code === "slot_invalid") {
        onSlotTaken(message);
        return;
      }
      if (data.code === "invalid_nome") setErrors({ nome: message });
      else if (data.code === "invalid_telefone") setErrors({ telefone: message });
      else setErrors({ form: message });
      turnstileRef.current?.reset();
    } catch {
      setErrors({ form: "Sem conexão. Verifique sua internet e tente novamente." });
      turnstileRef.current?.reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {prefilled && (
        <p className={styles.prefilled}>
          Preenchemos seus dados.{" "}
          <button type="button" className="link-button" onClick={clearData}>
            Não é você? Trocar dados
          </button>
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor={`${id}-nome`}>Nome completo</label>
        <input
          ref={nomeRef}
          id={`${id}-nome`}
          name="nome"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={80}
          value={nome}
          onChange={(e) => onContactChange({ ...contact, nome: e.target.value })}
          aria-invalid={Boolean(errors.nome)}
          aria-describedby={errors.nome ? `${id}-nome-erro` : undefined}
        />
        {errors.nome && (
          <p id={`${id}-nome-erro`} className={styles.error}>
            {errors.nome}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor={`${id}-tel`}>WhatsApp com DDD</label>
        <input
          id={`${id}-tel`}
          name="telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(41) 99999-8888"
          value={telefone}
          onChange={(e) => onContactChange({ ...contact, telefone: maskPhone(e.target.value) })}
          aria-invalid={Boolean(errors.telefone)}
          aria-describedby={`${id}-tel-ajuda${errors.telefone ? ` ${id}-tel-erro` : ""}`}
        />
        <p id={`${id}-tel-ajuda`} className={styles.hint}>
          Usado apenas para lembrar você da entrevista.
        </p>
        {errors.telefone && (
          <p id={`${id}-tel-erro`} className={styles.error}>
            {errors.telefone}
          </p>
        )}
      </div>

      {/* Honeypot: invisível para pessoas, bots costumam preencher. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={`${id}-site`}>Não preencha este campo</label>
        <input
          id={`${id}-site`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {siteKey && (
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onToken={setToken}
          onError={() =>
            setErrors({ form: "A verificação de segurança não carregou. Recarregue a página e tente de novo." })
          }
        />
      )}

      {errors.form && (
        <p className="alert alert-error" role="alert">
          {errors.form}
        </p>
      )}

      <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
        {submitting ? "Confirmando…" : "Confirmar entrevista"}
      </button>
    </form>
  );
}
