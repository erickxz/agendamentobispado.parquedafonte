import type { Metadata } from "next";
import { MemberPortal } from "@/components/MemberPortal";
import { availability } from "@/config/availability";
import { getMemberPhone } from "@/lib/memberAuth";
import styles from "../page.module.css";

export const metadata: Metadata = { title: "Minhas entrevistas" };
export const dynamic = "force-dynamic";

export default async function MyAppointmentsPage() {
  const phone = await getMemberPhone().catch(() => null);

  return (
    <>
      <div className={styles.masthead}>
        <div className="container">
          <h1 className={styles.title}>Minhas entrevistas</h1>
          <p className={styles.lead}>Veja, remarque ou cancele as entrevistas que você marcou com o bispado.</p>
        </div>
      </div>

      <main className={`container ${styles.single}`}>
        <MemberPortal
          loggedIn={Boolean(phone)}
          secretaryWhatsApp={availability.secretaryWhatsApp || null}
        />
      </main>
    </>
  );
}
