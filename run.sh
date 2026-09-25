#!/bin/bash

# ==============================================================================
# 🚀 EKSAMADHAN AI — AUTO-START SCRIPT
# This script handles everything: Database, Tunnel, Backend (Java), and Frontend (React).
# It cleans ports, builds Maven dependencies, and updates environment variables.
# ==============================================================================

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)

# ☕ JDK 21 — Homebrew's openjdk@21 is keg-only and the system default is JDK 17,
# which cannot compile this project.
if [ -d /opt/homebrew/opt/openjdk@21 ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@21
  export PATH="$JAVA_HOME/bin:$PATH"
fi
BE_DIR="$ROOT_DIR/backend"
FE_DIR="$ROOT_DIR/frontend"
ENV_FILE="$BE_DIR/.env"
TUNNEL_LOG="$ROOT_DIR/tunnel.log"

echo "--------------------------------------------------------"
echo "🌟 STARTING EKSAMADHAN AI"
echo "--------------------------------------------------------"

# 🛠️ 1. CLEANUP PREVIOUS PROCESSES
echo "🧹 Cleaning up existing processes on ports 8080 (BE) and 5174 (FE)..."
lsof -ti tcp:8080 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti tcp:5174 2>/dev/null | xargs kill -9 2>/dev/null || true

# 🐘 DATABASE
echo "🐘 Starting PostgreSQL (docker compose)..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d >/dev/null 2>&1 || {
  echo "⚠️  Could not start PostgreSQL. Is Docker running?"; exit 1;
}

# 🌐 2. START TUNNEL (Pinggy)
# Pull proxy settings from the backend env file if present
if [ -f "$ENV_FILE" ]; then
  PROXY_URL=$(grep -E '^PROXY_URL=' "$ENV_FILE" | cut -d= -f2-)
  PROXY_AUTH_TOKEN=$(grep -E '^PROXY_AUTH_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
fi

echo "🌐 Starting Pinggy Tunnel (Port 8080)..."
pkill -f 'a.pinggy.io' 2>/dev/null || true
> "$TUNNEL_LOG"
# Pinggy is very stable and has no 'reminder' pages
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -p 443 -R0:localhost:8080 a.pinggy.io > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

echo "⏳ Waiting for Tunnel URL..."
TUNNEL_URL=""
MAX_RETRIES=30
COUNT=0
while [ -z "$TUNNEL_URL" ] && [ $COUNT -lt $MAX_RETRIES ]; do
  sleep 1
  if grep -q "https://" "$TUNNEL_LOG"; then
     # Match only real tunnel hostnames. Pinggy's log also contains
     # https://dashboard.pinggy.io (an upgrade advert) — must not match that.
     TUNNEL_URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.(pinggy\.link|pinggy-free\.link|free\.pinggy\.net)' "$TUNNEL_LOG" | grep -v 'dashboard\.' | head -n 1)
  fi
  COUNT=$((COUNT+1))
  echo -n "."
done
echo ""

if [ -z "$TUNNEL_URL" ]; then
  echo "⚠️  Pinggy Tunnel failed. Check tunnel.log"
  TUNNEL_URL="http://localhost:8080"
else
  echo "✅ TUNNEL ESTABLISHED: $TUNNEL_URL"
fi

# 📝 3. UPDATE ENV FILE
if [ ! -f "$ENV_FILE" ]; then
    echo "📄 Creating .env from .env.example..."
    cp "$BE_DIR/.env.example" "$ENV_FILE"
fi

echo "📝 Updating Redirect URIs..."
PUBLIC_URL="${PROXY_URL:-$TUNNEL_URL}"
SED_INPLACE=(-i '')
[ "$(uname)" = "Linux" ] && SED_INPLACE=(-i)
sed "${SED_INPLACE[@]}" "s|FACEBOOK_REDIRECT_URI=.*|FACEBOOK_REDIRECT_URI=${PUBLIC_URL}/api/auth/facebook/callback|" "$ENV_FILE"
sed "${SED_INPLACE[@]}" "s|INSTAGRAM_REDIRECT_URI=.*|INSTAGRAM_REDIRECT_URI=${PUBLIC_URL}/api/auth/instagram/callback|" "$ENV_FILE"


# 📡 3b. REGISTER TUNNEL WITH THE META PROXY
# Meta needs one fixed URL, but the Pinggy URL changes on every restart. The Vercel
# proxy holds the current tunnel in Redis and forwards to it.
if [ -n "$PROXY_URL" ] && [ "$TUNNEL_URL" != "http://localhost:8080" ]; then
  echo "📡 Registering tunnel with Meta proxy..."
  REG=$(curl -s -X POST "$PROXY_URL/_proxy/register" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$TUNNEL_URL\",\"token\":\"${PROXY_AUTH_TOKEN:-azmew_token}\"}")
  echo "   $REG"

  # Free Pinggy tunnels die after ~60 minutes and come back with a NEW hostname.
  # This supervisor restarts the tunnel when it drops and registers whatever URL
  # Pinggy hands out next, so Meta keeps reaching the backend without any manual step.
  (
    CURRENT_URL="$TUNNEL_URL"
    while true; do
      sleep 60

      if ! pgrep -f 'a\.pinggy\.io' >/dev/null 2>&1; then
        echo "♻️  Tunnel dropped — reconnecting..."
        : > "$TUNNEL_LOG"
        ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 \
            -p 443 -R0:localhost:8080 a.pinggy.io > "$TUNNEL_LOG" 2>&1 &
        sleep 12
      fi

      NEW_URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.(pinggy\.link|pinggy-free\.link|free\.pinggy\.net)' "$TUNNEL_LOG" \
                | grep -v 'dashboard\.' | head -n 1)
      [ -z "$NEW_URL" ] && continue

      if [ "$NEW_URL" != "$CURRENT_URL" ]; then
        echo "♻️  New tunnel URL: $NEW_URL"
        CURRENT_URL="$NEW_URL"
      fi

      curl -s -X POST "$PROXY_URL/_proxy/register" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$CURRENT_URL\",\"token\":\"${PROXY_AUTH_TOKEN:-eksamadhan_token}\"}" >/dev/null
    done
  ) &
  KEEPALIVE_PID=$!
elif [ -z "$PROXY_URL" ]; then
  echo "ℹ️  PROXY_URL not set — skipping proxy registration."
  echo "   Set PROXY_URL and PROXY_AUTH_TOKEN in $ENV_FILE to use the fixed Meta URL."
fi

# ☕ 4. BUILD & START BACKEND
echo "☕ Starting Java Backend (Spring Boot + PostgreSQL)..."
cd "$BE_DIR"
mvn spring-boot:run -DskipTests > "$ROOT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
cd "$ROOT_DIR"

# ⚛️ 5. START FRONTEND
echo "⚛️ Starting React Frontend (Vite)..."
cd "$FE_DIR"
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi
npm run dev > "$ROOT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo "--------------------------------------------------------"
echo "🎉 SYSTEM FULL-STACK READY!"
echo "--------------------------------------------------------"
echo "👉 BACKEND:   http://localhost:8080"
echo "👉 FRONTEND:  http://localhost:5174"
echo "👉 TUNNEL:    $TUNNEL_URL"
echo ""
echo "📱 META (FACEBOOK/INSTAGRAM) CONFIGURATION:"
echo "--------------------------------------------------------"
echo "🔗 App Domains:          $(echo $PUBLIC_URL | sed 's|https://||')"
echo "🔗 Privacy Policy URL:    $PUBLIC_URL/api/auth/privacy"
echo "🔗 Data Deletion URL:     $PUBLIC_URL/api/auth/data-deletion"
echo "🔗 Terms of Service URL:  $PUBLIC_URL/api/auth/terms"
echo ""
echo "🔗 FB Redirect URI:       ${PUBLIC_URL}/api/auth/facebook/callback"
echo "🔗 IG Redirect URI:       ${PUBLIC_URL}/api/auth/instagram/callback"
echo "🔗 Webhook Callback URL:  ${PUBLIC_URL}/api/webhook"
echo "🔗 Webhook Verify Token:  eksamadhan_verify_token"
echo "--------------------------------------------------------"
echo "Check backend.log and frontend.log for details."
echo "Press Ctrl+C to stop all services."

# 🛑 CLEANUP ON EXIT
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    kill $BACKEND_PID $FRONTEND_PID $TUNNEL_PID $KEEPALIVE_PID 2>/dev/null
    echo "👋 Goodbye!"
}
trap cleanup EXIT
wait
