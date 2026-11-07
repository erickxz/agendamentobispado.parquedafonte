"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { maskPhone } from "@/lib/phone";
import type { AppointmentDto } from "@/lib/presenters";
import styles from "@/app/admin/admin.module.css";

type Range = "today" | "tomorrow" | "week";

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "week", label: "Próximos 7 dias" },
];

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: AppointmentDto[] };

export function ReminderList() {
  const [range, setRange] = useState<Range>("tomorrow");
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const fetchItems = useCallback(async (r: Range, silent = false) => {
    if (!silent) setLoad({ status: "loading" });
    try {
      const res = await fetch(`/api/admin/appointments?range=${r}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/admin/login?next=/admin/lembretes";
        return;
      }
      const data = (await res.json()) as { items?: AppointmentDto[]; error?: string };
      if (!res.ok || !data.items) throw new Error(data.error);
      setLoad({ status: "ready", items: data.items });
    } catch (err) {
      setLoad({
        status: "error",
        message: err instanceof Error && err.message ? err.message : "Não foi possível carregar as entrevistas.",
      });
    }
  }, []);

  useEffect(() => {
    void fetchItems(range);
  }, [range, fetchItems]);

  function updateItem(eventId: string, changes: Partial<AppointmentDto>) {
    setLoad((s) =>
      s.status === "ready" ? { ...s, items: s.items.map((i) => (i.eventId === eventId ? { ...i, ...changes } : i)) } : s,
    );
  }

  async function markSent(item: AppointmentDto) {
    // Atualiza na hora; se o servidor falhar, desfaz e avisa. Um novo envio atualiza o horário.
    const previous = { lembreteEnviado: item.lembreteEnviado, lembreteEnviadoEm: item.lembreteEnviadoEm };
    updateItem(item.eventId, { lembreteEnviado: true, lembreteEnviadoEm: "agora" });
    setItemErrors(({ [item.eventId]: _, ...rest }) => rest);
    try {
      const res = await fetch("/api/admin/reminder-sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: item.eventId }),
      });
      const data = (await res.json().catch(() => ({}))) as { enviadoEm?: string };
      if (!res.ok) throw new Error();
      updateItem(item.eventId, { lembreteEnviadoEm: data.enviadoEm ?? null });
    } catch {
      updateItem(item.eventId, previous);
      setItemErrors((e) => ({ ...e, [item.eventId]: "Não foi possível marcar como enviado. Tente de novo." }));
    }
  }

  return (
    <>
      <div className={styles.tabs} role="group" aria-label="Período">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            aria-pressed={range === r.value}
            className={`${styles.tab} ${range === r.value ? styles.tabActive : ""}`}
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {load.status === "loading" && (
        <div className={styles.list} aria-busy="true">
          <span className="visually-hidden">Carregando entrevistas…</span>
          <div className={styles.empty}>Carregando…</div>
        </div>
      )}

      {load.status === "error" && (
        <div className={styles.panel}>
          <p className="alert alert-error" role="alert">
            {load.message}
          </p>
          <p style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => void fetchItems(range)}>
              Tentar novamente
            </button>
          </p>
        </div>
      )}

      {load.status === "ready" && load.items.length > 0 && (
        <p className={styles.summary} aria-live="polite">
          {load.items.length} {load.items.length === 1 ? "entrevista" : "entrevistas"} ·{" "}
          {pendingText(load.items.filter((i) => !i.lembreteEnviado).length)}
        </p>
      )}

      {load.status === "ready" &&
        (load.items.length === 0 ? (
          <div className={styles.list}>
            <p className={styles.empty}>Nenhuma entrevista marcada neste período.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {load.items.map((item) => (
              <li key={item.eventId} className={styles.item}>
                <div className={styles.who}>
                  <span className={styles.name}>{item.nome}</span>
                  <span className={styles.meta}>
                    {item.dateLabel}, às {item.timeLabel}
                    {item.telefone && ` · ${item.telefone}`}
                    {item.origem === "manual" && " · criada na agenda"}
                  </span>
                  <PhoneForm
                    key={`${item.eventId}:${item.telefone}`}
                    eventId={item.eventId}
                    current={item.telefone}
                    onSaved={(telefone) => {
                      updateItem(item.eventId, { telefone });
                      void fetchItems(range, true); // recarrega para o link do WhatsApp sair com o número
                    }}
                  />
                  {itemErrors[item.eventId] && <span className={styles.itemError}>{itemErrors[item.eventId]}</span>}
                </div>
                <div className={styles.actions}>
                  {item.lembreteEnviado && (
                    <span className={styles.sent}>
                      {item.lembreteEnviadoEm === "agora"
                        ? "Lembrete enviado agora"
                        : item.lembreteEnviadoEm
                          ? `Lembrete enviado em ${item.lembreteEnviadoEm}`
                          : "Lembrete enviado"}
                    </span>
                  )}
                  {item.reminderUrl && (
                    <a
                      href={item.reminderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`btn ${item.lembreteEnviado ? "btn-secondary" : "btn-primary"}`}
                      onClick={() => void markSent(item)}
                      title={item.telefone ? undefined : "Sem telefone: o WhatsApp abre para você escolher o contato"}
                    >
                      {item.lembreteEnviado ? "Enviar de novo" : item.telefone ? "Enviar lembrete" : "Enviar (escolher contato)"}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}

/** Campo para adicionar o WhatsApp de uma entrevista sem telefone, ou corrigir o que já foi informado. */
function PhoneForm({
  eventId,
  current,
  onSaved,
}: {
  eventId: string;
  current: string;
  onSaved: (telefone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, telefone: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { telefone?: string; error?: string };
      if (!res.ok || !data.telefone) throw new Error(data.error);
      onSaved(data.telefone);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setValue(current);
    setError(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <span className={styles.noPhone}>
        {!current && "Sem telefone no evento. "}
        <button type="button" className="link-button" onClick={() => setOpen(true)}>
          {current ? "Editar número" : "Adicionar WhatsApp"}
        </button>
      </span>
    );
  }

  return (
    <form className={styles.phoneForm} onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor={`tel-${eventId}`}>
        WhatsApp com DDD
      </label>
      <input
        id={`tel-${eventId}`}
        type="tel"
        inputMode="tel"
        placeholder="(41) 99999-8888"
        autoFocus
        value={value}
        onChange={(e) => setValue(maskPhone(e.target.value))}
      />
      <button type="submit" className="btn btn-secondary" disabled={saving}>
        {saving ? "Salvando…" : "Salvar"}
      </button>
      <button type="button" className="link-button" onClick={cancel}>
        Cancelar
      </button>
      {error && <span className={styles.itemError}>{error}</span>}
    </form>
  );
}

function pendingText(n: number) {
  if (n === 0) return "todos os lembretes enviados";
  return n === 1 ? "1 lembrete pendente" : `${n} lembretes pendentes`;
}
