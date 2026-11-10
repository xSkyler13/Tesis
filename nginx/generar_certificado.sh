#!/bin/bash
# Genera un certificado autofirmado para desarrollo (válido 1 año).
# Uso: ./nginx/generar_certificado.sh [IP_o_dominio_extra ...]
#   ej: ./nginx/generar_certificado.sh 192.168.1.50   (para entrar desde el celular)
# El navegador mostrará un aviso la primera vez: es esperado en un certificado
# autofirmado. En el hosting se usa uno real (p. ej. Let's Encrypt / certbot).
set -e
cd "$(dirname "$0")"
mkdir -p certs

SAN="DNS:localhost,IP:127.0.0.1"
for extra in "$@"; do
    if [[ "$extra" =~ ^[0-9.]+$ ]]; then SAN="$SAN,IP:$extra"; else SAN="$SAN,DNS:$extra"; fi
done

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout certs/servidor.key -out certs/servidor.crt \
    -subj "/CN=Control de Acceso (desarrollo)" \
    -addext "subjectAltName=$SAN" 2>/dev/null
chmod 600 certs/servidor.key
echo "✅ Certificado generado para: $SAN"
