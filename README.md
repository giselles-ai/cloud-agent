This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Agent Setup

### Environment

Create a `.env.local` with:

```
AI_GATEWAY_API_KEY=your_api_key_here
DATABASE_URL=your_database_url_here
DATABASE_AUTH_TOKEN=your_database_auth_token_here
SIGNUP_ALLOWED_EMAIL_DOMAINS=example.com,example.jp
```

`SIGNUP_ALLOWED_EMAIL_DOMAINS` is optional. When set, only exact-match domains are allowed for new user signups. Leave it empty or unset to allow all domains. (Quotes like `"example.com"` are allowed, but you can omit them.)

### DB Migration (Drizzle + Turso/libsql)

We use **Drizzle Kit SQL migrations** as the source of truth:

- **Generate migrations**: `bunx drizzle-kit generate`
- **Apply migrations**: `bunx drizzle-kit migrate`
- **Do NOT use** `drizzle-kit push` for production/shared environments (local prototyping only).

Migrations live in `db/migrations/` and should be committed, including `db/migrations/meta/**`.

### Browser Tool

Install Chromium for `agent-browser` (local only):

```bash
bunx agent-browser install
```

### One-shot Test

```bash
bun scripts/test-agent.ts "Summarize the README"
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
