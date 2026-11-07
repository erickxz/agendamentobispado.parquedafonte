import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { ReminderList } from "@/components/admin/ReminderList";
import { isAdmin } from "@/lib/adminAuth";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Lembretes" };
export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  if (!(await isAdmin())) redirect("/admin/login?next=/admin/lembretes");

  return (
    <main className={`container ${styles.main}`}>
      <AdminNav current="/admin/lembretes" />
      <div>
        <h1>Lembretes de entrevistas</h1>
        <p className={styles.lead}>
          Envie o lembrete pelo WhatsApp. Depois de enviado, o item fica marcado para não mandar duas vezes.
        </p>
      </div>
      <ReminderList />
    </main>
  );
}
