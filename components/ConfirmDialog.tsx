"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./ConfirmDialog.module.css";

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo de confirmação no visual do site. Usa o <dialog> nativo:
 * Esc fecha, o foco fica preso dentro dele e volta ao botão de origem ao fechar.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = "Cancelar", onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(e) => {
        e.preventDefault(); // Esc: o estado do pai decide fechar
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel(); // clique fora do conteúdo
      }}
    >
      <div className={styles.content}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
