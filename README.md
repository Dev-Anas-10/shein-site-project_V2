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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.



## Self-hosted EC2 deployment

See [deploy/EC2.md](deploy/EC2.md) for Ubuntu setup, PostgreSQL migration, Nginx, and admin account instructions. Run `sudo bash scripts/deploy-ec2.sh` from the cloned repository on the EC2 instance; the site will be served over HTTP on the EC2 public IP.

### Create an admin account on EC2

Connect to the EC2 instance over SSH as `root`, then run:

```bash
cd /opt/shein-concierge
set -a
source .env.production
set +a
sudo -u sheinapp --preserve-env=PGHOST,PGPORT,PGDATABASE,PGUSER,PGPASSWORD,PGPOOL_MAX \
  bash -lc 'cd /opt/shein-concierge && npm run admin:create'
```

Enter the admin name and email when prompted, then enter a password with at least 12 characters. Password input is hidden. After `Admin account is ready` appears, restart the app so it reloads the user list from PostgreSQL:

```bash
sudo systemctl restart shein-concierge
sudo systemctl status shein-concierge --no-pager
```

Then sign in at `http://<EC2-public-IPv4>/admin` with that email and password. If the account command stays open after printing the success message, the account has already been saved; press `Ctrl+C`, then run the restart commands above.
