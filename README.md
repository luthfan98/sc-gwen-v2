This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Setup di PC Lain

1. Install dependency frontend:
```bash
npm install
```

2. Buat `.env` dari `.env.example`, lalu sesuaikan target backend:
```env
NEXT_PUBLIC_API_URL=/api
BACKEND_API_URL=http://IP_BACKEND:3500/api
```

`NEXT_PUBLIC_API_URL=/api` membuat browser selalu memanggil host frontend yang sedang dibuka. Next.js akan meneruskan request `/api/*` ke `BACKEND_API_URL`, jadi URL backend cukup diganti lewat env tanpa edit kode.

3. Jalankan frontend:
```bash
npm run dev
```

Frontend bind ke `0.0.0.0`, jadi bisa dibuka dari perangkat lain lewat:
```text
http://IP_PC_FRONTEND:3000
```

Port frontend bisa diganti dengan env/argumen Next.js, misalnya:
```bash
npm run dev -- --port 3001
```

## Backend

Masuk ke folder `BACKEND`, install dependency, lalu buat `.env` dari `.env.example`:
```bash
cd BACKEND
npm install
npm run dev
```

Pastikan `HOST=0.0.0.0` agar backend bisa diakses dari PC lain, dan sesuaikan `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, serta `WEB_BASE_URL`.

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
