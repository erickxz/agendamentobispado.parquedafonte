"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HistoryItemDto } from "@/lib/presenters";
import styles from "./HistoryList.module.css";

type Attendance = HistoryItemDto["compareceu"];

interface MonthData {
  month: string;
  monthLabel: string;
  hasNext: boolean;
  items: HistoryItemDto[];
}

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: MonthData };

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function HistoryList() {
  const [month, setMonth] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const fetchMonth = useCallback(async (m: string | null) => {
    setLoad({ status: "loading" });
    try {
      const res = await fetch(`/api/admin/history${m ? `?month=${m}` : ""}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/admin/login?next=/admin/historico";
        return;
      }
      const data = (await res.json()) as MonthData & { error?: string };
      if (!res.ok) throw new Error(data.error);
      setLoad({ status: "ready", data });
    } catch (err) {
      setLoad({
        status: "error",
        message: err instanceof Error && err.message ? err.message : "Não foi possível carregar o histórico.",
      });
    }
  }, []);

  useEffect(() => {
    void fetchMonth(month);
  }, [month, fetchMonth]);

  const items = load.status === "ready" ? load.data.items : [];
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? items.filter((i) => normalize(i.nome).includes(q)) : items;
  }, [items, query]);

  const counts = useMemo(
    () => ({
      total: items.length,
      sim: items.filter((i) => i.compareceu === "sim").length,
      nao: items.filter((i) => i.compareceu === "nao").length,
    }),
    [items],
  );

  function updateItem(eventId: string, compareceu: Attendance) {
    setLoad((s) =>
      s.status === "ready"
        ? { ...s, data: { ...s.data, items: s.data.items.map((i) => (i.eventId === eventId ? { ...i, compareceu } : i)) } }
        : s,
    );
  }

  async function setAttendance(item: HistoryItemDto, value: Attendance) {
    const next = item.compareceu === value ? null : value; // clicar de novo desfaz
    const previous = item.compareceu;
    setSaving(item.eventId);
    setItemErrors(({ [item.eventId]: _, ...rest }) => rest);
    updateItem(item.eventId, next);
    try {
      const res = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: item.eventId, compareceu: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      updateItem(item.eventId, previous);
      setItemErrors((e) => ({ ...e, [item.eventId]: "Não foi possível salvar. Tente de novo." }));
    } finally {
      setSaving(null);
    }
  }

  const current = load.status === "ready" ? load.data : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.monthNav}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!current}
            onClick={() => current && setMonth(shiftMonth(current.month, -1))}
            aria-label="Mês anterior"
          >
            Anterior
          </button>
          <span className={styles.monthLabel} aria-live="polite">
            {current ? current.monthLabel.charAt(0).toUpperCase() + current.monthLabel.slice(1) : "…"}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!current?.hasNext}
            onClick={() => current && setMonth(shiftMonth(current.month, 1))}
            aria-label="Próximo mês"
          >
            Próximo
          </button>
        </div>
        <label className={styles.search}>
          <span className="visually-hidden">Buscar por nome</span>
          <input
            type="search"
            placeholder="Buscar por nome"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {load.status === "ready" && counts.total > 0 && (
        <dl className={styles.stats}>
          <div>
            <dt>Entrevistas</dt>
            <dd>{counts.total}</dd>
          </div>
          <div>
            <dt>Compareceram</dt>
            <dd>{counts.sim}</dd>
          </div>
          <div>
            <dt>Faltaram</dt>
            <dd>{counts.nao}</dd>
          </div>
          <div>
            <dt>Sem registro</dt>
            <dd>{counts.total - counts.sim - counts.nao}</dd>
          </div>
        </dl>
      )}

      {load.status === "loading" && (
        <div className={styles.list} aria-busy="true">
          <p className={styles.empty}>Carregando…</p>
        </div>
      )}

      {load.status === "error" && (
        <p className="alert alert-error" role="alert">
          {load.message}
        </p>
      )}

      {load.status === "ready" &&
        (filtered.length === 0 ? (
          <div className={styles.list}>
            <p className={styles.empty}>
              {query ? "Nenhuma entrevista com esse nome neste mês." : "Nenhuma entrevista realizada neste mês."}
            </p>
          </div>
        ) : (
          <ul className={styles.list}>
            {filtered.map((item) => (
              <li key={item.eventId} className={styles.item}>
                <div className={styles.when}>
                  <span className={styles.date}>{item.dateLabel}</span>
                  <span className={styles.time}>{item.timeLabel}</span>
                </div>
                <div className={styles.who}>
                  <span className={styles.name}>{item.nome}</span>
                  <span className={styles.phone}>{item.telefone}</span>
                  {itemErrors[item.eventId] && <span className={styles.error}>{itemErrors[item.eventId]}</span>}
                </div>
                <div className={styles.attendance} role="group" aria-label={`Presença de ${item.nome}`}>
                  <button
                    type="button"
                    aria-pressed={item.compareceu === "sim"}
                    className={`${styles.toggle} ${item.compareceu === "sim" ? styles.yes : ""}`}
                    disabled={saving === item.eventId}
                    onClick={() => void setAttendance(item, "sim")}
                  >
                    Compareceu
                  </button>
                  <button
                    type="button"
                    aria-pressed={item.compareceu === "nao"}
                    className={`${styles.toggle} ${item.compareceu === "nao" ? styles.no : ""}`}
                    disabled={saving === item.eventId}
                    onClick={() => void setAttendance(item, "nao")}
                  >
                    Faltou
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
