#!/bin/bash

# ==============================================================================
# 🚀 AZMEW JAVA MONOREPO AUTO-START SCRIPT
# This script handles everything: Database, Tunnel, Backend (Java), and Frontend (React).
# It cleans ports, builds Maven dependencies, and updates environment variables.
# ==============================================================================

ROOT_DIR=$(pwd)
BE_DIR="$ROOT_DIR/backend"
FE_DIR="$ROOT_DIR/frontend"
ENV_FILE="$BE_DIR/.env"
TUNNEL_LOG="$ROOT_DIR/tunnel.log"

echo "--------------------------------------------------------"
echo "🌟 INITIALIZING AZMEW JAVA CONNECTOR ECOSYSTEM"
echo "--------------------------------------------------------"

# 🛠️ 1. CLEANUP PREVIOUS PROCESSES
echo "🧹 Cleaning up existing processes on ports 8080 (BE) and 5173 (FE)..."
# Kill Java (8080)
sync
taskkill //F //IM java.exe //T 2>/dev/null || true
# Kill Node/Vite (5173)
npx kill-port 5173 2>/dev/null || true
npx kill-port 8080 2>/dev/null || true

# 🌐 2. START TUNNEL (Pinggy)
echo "🌐 Starting Pinggy Tunnel (Port 8080)..."
# Kill any existing ssh tunnels
taskkill //F //IM ssh.exe 2>/dev/null || true
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
     TUNNEL_URL=$(grep -o 'https://[^ ]*\.pinggy\.link' "$TUNNEL_LOG" | head -n 1)
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
sed -i "s|FACEBOOK_REDIRECT_URI=.*|FACEBOOK_REDIRECT_URI=${TUNNEL_URL}/api/auth/facebook/callback|" "$ENV_FILE"
sed -i "s|INSTAGRAM_REDIRECT_URI=.*|INSTAGRAM_REDIRECT_URI=${TUNNEL_URL}/api/auth/instagram/callback|" "$ENV_FILE"


# ☕ 4. BUILD & START BACKEND
echo "☕ Starting Java Backend (Spring Boot with MySQL)..."
cd "$BE_DIR"
# Use global mvn since mvnw is missing its wrapper properties
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
echo "👉 FRONTEND:  http://localhost:5173"
echo "👉 TUNNEL:    $TUNNEL_URL"
echo ""
echo "📱 META (FACEBOOK/INSTAGRAM) CONFIGURATION:"
echo "--------------------------------------------------------"
echo "🔗 App Domains:          $(echo $TUNNEL_URL | sed 's|https://||')"
echo "🔗 Privacy Policy URL:    $TUNNEL_URL/api/auth/privacy"
echo "🔗 Terms of Service URL:  $TUNNEL_URL/api/auth/privacy"
echo ""
echo "🔗 FB Redirect URI:       ${TUNNEL_URL}/api/auth/facebook/callback"
echo "🔗 IG Redirect URI:       ${TUNNEL_URL}/api/auth/instagram/callback"
echo "🔗 Webhook Callback URL:  ${TUNNEL_URL}/api/webhook"
echo "🔗 Webhook Verify Token:  eksamadhan_verify_token"
echo "--------------------------------------------------------"
echo "Check backend.log and frontend.log for details."
echo "Press Ctrl+C to stop all services."

# 🛑 CLEANUP ON EXIT
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    kill $BACKEND_PID $FRONTEND_PID $TUNNEL_PID 2>/dev/null
    echo "👋 Goodbye!"
}
trap cleanup EXIT
wait
