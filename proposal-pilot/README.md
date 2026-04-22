This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
AI_MODE=mock
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

The same variables are required in Vercel Project Settings for Production, Preview, and Development.
Use `AI_MODE=mock` for no-cost demos and `AI_MODE=live` when you are ready to call Perplexity.

## Supabase

Apply the migrations in `supabase/migrations` to initialize the database schema, pgvector search, agent operation logs, opportunity discovery tables, proposal revision history, and the private `documents` Storage bucket used by uploads.

## Mock Testing

When `AI_MODE=mock`, ProposalPilot never calls Perplexity. It returns deterministic fixture analysis, drafting, compliance, discovery, scoring, Sonar research, and embeddings. Use the Workspace page's **Load Demo** button to seed a demo capability statement, mock RFP, requirements, compliance matrix, first draft, and activity logs.

Sample files are available in `mock-data/` if you prefer to test the upload flow manually.

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
