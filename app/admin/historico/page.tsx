import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { HistoryList } from "@/components/admin/HistoryList";
import { isAdmin } from "@/lib/adminAuth";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Histórico · Painel da secretaria" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!(await isAdmin())) redirect("/admin/login?next=/admin/historico");

  return (
    <main className={`container ${styles.main}`}>
      <AdminNav current="/admin/historico" />
      <div>
        <h1>Histórico de entrevistas</h1>
        <p className={styles.lead}>
          Entrevistas já realizadas, mês a mês. Registre se o membro compareceu; a informação fica salva no próprio
          evento da agenda.
        </p>
      </div>
      <HistoryList />
    </main>
  );
}
