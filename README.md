# Law Agent

LegalTech MVP – AI-gestützter Insolvenz-Intake für österreichische Kanzleien.

- **Landing:** https://www.law-agent.at
- **App:** https://app.law-agent.at
- **Status:** [docs/STATUS.md](docs/STATUS.md)
- **Master-Prompt:** [PROJECT.md](PROJECT.md)
- **Schema:** [docs/schema.sql](docs/schema.sql)
- **API Contracts:** [docs/api-contracts.md](docs/api-contracts.md)
- **Agents:** [AGENTS/](AGENTS/)

## Quick Start (Local Dev)

```bash
pnpm install
cp .env.example .env.local   # secrets eintragen
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Deployment

`main` → CI/CD → SSH-Deploy → VPS `187.127.84.152` → `https://app.law-agent.at`.

## Disclaimer

KI-Outputs sind Entwürfe und müssen **anwaltlich geprüft** werden. Keine Rechtsberatung im Sinne des RAO.
