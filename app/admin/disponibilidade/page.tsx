import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { AvailabilityManager } from "@/components/admin/AvailabilityManager";
import { availability } from "@/config/availability";
import { isAdmin } from "@/lib/adminAuth";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Disponibilidade" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  if (!(await isAdmin())) redirect("/admin/login?next=/admin/disponibilidade");

  return (
    <main className={`container ${styles.main}`}>
      <AdminNav current="/admin/disponibilidade" />
      <div>
        <h1>Disponibilidade</h1>
        <p className={styles.lead}>
          Clique num horário livre para bloquear ou num bloqueado para liberar. Cada bloqueio vira um evento
          &ldquo;Bloqueado para entrevistas&rdquo; na agenda da ala; apagar o evento pela agenda também libera o horário.
        </p>
      </div>
      <AvailabilityManager defaultDays={availability.daysAhead} />
    </main>
  );
}
