![Screenshot of Embedded Dives](public/thumbnail.png)

# Embedded Dives: vibecodable data apps

[Dives](https://motherduck.com/product/dives/) are code-based, fully customizable React components that can query [MotherDuck](https://motherduck.com), a serverless cloud data warehouse powered by DuckDB. Dives lets you build interactive dashboards, presentations, or even data-driven games, all fetching live data through SQL queries. Embedded in your app, Dives give you infinite flexibility over how data is presented, without the constraints of traditional BI tools.

This template gives you a deployable Next.js app where users can browse starter Dives, open full-page previews, and use AI chat to customize a Dive in place.

**[Live demo →](https://motherduck-embedded-dives.vercel.app/)**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmotherduckdb%2Fnextjs-motherduck-embedded-dives&project-name=motherduck-embedded-dives&repository-name=motherduck-embedded-dives&demo-title=Embedded%20Dives%3A%20vibecodable%20data%20apps&demo-description=Next.js%20template%20for%20user-defined%2C%20AI-powered%20data%20apps%20using%20MotherDuck%20embedded%20Dives&demo-url=https%3A%2F%2Fmotherduck-embedded-dives.vercel.app%2F&demo-image=https%3A%2F%2Fgithub.com%2Fmotherduckdb%2Fnextjs-motherduck-embedded-dives%2Fblob%2Fmain%2Fpublic%2Fthumbnail.png%3Fraw%3Dtrue&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&skippable-integrations=1&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22motherduck%22%2C%22productSlug%22%3A%22motherduck%22%2C%22protocol%22%3A%22storage%22%7D%5D)

## Features

- **Starter dives**: 3 example dives: slides, dashboard, and game mini-apps built on top of NYC 311 data, showed in the Dive gallery page with live previews.
- **AI dive remix workflow**: user can explore the underlying data and customize each dive through a natural language interface
- **Auth options**: public demo mode with anonymous sessions, password sign-in with one shared MotherDuck account, or password sign-in with each user providing a MotherDuck personal access token
- **AI provider options**: Anthropic, OpenAI, or Vercel AI Gateway through Vercel AI SDK

> Demo auth note: included auth is for demo purposes. For production use cases, connect your own identity provider and authorization model before shipping.

## Deploy

Click **Deploy with Vercel**. The clone flow provisions:

1. MotherDuck integration, which can set `MOTHERDUCK_TOKEN`
2. Supabase integration, which can set `POSTGRES_URL`
3. This template's Vercel build command, which runs database migrations from `migrations/`

If you do not install either integration, set the matching environment variable yourself before deploying.

After deploy, add at least one AI key in Vercel project settings, then redeploy:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `AI_GATEWAY_API_KEY`

Manual deploy:

```bash
vercel link
vercel env pull .env.local
vercel deploy
```

## Local Development

```bash
git clone <your-repo-url>
cd motherduck-dives
npm install
cp .env.example .env.local
```

Run local Postgres:

```bash
docker run --name motherduck-dives-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=motherduck_dives \
  -p 5433:5432 \
  -d postgres:16
```

Set local database URL:

```bash
POSTGRES_URL=postgres://postgres:postgres@localhost:5433/motherduck_dives
```

Start app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), choose a Dive, click **Remix**, and chat.

Useful commands:

```bash
npm run lint
npm exec tsc -- --noEmit
npm run build
npm run build:with-migrate
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `MOTHERDUCK_TOKEN` | Yes | MotherDuck admin token used to provision service accounts and embed sessions |
| `POSTGRES_URL` | Yes | Postgres connection string |
| `ANTHROPIC_API_KEY` | One AI key required | Anthropic API key |
| `OPENAI_API_KEY` | One AI key required | OpenAI API key |
| `AI_GATEWAY_API_KEY` | One AI key required | Vercel AI Gateway API key |
| `AI_MODEL_ANTHROPIC` | No | Anthropic model override, defaults to `claude-sonnet-4-6` |
| `AI_MODEL_OPENAI` | No | OpenAI model override, defaults to `gpt-5.4` |
| `AI_MODEL_GATEWAY` | No | AI Gateway model override, defaults to `anthropic/claude-sonnet-4.6` |

Advanced overrides:

| Variable | Required | Description |
| --- | --- | --- |
| `MOTHERDUCK_API_BASE` | No | MotherDuck API URL override |
| `MOTHERDUCK_MCP_URL` | No | MotherDuck MCP endpoint override |
| `MOTHERDUCK_PG_HOST` | No | MotherDuck Postgres endpoint host override |

## Auth Modes

Default mode is public demo mode. Visitors can preview shared starter Dives. First edit creates an isolated anonymous MotherDuck service account and cloned starter Dives for that browser session.

Password mode requires sign-in and uses one shared MotherDuck service account:

```bash
PASSWORD_AUTH_ENABLED=true
AUTH_SECRET=<long-random-string>
MOTHERDUCK_SHARED_SERVICE_ACCOUNT_USERNAME=app_shared
```

Personal token mode requires sign-in and asks each user for their own MotherDuck personal access token:

```bash
PASSWORD_AUTH_ENABLED=true
AUTH_SECRET=<long-random-string>
MOTHERDUCK_AUTH_MODE=personal_pat
MOTHERDUCK_PAT_ENCRYPTION_KEY=<long-random-string>
```

Auth mode options:

- `PASSWORD_AUTH_ENABLED`: set to `true` to require email/password sign-in.
- `AUTH_SECRET`: required when password auth is enabled. Use a long random string for NextAuth session signing.
- `MOTHERDUCK_SHARED_SERVICE_ACCOUNT_USERNAME`: optional shared MotherDuck service account username. Defaults to `app_shared`.
- `MOTHERDUCK_AUTH_MODE`: set to `personal_pat` to require each signed-in user to provide a MotherDuck PAT.
- `MOTHERDUCK_PAT_ENCRYPTION_KEY`: required when `MOTHERDUCK_AUTH_MODE=personal_pat`. Use a long random string to encrypt stored MotherDuck PATs.
- `MOTHERDUCK_TOKEN_APP_NAME`: optional app name shown on the MotherDuck token request page. Defaults to `motherduck-dives`.
- `AUTH_TRUSTED_ORIGINS`: optional comma-separated `scheme://host[:port]` values allowed for mutating requests behind proxies or custom origins.

## Customize

### Starter Dives

Edit starter Dive components:

- `dives/presentation-dive.tsx`
- `dives/dashboard-dive.tsx`
- `dives/game-dive.tsx`

Starter metadata lives in `app/_lib/dive-provisioning.ts`.

### AI Behavior

- Change model defaults in `app/_lib/chat/ai-provider.ts` or set model env vars.
- Change editing instructions in `app/_lib/chat/system-prompt.ts`.

### Data

Starter Dives use MotherDuck `sample_data`. To use your own data:

1. Load or attach data in MotherDuck.
2. Update SQL in the starter Dive files.
3. If users should only see their own data, model access around MotherDuck shares, per-user databases, or row-level filters before production.

## Production Checklist

- Replace demo auth with your app's identity provider.
- Add authorization around users, workspaces, Dives, chat history, and data access.
- Add rate limits to chat and provisioning routes.
- Keep `assertSameOrigin(request)` on every mutating route.
- Add monitoring for AI usage, MCP calls, embed session creation, and provisioning failures.
- Add cleanup for expired anonymous demo sessions and their MotherDuck service accounts before running a public demo at scale.

## License

MIT
