# Agendamento de entrevistas · Ala Parque da Fonte

Next.js 16 + Google Agenda (service account). Sem banco de dados.

- Página do membro: `/`
- Painel de lembretes: `/admin/lembretes`
- Configuração de dias, horários, duração, bloqueios, local e texto do lembrete: `config/availability.ts`

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev
```

## 1. Google Cloud (Calendar API + service account)

1. Acesse https://console.cloud.google.com e crie um projeto (ex.: `agendamento-ala`).
2. **APIs e serviços › Biblioteca**: procure **Google Calendar API** e clique em **Ativar**.
3. **IAM e administrador › Contas de serviço › Criar conta de serviço**: dê um nome (ex.: `agendamento`) e conclua sem atribuir papéis.
4. Abra a conta criada › **Chaves › Adicionar chave › Criar nova chave › JSON**. O arquivo será baixado.
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (cole entre aspas, com os `\n` como estão)
   - Guarde o JSON fora do projeto e não faça commit dele.
5. No Google Agenda da conta da ala (calendar.google.com): passe o mouse na agenda › **⋮ › Configurações e compartilhamento**.
   - **Compartilhar com pessoas específicas › Adicionar pessoas**: cole o e-mail da service account com a permissão **Fazer alterações nos eventos**.
   - **Integrar agenda › ID da agenda** → `GOOGLE_CALENDAR_ID` (na agenda principal da conta, o ID é o próprio e-mail).

Observações:
- Qualquer evento na agenda bloqueia o horário, **exceto** eventos marcados como "Disponível" (o Google não os considera ocupados).
- Para bloquear um dia inteiro, crie um evento de dia inteiro com "Ocupado" ou use `blockedDates` na config.

## 2. Cloudflare Turnstile

1. https://dash.cloudflare.com › **Turnstile › Add widget**.
2. Nome: `Agendamento ala`. Hostnames: o domínio da Vercel (ex.: `agendamento-ala.vercel.app`) e `localhost`.
3. Modo: **Managed**.
4. Copie **Site Key** → `TURNSTILE_SITE_KEY` e **Secret Key** → `TURNSTILE_SECRET_KEY`.

Em desenvolvimento, as chaves de teste do `.env.example` sempre aprovam.

## 3. Upstash Redis (rate limit)

1. https://console.upstash.com › **Create Database** (Redis, plano Free, região `sa-east-1` São Paulo).
2. Na aba **REST API**, copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.

Sem essas variáveis, o limite funciona em memória. Isso serve para desenvolvimento, mas em produção não é compartilhado entre as instâncias.

Limites atuais (`lib/rateLimit.ts`): 5 agendamentos a cada 10 min por IP e 5 tentativas de login a cada 15 min por IP.

## 4. Deploy na Vercel

1. Suba o projeto para um repositório no GitHub (o `.gitignore` já exclui `.env*` e JSONs de service account).
2. https://vercel.com › **Add New › Project** › importe o repositório. O framework é detectado como Next.js.
3. Em **Settings › Environment Variables**, cadastre todas as variáveis do `.env.example`:
   `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, `ADMIN_PASSWORD`,
   `SESSION_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
   - `GOOGLE_PRIVATE_KEY`: cole o valor com os `\n` literais. O código converte em quebras de linha.
   - `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
4. **Deploy**. Depois, adicione o domínio final nos hostnames do widget do Turnstile.
5. Teste: abra `/`, marque um horário e confira o evento no Google Agenda da ala.

## Painel da secretaria (`/admin`)

- **Lembretes**: entrevistas de hoje, amanhã ou dos próximos 7 dias, com o botão do WhatsApp.
- **Disponibilidade**: clique num horário para bloquear ou liberar, bloqueie dias inteiros e abra horários extras.
  Tudo vira evento na agenda da ala:
  - "Bloqueado para entrevistas" (ocupado): tira o horário da lista do membro.
  - "Aberto para entrevistas" (disponível): acrescenta horários, por exemplo numa quarta de conselho em que não houve reunião.
  Apagar o evento direto no Google Agenda desfaz a ação.
- **Histórico**: entrevistas realizadas mês a mês, com busca por nome e registro de "Compareceu" ou "Faltou" (salvo no próprio evento).

Para desenvolver sem o Google, use `MOCK_CALENDAR=true` no `.env.local`. A agenda simulada fica em memória e é recriada a cada reinício.

## Regras de horário

Em `config/availability.ts`. Janelas quinzenais usam `repeat: { everyWeeks: 2, startingFrom: "AAAA-MM-DD" }`, onde a data é um dia **com** atendimento.

## Convite com dados preenchidos

`https://seu-dominio/?nome=Maria%20Souza&tel=41999998888`

## Preparado para a v2

- `extendedProperties.private.cancelToken` já é gravado em cada evento (link de cancelar/remarcar).
- `config/availability.ts` é tipado para virar JSON editável por um painel.
- `lib/reminders/index.ts` concentra o envio: para automatizar, crie um canal com `send()` e troque `reminderChannel`.
