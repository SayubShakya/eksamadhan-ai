#!/bin/sh
# EkSamadhan AI: first-time setup for running the packaged application (see INSTALL.md).
#
# Writes the two settings files the app needs, with fresh random secrets, and turns on the demo
# business so there is something to sign in to. Existing files are never overwritten.
#   ./.env           the database password, read by docker-compose.yml
#   backend/.env     the backend's settings
#
# Usage:  sh setup.sh                      (no AI key: everything works except AI answers)
#         sh setup.sh sk-or-v1-...         (with an OpenRouter key: the AI answers too)
set -e
cd "$(dirname "$0")"

KEY="${1:-}"
rand() { openssl rand -base64 "$1" | tr -d '\n'; }
hex() { openssl rand -hex "$1"; }

if [ -f .env ]; then
  echo "· .env already exists, kept as it is"
else
  cat > .env <<EOF
# Database for docker-compose.yml (written by setup.sh)
DB_NAME=eksamadhan
DB_USERNAME=eksamadhan
DB_PASSWORD=$(hex 16)
EOF
  echo "✓ wrote .env"
fi
DB_PASSWORD=$(grep '^DB_PASSWORD=' .env | cut -d= -f2-)

if [ -f backend/.env ]; then
  echo "· backend/.env already exists, kept as it is"
else
  if [ -n "$KEY" ]; then PROVIDER=openrouter; else PROVIDER=local; fi
  cat > backend/.env <<EOF
# EkSamadhan AI backend settings (written by setup.sh). See backend/.env.example for every option.

# Database (inside Docker the address is set by docker-compose.yml)
DB_URL=jdbc:postgresql://localhost:5432/eksamadhan
DB_USERNAME=eksamadhan
DB_PASSWORD=$DB_PASSWORD

# Address of the dashboard
FRONTEND_URL=http://localhost:8088

# Secrets, generated for this machine
JWT_SECRET=$(rand 48)
TOKEN_ENCRYPTION_KEY=$(rand 32)

# AI: an OpenRouter key powers the AI's answers and its search of the shop's knowledge.
# Without one, everything else works and the AI hands every question to a person.
AI_CHAT_PROVIDER=$PROVIDER
OPEN_ROUTER_KEY=$KEY

# A ready-made demo business to sign in to (see INSTALL.md for the logins)
DEMO_SEED=true

# The platform admin console (admin panel)
SYSTEM_ADMIN_EMAIL=admin@demo.eksamadhan.ai
SYSTEM_ADMIN_PASSWORD=Admin-Demo-2026

# Email: off, so invitation and reset links are shown on screen instead of sent
EMAIL_ENABLED=false

# Meta (Messenger, Instagram, WhatsApp) need your own Meta developer app; see META_SETUP.md.
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
WEBHOOK_VERIFY_TOKEN=$(hex 12)
EOF
  echo "✓ wrote backend/.env"
fi

echo ""
echo "Next:  docker compose --profile app up --build"
echo "Then open http://localhost:8088 and sign in with the demo logins in INSTALL.md."
