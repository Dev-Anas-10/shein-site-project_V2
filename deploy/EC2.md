# EC2 deployment

This repository now runs Next.js behind Nginx and stores its application state in a local PostgreSQL database. PostgreSQL listens on `127.0.0.1:5432`; Next.js listens on `127.0.0.1:3000`. Nginx is the public entry point on ports 80 and 443.

## Before running the installer

1. Launch an Ubuntu EC2 instance with enough disk space for the repository and PostgreSQL. Add an EC2 security group rule for SSH from your own IP and HTTP/HTTPS (80 and 443) from the internet. Do not expose port 5432.
2. Create a DNS A record for your domain pointing at the instance's public IP. The installer obtains a Let's Encrypt certificate, so DNS must already resolve to the instance.
3. Clone the repository and run the installer from its root:

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   sudo bash scripts/deploy-ec2.sh
   ```

### Using DuckDNS

DuckDNS domains work with the installer's Certbot step. The script uses Certbot's Nginx plugin with the HTTP-01 challenge, so no DuckDNS token or TXT record is needed for certificate issuance.

1. In DuckDNS, create a hostname such as `my-shein-test.duckdns.org` and set its IPv4 address to the EC2 instance's public IPv4. An Elastic IP keeps that address stable across stop/start cycles; otherwise update the DuckDNS record whenever the public IP changes.
2. Allow inbound TCP 80 and 443 in the EC2 security group. HTTP-01 validation reaches the hostname over port 80.
3. Before running the installer, check that `nslookup my-shein-test.duckdns.org` returns the EC2 public IPv4.
4. At the installer prompt, enter `my-shein-test.duckdns.org` as the hostname. The script also strips an accidental `http://` or `https://` prefix and trailing path. Enter an email address for Let's Encrypt when prompted.

After Certbot succeeds, open `https://my-shein-test.duckdns.org`. Certbot's installed timer renews the certificate automatically; check it with `sudo certbot renew --dry-run`.

The installer installs Node.js 22, PostgreSQL, Nginx, and Certbot; creates a restricted PostgreSQL role; builds the app; configures Nginx and HTTPS; and creates an admin account with a password entered without echoing it to the terminal.

Google sign-in is optional. If enabled, set a Google OAuth Web Client ID in the installer and add the deployed `https://your-domain` origin to that OAuth client's authorized JavaScript origins.

## Moving data from Supabase

When asked, choose the one-time migration and enter the existing Supabase project URL and its `service_role` key. The key is used only by the migration process and is not saved in the app's environment file. The migration imports the `users` and `orders` tables, including the order metadata stored in `payment._orderMeta`. It keeps the settings present in the repository's `data/db.json`. Shipments were not stored in Supabase by this codebase, so the new database starts with no shipments.

If you skip the migration, the app starts with empty users, orders, and shipments. The installer still creates the new admin account. Regular visitors can then register or sign in with Google.

## Operations

```bash
sudo systemctl status shein-concierge
sudo journalctl -u shein-concierge -f
sudo systemctl restart shein-concierge
sudo nginx -t
```

To deploy an update, pull the repository changes and run `sudo bash scripts/deploy-ec2.sh` again. It reuses the database password and session secret already stored in `/opt/shein-concierge/.env.production`.

The application stores the current app state as one JSONB document in PostgreSQL because its existing data layer reads and writes the whole state together. Keep this deployment to one Next.js app process; the app's in-memory cache is not a multi-instance coordination mechanism. Back up the PostgreSQL database regularly before changing instance storage.
