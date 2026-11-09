import type { Metadata } from "next";
import { MemberPortal } from "@/components/MemberPortal";
import { availability } from "@/config/availability";
import { getMemberPhone } from "@/lib/memberAuth";
import { toE164 } from "@/lib/phone";
import styles from "../page.module.css";

export const metadata: Metadata = { title: "Minhas entrevistas" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyAppointmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const phone = await getMemberPhone().catch(() => null);
  // Link do lembrete de WhatsApp: ?tel=41999998888 entra direto com esse número.
  const { tel } = await searchParams;
  const linkPhone = typeof tel === "string" ? toE164(tel.slice(0, 20)) : null;
  // Se o link for de outro número que não o da sessão atual, vale o do link.
  const useLink = linkPhone !== null && linkPhone !== phone;

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
          loggedIn={Boolean(phone) && !useLink}
          linkPhone={useLink ? linkPhone : null}
          secretaryWhatsApp={availability.secretaryWhatsApp || null}
        />
      </main>
    </>
  );
}
