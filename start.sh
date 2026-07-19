#!/bin/bash

echo "🚀 Iniciando servicios..."

# Flask (Docker)
docker start mysql-server phpmyadmin tesis-web-1 > /dev/null 2>&1
echo "✅ Flask + MySQL + phpMyAdmin corriendo"

# PHP server
pkill -f "php -S" 2>/dev/null
cd "$(dirname "$0")/php" && php -S 0.0.0.0:8000 > /tmp/php.log 2>&1 &
echo "✅ PHP corriendo en :8000"

echo ""
echo "📌 Servicios activos:"
echo "   Flask     → http://localhost:5001"
echo "   PHP       → http://localhost:8000"
echo "   phpMyAdmin→ http://localhost:8080"
