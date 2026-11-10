proxy_pass http://web:5001;
proxy_set_header Host $host;
# Flask (ProxyFix) toma la IP real del cliente de aquí, para el límite de login y la auditoría
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 60s;
