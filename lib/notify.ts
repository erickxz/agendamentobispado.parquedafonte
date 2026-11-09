import "server-only";
import type { DateTime } from "luxon";
import nodemailer, { type Transporter } from "nodemailer";
import { getMailEnv, isProduction } from "./env";
import { formatE164ForDisplay } from "./phone";
import { formatLongDate, formatMonthShort, formatTime, formatWeekdayShort } from "./time";

/**
 * Avisos por e-mail ao secretário quando um membro marca, remarca ou cancela.
 * Nunca derruba a ação do membro: se o e-mail falhar, só registra no log.
 */

export type BookingChange =
  | { kind: "created"; nome: string; telefone: string; start: DateTime }
  | { kind: "rescheduled"; nome: string; telefone: string; start: DateTime; previousStart: DateTime }
  | { kind: "cancelled"; nome: string; telefone: string; start: DateTime };

let transporter: Transporter | null | undefined;

function getTransporter(): { transporter: Transporter; from: string; to: string[] } | null {
  const env = getMailEnv();
  if (!env) return null;
  if (transporter === undefined) {
    transporter = nodemailer.createTransport({ service: "gmail", auth: { user: env.user, pass: env.pass } });
  }
  return transporter ? { transporter, from: env.user, to: env.to } : null;
}

/* ---------- Identidade visual do site (mesmos tokens de app/globals.css) ---------- */

const C = {
  navy: "#1b3350",
  navyDark: "#12233a",
  sky: "#2e8bc0",
  skyInk: "#1f6e9c",
  skySoft: "#e8f2f8",
  paper: "#f7f8fa",
  surface: "#ffffff",
  ink: "#1f2933",
  muted: "#5f6b7a",
  line: "#dce1e7",
  success: "#1e7b4e",
  successSoft: "#edf7f1",
  danger: "#b42318",
  dangerSoft: "#fdf0ef",
};

// Clientes que aceitam fontes externas (Apple Mail, iOS) usam as do site; o Gmail cai nas alternativas.
const SERIF = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const SANS = "'Source Sans 3', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&family=Source+Serif+4:wght@600&display=swap";

const KINDS: Record<
  BookingChange["kind"],
  { subject: string; title: string; subtitle: string; icon: string; color: string; soft: string }
> = {
  created: {
    subject: "Nova entrevista",
    title: "Nova entrevista marcada",
    subtitle: "O horário já está reservado na agenda do bispado.",
    icon: "&#10003;", // ✓
    color: C.success,
    soft: C.successSoft,
  },
  rescheduled: {
    subject: "Entrevista remarcada",
    title: "Entrevista remarcada",
    subtitle: "O membro trocou o horário. O lembrete precisa ser enviado de novo.",
    icon: "&#8635;", // ↻
    color: C.skyInk,
    soft: C.skySoft,
  },
  cancelled: {
    subject: "Entrevista cancelada",
    title: "Entrevista cancelada",
    subtitle: "O membro cancelou. O horário já está livre para outros membros.",
    icon: "&#10005;", // ✕
    color: C.danger,
    soft: C.dangerSoft,
  },
};

/** "Domingo, 15 de novembro" */
function longDate(dt: DateTime): string {
  const label = formatLongDate(dt);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "dom 15/11 19:00" para o assunto, curto o bastante para ler na notificação do celular. */
function shortWhen(dt: DateTime): string {
  return `${dt.setLocale("pt-BR").toFormat("ccc dd/MM").replace(".", "")} ${formatTime(dt)}`;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Quadradinho de data igual ao da tela de confirmação do site (mês, dia, dia da semana). */
function dateTile(dt: DateTime, muted = false): string {
  const band = muted ? "#9aa5b1" : C.navy;
  const day = muted ? "#9aa5b1" : C.navy;
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="88" style="width:88px;border:1px solid ${C.line};border-radius:8px;border-collapse:separate;background:${C.surface}">
  <tr><td align="center" style="background:${band};color:#ffffff;font-family:${SANS};font-size:13px;font-weight:600;line-height:24px;letter-spacing:0.04em;text-transform:uppercase;border-radius:7px 7px 0 0">${esc(formatMonthShort(dt))}</td></tr>
  <tr><td align="center" style="font-family:${SERIF};font-size:36px;font-weight:600;line-height:42px;color:${day};padding-top:6px${muted ? ";text-decoration:line-through" : ""}">${dt.day}</td></tr>
  <tr><td align="center" style="font-family:${SANS};font-size:13px;line-height:18px;color:${C.muted};padding-bottom:10px">${esc(formatWeekdayShort(dt))}</td></tr>
</table>`;
}

/** Data por extenso + horário, centralizados embaixo do quadradinho. */
function whenBlock(dt: DateTime, opts: { muted?: boolean; small?: boolean } = {}): string {
  const color = opts.muted ? C.muted : C.navy;
  const strike = opts.muted ? "text-decoration:line-through;" : "";
  return `<div style="font-family:${SERIF};font-size:${opts.small ? 16 : 20}px;font-weight:600;line-height:${opts.small ? 22 : 26}px;color:${color};${strike}margin-top:12px">${esc(longDate(dt))}</div>
<div style="font-family:${SANS};font-size:${opts.small ? 15 : 17}px;line-height:24px;color:${opts.muted ? C.muted : C.ink};${strike}margin-top:2px">às <strong>${esc(formatTime(dt))}</strong></div>`;
}

/** Linha do quadro de dados: rótulo à esquerda, valor à direita, mesma linha de base. */
function detailRow(label: string, valueHtml: string, last = false): string {
  const border = last ? "" : `border-bottom:1px solid ${C.line};`;
  return `<tr>
  <td align="left" valign="middle" style="padding:12px 16px;${border}font-family:${SANS};font-size:15px;line-height:22px;color:${C.muted}">${esc(label)}</td>
  <td align="right" valign="middle" style="padding:12px 16px;${border}font-family:${SANS};font-size:15px;line-height:22px;color:${C.ink}">${valueHtml}</td>
</tr>`;
}

function buildEmail(change: BookingChange) {
  const k = KINDS[change.kind];
  const phone = formatE164ForDisplay(change.telefone);
  const subject = `${isProduction ? "" : "[teste] "}${k.subject}: ${change.nome} – ${shortWhen(change.start)}`;

  // Texto simples (clientes sem HTML e prévia da notificação).
  const textRows = [`Nome: ${change.nome}`];
  if (change.kind === "rescheduled") {
    textRows.push(`Antes: ${longDate(change.previousStart)} às ${formatTime(change.previousStart)}`);
    textRows.push(`Agora: ${longDate(change.start)} às ${formatTime(change.start)}`);
  } else {
    textRows.push(`${change.kind === "cancelled" ? "Era em" : "Quando"}: ${longDate(change.start)} às ${formatTime(change.start)}`);
  }
  textRows.push(`WhatsApp: ${phone}`);
  const text = [k.title, k.subtitle, "", ...textRows, "", "Ala Parque da Fonte · Agendamento de entrevistas"].join("\n");

  // Destaque da data: um quadradinho, ou "antes → agora" na remarcação.
  const hero =
    change.kind === "rescheduled"
      ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
  <td align="center" valign="top" width="160" style="width:160px">
    <div style="font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};margin-bottom:8px">Antes</div>
    <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td>${dateTile(change.previousStart, true)}</td></tr></table>
    ${whenBlock(change.previousStart, { muted: true, small: true })}
  </td>
  <td align="center" valign="top" style="padding:62px 6px 0;font-family:${SANS};font-size:26px;line-height:26px;color:${C.sky}">&rarr;</td>
  <td align="center" valign="top" width="160" style="width:160px">
    <div style="font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.skyInk};margin-bottom:8px">Agora</div>
    <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td>${dateTile(change.start)}</td></tr></table>
    ${whenBlock(change.start, { small: true })}
  </td>
</tr></table>`
      : `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td>${dateTile(change.start, change.kind === "cancelled")}</td></tr></table>
${whenBlock(change.start, { muted: change.kind === "cancelled" })}`;

  const rows = [
    detailRow("Nome", `<strong style="color:${C.navy}">${esc(change.nome)}</strong>`),
    detailRow(
      "WhatsApp",
      `<a href="https://wa.me/${esc(change.telefone)}" style="color:${C.skyInk};text-decoration:underline">${esc(phone)}</a>`,
      true,
    ),
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<link href="${FONTS_URL}" rel="stylesheet">
<style>
  @media (max-width: 520px) {
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(change.nome)} · ${esc(longDate(change.start))} às ${esc(formatTime(change.start))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}">
<tr><td align="center" style="padding:28px 12px 36px">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

    <!-- Cabeçalho: como o do site (azul-marinho, faixa azul-clara, nome da ala centralizado) -->
    <tr><td align="center" class="pad" style="background:${C.navy};border-bottom:3px solid ${C.sky};border-radius:12px 12px 0 0;padding:22px 32px 20px">
      <div style="font-family:${SERIF};font-size:22px;font-weight:600;line-height:28px;color:#ffffff">Ala Parque da Fonte</div>
      <div style="font-family:${SANS};font-size:13px;line-height:18px;color:#c9d6e3;margin-top:4px">A Igreja de Jesus Cristo dos Santos dos Últimos Dias</div>
    </td></tr>

    <!-- Cartão -->
    <tr><td style="background:${C.surface};border:1px solid ${C.line};border-top:0;border-radius:0 0 12px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

        <!-- Status -->
        <tr><td align="center" class="pad" style="padding:30px 32px 0">
          <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
            <td align="center" valign="middle" width="44" height="44" style="width:44px;height:44px;border-radius:22px;background:${k.soft};color:${k.color};font-family:${SANS};font-size:22px;font-weight:600;line-height:44px">${k.icon}</td>
          </tr></table>
          <div style="font-family:${SERIF};font-size:24px;font-weight:600;line-height:30px;color:${C.navy};margin-top:14px">${esc(k.title)}</div>
          <div style="font-family:${SANS};font-size:15px;line-height:22px;color:${C.muted};margin-top:6px">${esc(k.subtitle)}</div>
        </td></tr>

        <!-- Data em destaque -->
        <tr><td align="center" class="pad" style="padding:26px 32px 0">
          ${hero}
        </td></tr>

        <!-- Dados da pessoa -->
        <tr><td class="pad" style="padding:28px 32px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:8px;border-collapse:separate;background:${C.paper}">
            ${rows}
          </table>
        </td></tr>

        <!-- Botão no estilo .btn-primary do site -->
        <tr><td align="center" class="pad" style="padding:24px 32px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
            <td align="center" style="background:${C.navy};border-radius:6px">
              <a href="https://wa.me/${esc(change.telefone)}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:6px">Abrir conversa no WhatsApp</a>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>

    <!-- Rodapé -->
    <tr><td align="center" style="padding:20px 12px 0;font-family:${SANS};font-size:13px;line-height:19px;color:${C.muted}">
      Aviso automático do agendamento de entrevistas<br>Ala Parque da Fonte · São José dos Pinhais – PR
    </td></tr>
  </table>

</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}

export async function notifyBookingChange(change: BookingChange): Promise<void> {
  const mail = getTransporter();
  if (!mail) return; // avisos desligados (variáveis não configuradas)
  try {
    const { subject, text, html } = buildEmail(change);
    await mail.transporter.sendMail({
      from: `"Agendamento Ala Parque da Fonte" <${mail.from}>`,
      to: mail.to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("[notify] falha ao enviar e-mail", err);
  }
}
