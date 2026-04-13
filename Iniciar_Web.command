#!/bin/bash
cd "$(dirname "$0")"
echo "═══════════════════════════════════════"
echo "  🏟️  La Bufarra — Iniciando servidor"
echo "═══════════════════════════════════════"
echo ""
echo "  📍 Sitio público: http://localhost:8000"
echo "  🔐 Panel admin:   http://localhost:8000/admin.html"
echo ""
echo "  (Para apagar el servidor, cerrá esta ventana)"
echo ""

# Start server in background
python3 server.py &
SERVER_PID=$!

# Wait a second, then open browser
sleep 1
open "http://localhost:8000"

# Wait for user to close window
wait $SERVER_PID
