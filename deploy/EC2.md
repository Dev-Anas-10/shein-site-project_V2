# EC2 deployment

This repository runs Next.js behind Nginx and stores its application state in a local PostgreSQL database. PostgreSQL listens on `127.0.0.1:5432`, Next.js listens on `127.0.0.1:3000`, and Nginx serves the app over plain HTTP on port `80`.

## Before running the installer

1. Launch an Ubuntu EC2 instance with enough disk space for the repository and PostgreSQL. In its security group, allow SSH from your own IP and inbound TCP `80` from the internet. Do not expose port `5432`.
2. Find the instance's public IPv4 address. An Elastic IP keeps it stable when the instance stops and starts.
3. Clone the repository and run the installer from its root:

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   sudo bash scripts/deploy-ec2.sh
   ```

4. At the first prompt, enter the EC2 public IPv4 address (for example `18.222.10.20`). The script also accepts a domain name or a URL such as `http://18.222.10.20`.
5. When deployment finishes, open `http://<EC2-public-IPv4>`.

The installer installs Node.js 22, PostgreSQL, and Nginx; creates a restricted PostgreSQL role; builds and starts the app; and creates an admin account with a password entered without echoing it to the terminal. On instances with less than 2 GiB of RAM and swap, it creates a 2 GiB swap file for the production build. It does not install Certbot or configure HTTPS.

### HTTP login behavior

The EC2 installer sets `SESSION_COOKIE_SECURE=false` so session cookies work over HTTP. HTTP does not encrypt login passwords or session cookies in transit, so use this setup for testing and avoid using a password you use elsewhere. Google sign-in may also be unavailable from a public IP over HTTP; leave the Google Client ID blank in the installer if you are using this HTTP-only setup.

## Moving data from Supabase

When asked, choose the one-time migration and enter the existing Supabase project URL and its `service_role` key. The key is used only by the migration process and is not saved in the app's environment file. The migration imports the `users` and `orders` tables, including the order metadata stored in `payment._orderMeta`. It keeps the settings present in the repository's `data/db.json`. Shipments were not stored in Supabase by this codebase, so the new database starts with no shipments.

If you skip the migration, the app starts with empty users, orders, and shipments. The installer still creates the new admin account. Regular visitors can then register or sign in with email and password.

## Operations

```bash
sudo systemctl status shein-concierge
sudo journalctl -u shein-concierge -f
sudo systemctl restart shein-concierge
sudo nginx -t
```

To deploy an update, pull the repository changes and run `sudo bash scripts/deploy-ec2.sh` again. It reuses the database password and session secret already stored in `/opt/shein-concierge/.env.production`.

The application stores the current app state as one JSONB document in PostgreSQL because its existing data layer reads and writes the whole state together. Keep this deployment to one Next.js app process; the app's in-memory cache is not a multi-instance coordination mechanism. Back up the PostgreSQL database regularly before changing instance storage.
