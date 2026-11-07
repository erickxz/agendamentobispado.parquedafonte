import Link from "next/link";
import { availability, mapsUrl, scheduleSummary } from "@/config/availability";
import { BookingFlow } from "@/components/BookingFlow";
import { getTurnstileSiteKey } from "@/lib/env";
import styles from "./page.module.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined, maxLength: number): string {
  const v = Array.isArray(value) ? value[0] : value;
  return (v ?? "").slice(0, maxLength);
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Convite do secretário: ?nome=...&tel=... Só pré-preenche; o backend valida tudo de novo.
  const invite = { nome: firstParam(params.nome, 80), telefone: firstParam(params.tel, 20) };
  const secretary = availability.secretaryWhatsApp;

  return (
    <>
      <div className={styles.masthead}>
        <div className="container">
          <h1 className={styles.title}>Marcar entrevista com o bispado</h1>
          <p className={styles.lead}>
            Escolha um dia e um horário livre. A entrevista entra direto na agenda do bispado e você recebe a confirmação
            na hora.
          </p>
          <Link href="/minhas-entrevistas" className={styles.mastheadLink}>
            Já marcou? Ver, remarcar ou cancelar
          </Link>
        </div>
      </div>

      <main className={`container ${styles.layout}`}>
        <aside className={`${styles.card} ${styles.facts}`} aria-label="Informações da entrevista">
          <dl className={styles.factList}>
            <div>
              <dt>Duração</dt>
              <dd>{availability.durationMinutes} minutos</dd>
            </div>
            <div>
              <dt>Atendimento</dt>
              <dd>
                {scheduleSummary().map((line) => (
                  <span key={line} className={styles.line}>
                    {line}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Local</dt>
              <dd>
                <span className={styles.line}>{availability.location.name}</span>
                <span className={`${styles.line} ${styles.muted}`}>{availability.location.address}</span>
                <a className={styles.mapLink} href={mapsUrl()} target="_blank" rel="noopener noreferrer">
                  Ver no mapa
                </a>
              </dd>
            </div>
          </dl>
        </aside>

        <section className={styles.booking} aria-label="Agendamento">
          <BookingFlow siteKey={getTurnstileSiteKey()} invite={invite} />
        </section>

        <aside className={styles.howto} aria-labelledby="como-funciona">
          <h2 id="como-funciona" className={styles.sideTitle}>
            Como funciona
          </h2>
          <ol className={styles.steps}>
            <li>
              <strong>Escolha o dia e o horário.</strong> Só aparecem horários realmente livres na agenda do bispado.
            </li>
            <li>
              <strong>Informe nome e WhatsApp.</strong> Não perguntamos o motivo da entrevista.
            </li>
            <li>
              <strong>Receba um lembrete.</strong> O secretário envia uma mensagem no dia anterior.
            </li>
          </ol>
          <p className={styles.help}>
            Precisa remarcar ou cancelar? <Link href="/minhas-entrevistas">Acesse Minhas entrevistas</Link> com o seu
            WhatsApp.
            {secretary && (
              <>
                {" "}
                Dúvidas?{" "}
                <a href={`https://wa.me/${secretary}`} target="_blank" rel="noopener noreferrer">
                  Fale com o secretário da ala
                </a>
                .
              </>
            )}
          </p>
        </aside>
      </main>
    </>
  );
}
