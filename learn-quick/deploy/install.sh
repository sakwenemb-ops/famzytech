#!/usr/bin/env bash
# Learn Quick: one-time installer for a fresh Ubuntu server.
# Run from the deploy folder as root:   sudo ./install.sh
# It asks a few questions, writes deploy/.env, installs Docker, starts the site with HTTPS,
# creates the admin account and sets up nightly backups. Safe to run again.
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ask() { # ask VAR "Question" [default] [secret]
  local var=$1 q=$2 def=${3:-} secret=${4:-} val=""
  if [ -n "${!var:-}" ]; then return; fi # already set (environment or earlier answer)
  if [ -n "$secret" ]; then read -r -s -p "$q: " val; echo; else read -r -p "$q${def:+ [$def]}: " val; fi
  printf -v "$var" '%s' "${val:-$def}"
}

[ "$(id -u)" -eq 0 ] || { echo "Please run as root: sudo ./install.sh"; exit 1; }

if [ -f .env ]; then
  say "deploy/.env already exists: keeping your settings."
else
  say "Learn Quick setup. Press Enter to skip an optional item (you can add it later in deploy/.env)."
  ask DOMAIN "Your domain, without https:// (e.g. learnquick.cm)"
  [ -n "$DOMAIN" ] || { echo "A domain is required."; exit 1; }
  ask SEED_ADMIN_EMAIL "Admin email (your login)"
  ask SEED_ADMIN_PASSWORD "Admin password (at least 10 characters)" "" secret
  [ ${#SEED_ADMIN_PASSWORD} -ge 10 ] || { echo "Password too short."; exit 1; }
  case "$SEED_ADMIN_PASSWORD" in *"'"*|*" "*) echo "Please choose a password without quotes or spaces."; exit 1;; esac
  say "Payments (Campay). Leave empty to add later: booking will not work until then."
  ask CAMPAY_USERNAME "Campay app username"
  ask CAMPAY_PASSWORD "Campay app password" "" secret
  ask CAMPAY_WEBHOOK_KEY "Campay webhook key" "" secret
  ask CAMPAY_BASE_URL "Campay address (demo first, then www)" "https://demo.campay.net"
  say "Email (Resend) and SMS (Africa's Talking). Optional now."
  ask RESEND_API_KEY "Resend API key (re_...)" "" secret
  ask AT_USERNAME "Africa's Talking username"
  ask AT_API_KEY "Africa's Talking API key" "" secret
  ask AT_SENDER_ID "SMS sender name (optional)"
  say "Video calls: TURN server (optional now, strongly recommended)."
  ask TURN_URL "TURN address (e.g. turn:turn.$DOMAIN:3478?transport=udp)"
  ask TURN_USERNAME "TURN username"
  ask TURN_CREDENTIAL "TURN password" "" secret
  ask ANTHROPIC_API_KEY "Anthropic API key for AI grading (optional)" "" secret
  say "Legal pages and contact (shown on the site)."
  ask LEGAL_COMPANY_NAME "Company name (e.g. Learn Quick SARL)"
  ask LEGAL_ADDRESS "Company address (street, city)"
  ask LEGAL_REGISTRATION "RCCM / NIU numbers"
  ask SUPPORT_EMAIL "Support email" "support@$DOMAIN"
  ask PRIVACY_EMAIL "Privacy email" "privacy@$DOMAIN"
  ask SUPPORT_WHATSAPP "Support WhatsApp number (optional, e.g. +237670000000)"

  umask 077
  cat > .env <<EOF
DOMAIN=$DOMAIN
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
POSTGRES_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -base64 32)
FILE_ENCRYPTION_KEY=$(openssl rand -base64 32)
SEED_ADMIN_EMAIL=$SEED_ADMIN_EMAIL
SEED_ADMIN_PASSWORD='$SEED_ADMIN_PASSWORD'
RESEND_API_KEY=$RESEND_API_KEY
EMAIL_FROM="Learn Quick <no-reply@$DOMAIN>"
AT_USERNAME=$AT_USERNAME
AT_API_KEY=$AT_API_KEY
AT_SENDER_ID=$AT_SENDER_ID
PAYMENT_PROVIDER=campay
CAMPAY_BASE_URL=$CAMPAY_BASE_URL
CAMPAY_USERNAME=$CAMPAY_USERNAME
CAMPAY_PASSWORD='$CAMPAY_PASSWORD'
CAMPAY_WEBHOOK_KEY=$CAMPAY_WEBHOOK_KEY
TURN_URL=$TURN_URL
TURN_USERNAME=$TURN_USERNAME
TURN_CREDENTIAL=$TURN_CREDENTIAL
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
LEGAL_COMPANY_NAME="$LEGAL_COMPANY_NAME"
LEGAL_ADDRESS="$LEGAL_ADDRESS"
LEGAL_REGISTRATION="$LEGAL_REGISTRATION"
SUPPORT_EMAIL=$SUPPORT_EMAIL
PRIVACY_EMAIL=$PRIVACY_EMAIL
SUPPORT_WHATSAPP=$SUPPORT_WHATSAPP
HOSTING_PROVIDER="OVHcloud (France)"
LEGAL_COURT_CITY=Douala
EOF
  say "Settings saved in deploy/.env (readable by root only)."
  echo "IMPORTANT: copy the FILE_ENCRYPTION_KEY line from deploy/.env into a password manager."
  echo "Without it, uploaded ID documents can never be opened again."
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a

say "Checking that $DOMAIN points to this server..."
server_ip=$(curl -fsS4 https://api.ipify.org || true)
domain_ip=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)
if [ -n "$server_ip" ] && [ "$server_ip" != "$domain_ip" ]; then
  echo "Warning: $DOMAIN points to '${domain_ip:-nothing}', this server is $server_ip."
  echo "HTTPS will only work once the A record points here (it can take up to an hour)."
fi

if ! command -v docker >/dev/null; then
  say "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if command -v ufw >/dev/null; then
  say "Opening the firewall for SSH, HTTP and HTTPS..."
  ufw allow OpenSSH >/dev/null; ufw allow 80 >/dev/null; ufw allow 443 >/dev/null; ufw --force enable >/dev/null
fi

mem_mb=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)
if [ "$mem_mb" -lt 3500 ] && ! swapon --show | grep -q .; then
  say "Adding 2 GB of swap (building the site needs memory)..."
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Building and starting Learn Quick (first time: 3 to 10 minutes)..."
docker compose up -d --build

say "Waiting for the site to be ready..."
for _ in $(seq 1 60); do
  if docker compose ps app --format '{{.Status}}' | grep -q healthy; then break; fi
  sleep 5
done
docker compose ps app --format '{{.Status}}' | grep -q healthy || { echo "The app did not start. See: docker compose logs app"; exit 1; }

say "Creating the admin account, settings and library..."
docker compose run --rm app npx prisma db seed

say "Setting up nightly backups (02:15)..."
chmod +x backup.sh run-jobs.sh
line="15 2 * * * cd $(pwd) && ./backup.sh >> backups/backup.log 2>&1"
mkdir -p backups
( crontab -l 2>/dev/null | grep -v 'learn-quick.*backup.sh\|/deploy && ./backup.sh' ; echo "$line" ) | crontab -

say "Done! Open https://$DOMAIN and sign in as $SEED_ADMIN_EMAIL"
cat <<EOF

Next steps:
  1. In the Campay dashboard, set the webhook URL to: https://$DOMAIN/api/webhooks/campay
  2. Make one small real payment and one small withdrawal.
  3. Add https://$DOMAIN/api/health to an uptime monitor.
  4. Copy deploy/backups to another place regularly.
To change a setting later: edit deploy/.env, then run:  docker compose up -d --build
EOF
