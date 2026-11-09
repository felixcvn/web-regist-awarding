This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Security and deployment

See [SECURITY-DEPLOYMENT.md](SECURITY-DEPLOYMENT.md) for database prerequisites, trusted proxy configuration, student-import limits, ticket revocation, and isolated regression checks. For Rumahweb's internal MySQL/MariaDB, follow [MYSQL-CPANEL.md](MYSQL-CPANEL.md). Environment variables are documented in [`.env.example`](.env.example).

The baseline findings and remediation status are recorded in [SECURITY-AUDIT-2026-11-07.md](SECURITY-AUDIT-2026-11-07.md).

## cPanel / Rumahweb

See [CPANEL-DEPLOY.md](CPANEL-DEPLOY.md) for the Node.js 22 startup, Linux build
workflow, database and environment setup, and upload instructions. Build a release
with `npm run package:cpanel -- --url https://your-subdomain.example.com` on Linux,
or run **Build cPanel package** in GitHub Actions. Packages are saved in
`build/cpanel/`; the cPanel startup file is `server.js`.

Run `npm run verify:cpanel` after packaging to check the extracted release with
production-only dependencies and a selector-style `node_modules` symlink. The
Linux workflow runs this check before publishing its artifact.

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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
