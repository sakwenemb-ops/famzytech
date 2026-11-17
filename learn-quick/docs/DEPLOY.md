# Deploying Learn Quick

Learn Quick runs on **one Linux server (VPS)** with Docker. Four services run together:

| Service | What it does |
|---|---|
| `db` | PostgreSQL 16 (all data) |
| `app` | The website (Next.js). Applies database updates by itself when it starts. |
| `jobs` | Background jobs: payments, lesson completion, earnings, reminders, AI corrections, file clean-up |
| `caddy` | Web server in front: gets and renews the **HTTPS certificate automatically** |

> **Why not Vercel or Netlify?** Those platforms run code in short-lived functions. Learn Quick needs a process that stays running (live classroom, chat, notifications), a disk for uploaded documents, and background jobs. A small VPS is simpler and cheaper for this.

---

## 1. Get a server and a domain

- **Server:** Ubuntu 24.04, **2 vCPU and 4 GB RAM** (2 GB works with swap, see step 3), 40 GB disk or more. Any VPS provider works (for example Hetzner, DigitalOcean, OVH, Contabo, or a local Cameroonian host). For users in Cameroon, a data centre in **France or Germany** usually gives good speed.
- **Domain:** for example `learnquick.cm`. In your domain's DNS settings, add:
  - an **A record** `@` → your server's IP address
  - an **A record** `www` → the same IP

DNS can take up to an hour to work. Check with `ping learnquick.cm`.

## 2. Connect to the server

```bash
ssh root@YOUR_SERVER_IP
```

## 3. Install Docker, a firewall and swap

```bash
curl -fsSL https://get.docker.com | sh
```

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

Only if the server has 2 GB of RAM (building the site needs more memory):

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 4. Download the code

The repository is private, so the server needs access. The simplest way is a **deploy key**:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 && cat ~/.ssh/id_ed25519.pub
```

Copy the printed line. On GitHub, open the repository → **Settings → Deploy keys → Add deploy key**, paste it, leave "Allow write access" off, and save. Then:

```bash
mkdir -p /opt/learn-quick && cd /opt/learn-quick && git clone git@github.com:sakwenemb-ops/famzytech.git . && cd learn-quick/deploy
```

## Quick way: the installer

After steps 1, 2 and 4 (server, domain, code downloaded), one command does steps 3, 5, 6 and 8 for you: it asks your domain, admin login and service keys, generates the secrets, installs Docker, starts the site with HTTPS, creates the admin account and sets up nightly backups.

```bash
cd /opt/learn-quick/learn-quick/deploy && sudo ./install.sh
```

Then continue with step 7 (Campay webhook). The detailed steps below do the same by hand.

## 5. Fill in the settings

```bash
cp .env.example .env && nano .env
```

Generate the secrets on the server and paste them in:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"; echo "AUTH_SECRET=$(openssl rand -base64 32)"; echo "FILE_ENCRYPTION_KEY=$(openssl rand -base64 32)"
```

| Setting | What to put |
|---|---|
| `DOMAIN` | `learnquick.cm` (no https://) |
| `NEXT_PUBLIC_SITE_URL` | `https://learnquick.cm` |
| `POSTGRES_PASSWORD`, `AUTH_SECRET`, `FILE_ENCRYPTION_KEY` | The generated values. **Save `FILE_ENCRYPTION_KEY` in a password manager too**: without it, uploaded ID documents can never be opened. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Your admin login (a strong password) |
| `RESEND_API_KEY`, `EMAIL_FROM` | From resend.com (verify your domain there) |
| `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` | From Africa's Talking (SMS codes) |
| `CAMPAY_*` | From your Campay app. Use `CAMPAY_BASE_URL=https://demo.campay.net` first to test, then `https://www.campay.net`. |
| `TURN_*` | Your TURN server (step 9) |
| `ANTHROPIC_API_KEY` | Optional: AI correction in the library |

Save with `Ctrl+O`, `Enter`, then `Ctrl+X`.

## 6. Start everything

```bash
docker compose up -d --build
```

The first build takes 3 to 10 minutes. Then create the admin account, the settings and the library (once only):

```bash
docker compose run --rm app npx prisma db seed
```

Check that it works:

```bash
docker compose ps
```

All four services should be "Up" (`app` and `db` say "healthy"). Open `https://learnquick.cm`: the padlock appears after a few seconds (Caddy gets the certificate by itself). Sign in with your admin email and password.

## 7. Connect Campay

In the Campay dashboard:
1. Set the **webhook URL** to `https://learnquick.cm/api/webhooks/campay`.
2. Enable **API withdrawals** (for teacher payouts).

Then make **one small real payment** (book a cheap test lesson) and **one small withdrawal** before announcing the site.

## 8. Daily backups

```bash
crontab -e
```

Add this line (backup every night at 02:15):

```
15 2 * * * cd /opt/learn-quick/learn-quick/deploy && ./backup.sh >> backups/backup.log 2>&1
```

Backups are written to `deploy/backups/` and kept for 14 days. **Also copy them off the server regularly** (to your computer or a cloud storage bucket): a backup on the same server is lost if the server is lost.

## 9. TURN server for video calls

Some mobile networks block direct video connections. A TURN server relays those calls. Either:
- use a managed service (for example Metered, Twilio or Cloudflare TURN) and copy its address, username and password into `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`; or
- run `coturn` on a second small server.

After changing `.env`, apply it:

```bash
docker compose up -d
```

## 10. Monitoring

Add `https://learnquick.cm/api/health` to a free uptime monitor (for example UptimeRobot or Better Stack). It answers `{"ok":true}` when the site and the database work.

---

## Everyday tasks

**Update to the latest code** (database changes are applied automatically when the app starts):

```bash
cd /opt/learn-quick && git pull && cd learn-quick/deploy && docker compose up -d --build
```

**See what is happening:**

```bash
docker compose logs -f app
```

```bash
docker compose logs -f jobs
```

**Restart:**

```bash
docker compose restart
```

**Restore a backup** (replace the date). This overwrites the current data:

```bash
docker compose exec -T db pg_restore -U learnquick -d learnquick --clean --if-exists < backups/db-2026-11-16.dump
```

```bash
docker compose run --rm --no-deps -T --entrypoint "" app tar -xzf - -C /data < backups/files-2026-11-16.tar.gz
```

## Good to know

- Run **one** server. Live messages, the classroom and the abuse limits are kept in the app's memory. To run several servers later, Redis must be added first.
- If you change `DOMAIN` or `NEXT_PUBLIC_SITE_URL`, rebuild with `docker compose up -d --build` (the address is built into the site).
- `deploy/.env` holds your secrets. It is never committed to Git. Keep a copy in a password manager.
