#!/bin/bash

echo "🚀 Iniciando servicios..."

cd "$(dirname "$0")"

# Flask + MySQL + phpMyAdmin (Docker, definidos en docker-compose.yml)
docker compose up -d > /dev/null 2>&1
echo "✅ Flask + MySQL + phpMyAdmin corriendo"

# PHP server. Se inicia sin variables DB_* heredadas de la terminal: si no,
# taparían los valores de .env (env() da prioridad al entorno del proceso).
pkill -f "php -S" 2>/dev/null
(cd php && env -u DB_HOST -u DB_NAME -u DB_USER -u DB_PASSWORD -u INTERNAL_TOKEN \
    php -S 0.0.0.0:8000 > /tmp/php.log 2>&1 &)
echo "✅ PHP corriendo en :8000"

# Política de retención de datos biométricos (borra fotos vencidas)
sleep 2 && docker exec tesis-web-1 python limpiar_biometria.py 2>/dev/null | tail -1

echo ""
echo "📌 Servicios activos:"
echo "   App        → https://localhost (nginx; Flask directo solo en :5001 local)"
echo "   PHP        → http://localhost:8000"
echo "   phpMyAdmin → http://localhost:8080 (solo desde esta máquina)"
