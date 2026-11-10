# Seguridad del sistema de control de acceso

Este documento describe las medidas de seguridad del sistema, cómo se diseñaron y qué riesgos quedan abiertos. Sirve como base para la sección de seguridad de la tesis y como guía para desplegarlo en un hosting.

## 1. Arquitectura y superficie expuesta

```
Navegador / kiosco ──HTTPS──▶ nginx :443 ──▶ Flask (web:5001) ──token interno──▶ PHP :8000 ──▶ MySQL
                                              │                                      ▲
                                              └── reconocimiento facial (dlib)        │
                                                                     PHP ──token──▶ Flask (sincronizar rostros)
```

| Componente | Expuesto a | Por qué |
|---|---|---|
| nginx | Red / internet (443, y 80 que redirige a 443) | Única entrada pública |
| Flask | Solo `127.0.0.1:5001` | PHP del host lo usa para sincronizar rostros |
| PHP | Atiende solo peticiones con `X-Internal-Token` | Rechaza (403) cualquier otra |
| MySQL, phpMyAdmin | Solo `127.0.0.1` | Administración local; Docker se salta el firewall (`ufw`), por eso se publican en localhost |

El navegador nunca habla con PHP ni con MySQL. Flask valida la sesión y reenvía cada petición con el token interno y la identidad del usuario (`X-Usuario-Id`, `X-Rol-Id`, `X-Cliente-Ip`).

## 2. Autenticación y sesión

- **Contraseñas:** se guardan con `password_hash` (bcrypt) y deben tener al menos 8 caracteres.
- **Límite de intentos:** tras 5 intentos fallidos en 15 minutos, por IP y por nombre de usuario, el login queda bloqueado 15 minutos (`utils/seguridad.py`). nginx además limita `/api/login` a 10 peticiones por minuto por IP.
- **Sesión:** usa una cookie firmada (`FLASK_SECRET_KEY`) con los atributos `HttpOnly`, `SameSite=Lax` y `Secure`, este último solo se envía por HTTPS.
- **Expiración:** la sesión se cierra tras 60 minutos sin actividad o al cumplir 12 horas, la duración de un turno. Los refrescos automáticos del panel (cabecera `X-Refresco-Automatico`) y la cámara no cuentan como actividad, para que una pantalla olvidada abierta también expire.
- **Sin modo debug** en producción: el depurador de Werkzeug permitiría ejecutar código.

## 3. Autorización (roles)

La matriz se aplica dos veces: en Flask, para las páginas, y en cada endpoint PHP con `requerir_usuario(ROLES_...)`. Ocultar botones en la interfaz es solo visual: aunque alguien los muestre, el servidor responde 403.

| Acción | Administrador | Seguridad | Agente de Cobros |
|---|---|---|---|
| Panel: cámara, accesos, autorizar visitas | ✅ | ✅ | ❌ |
| Visitas: registrar, listar, editar | ✅ | ✅ | ❌ |
| Visitas: eliminar | ✅ | ❌ | ❌ |
| Incidencias: ver y revisar | ✅ | ✅ | ❌ |
| Residentes y departamentos: consultar | ✅ | ✅ | ❌ |
| Residentes, departamentos, torres: crear, editar, baja, eliminar, exportar | ✅ | ❌ | ❌ |
| Usuarios del sistema y auditoría | ✅ | ❌ | ❌ |

Además, cada usuario solo puede ver y editar su propia cuenta, salvo el administrador.

## 4. Protección de datos en tránsito y en la aplicación

- **HTTPS (TLS 1.2 y 1.3) con nginx.** También es un requisito técnico: los navegadores solo permiten usar la cámara (`getUserMedia`) en HTTPS.
- **Cabeceras de seguridad:** `X-Frame-Options: DENY` (contra clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Permissions-Policy`, que limita la cámara al propio sitio. No se anuncian versiones de servidor.
- **Inyección SQL:** todas las consultas usan sentencias preparadas (PDO).
- **XSS:** todo dato que viene de la base de datos se escapa con `esc()` antes de insertarse en el HTML.
- **Archivos subidos:**
  - Se valida el contenido real, no la extensión: las fotos deben ser imágenes y el documento de visita una imagen JPG/PNG/WEBP o un PDF de hasta 2 MB.
  - Los nombres de archivo se sanean para evitar *path traversal*.
  - Las fotos de personas solo se sirven con sesión iniciada.
- **Tamaño de las peticiones:** nginx admite hasta 6 MB y Flask hasta 5 MB.
- **IP del cliente:** nginx reemplaza `X-Forwarded-For`, así que un cliente no puede falsificar su IP para esquivar los límites ni la auditoría.

## 5. Base de datos

- **Mínimo privilegio:** la app usa `app_acceso`, no `root`. Puede `SELECT/INSERT` en la base y `UPDATE/DELETE` tabla por tabla, **excepto en `auditoria`**, que para la app es de solo inserción.
- **Secretos:** las credenciales y los secretos están en `.env`, que no se versiona. `.env.example` sirve de plantilla.
- **Respaldos:** en `backups/`, también fuera del control de versiones porque contienen datos personales.

## 6. Auditoría

La tabla `auditoria` registra quién hizo qué, sobre qué registro, cuándo y desde qué IP:
- logins correctos y fallidos;
- crear, editar y eliminar;
- dar de baja, activar y desactivar;
- autorizar visitas;
- revisar incidencias;
- exportar datos;
- la limpieza por retención.

El administrador la consulta en `/auditoria`. Como la app no puede modificarla ni borrarla, un usuario malicioso no puede borrar sus huellas.

## 7. Reconocimiento facial y prueba de vida

### Flujo
1. Se detecta el rostro y se compara con los rostros registrados. Gana la coincidencia más cercana (`face_distance`) con una distancia de 0,5 o menos.
2. Se sortean **dos retos distintos en orden aleatorio** entre parpadear, girar a la izquierda y girar a la derecha. Hay 6 secuencias posibles, con 8 segundos por reto.
3. Solo si se cumplen ambos retos, **el servidor** registra el acceso. El navegador nunca puede marcar un acceso por su cuenta.

### Defensas
| Ataque | Defensa |
|---|---|
| Foto impresa o en pantalla | No puede parpadear ni girar la cabeza |
| Video pregrabado | Tendría que coincidir con la secuencia aleatoria de retos |
| Script que envía frames en ráfaga | Se ignoran los frames con menos de 0,25 s entre sí; nginx limita `/recognize` a 4 por segundo por IP |
| Averiguar quién está registrado | El nombre solo se revela cuando se aprueba el acceso |
| Ajustar el ataque con datos internos | La respuesta no incluye umbrales ni mediciones |
| Saturar la CPU (cada frame pasa por dlib) | Límite de frecuencia en nginx y tamaño máximo de las peticiones |
| Manipular el archivo de rostros | Se guarda como `.npz` con `allow_pickle=False`: cargarlo no puede ejecutar código, cosa que `pickle` sí permitía |

### Limitaciones conocidas
- **La prueba de vida es por desafío y respuesta con una cámara RGB común.** No resiste un *deepfake* en tiempo real ni una máscara 3D de buena calidad. Para un entorno de alta seguridad haría falta una cámara de profundidad o infrarroja, o un modelo *anti-spoofing* entrenado.
- **`/recognize` es público**, porque el kiosco no tiene sesión. Conviene limitarlo a las IPs de los kioscos en nginx (`allow`/`deny`).
- **Los rostros se identifican por nombre completo.** Dos residentes con el mismo nombre compartirían identidad; lo correcto sería usar el `residente_id`.

## 8. Tratamiento de datos biométricos (Ley 29733)

Según la Ley 29733 de Protección de Datos Personales del Perú y su reglamento, el rostro es un **dato sensible**.

- **Consentimiento expreso:** no se guarda el rostro de un residente sin marcar el consentimiento. El servidor lo exige y registra `consentimiento_biometrico` y `fecha_consentimiento`.
- **Finalidad:** el rostro solo se usa para el control de acceso. La foto de perfil, que se muestra en el sistema, está separada de la foto de reconocimiento.
- **Retención** (`limpiar_biometria.py`, que se ejecuta al iniciar y conviene programar a diario en el hosting):
  - Las fotos de intentos no reconocidos se borran a los **90 días**. El registro del intento se conserva, sin foto.
  - El rostro y la foto de un residente dado de baja se borran a los **30 días**.
  - Ambos plazos se configuran en `.env`.
- **Acceso restringido:** las fotos solo se ven con sesión iniciada. Los datos solo se exportan con rol de administrador, y cada exportación queda auditada.
- **Pendiente:** las fotos y `encodings.npz` no están cifrados en disco. En producción se recomienda un disco o volumen cifrado.
- **Residentes registrados antes de este cambio:** tienen `consentimiento_biometrico = 0`. Hay que recabar su consentimiento o eliminar su rostro.

## 9. Lista de verificación para el hosting

1. Copiar `.env.example` a `.env` y generar secretos nuevos: `python3 -c "import secrets; print(secrets.token_hex(32))"`.
2. Usar un certificado real (Let's Encrypt / certbot) en `nginx/certs/` y activar **HSTS** en `nginx/default.conf`.
3. Usar `HTTPS_PORT=443` y `HTTP_PORT=80`.
4. Crear el usuario `app_acceso` y aplicar las migraciones de `sql/migraciones/` con `root`.
5. No publicar phpMyAdmin. Si hace falta, usar un túnel SSH: `ssh -L 8080:localhost:8080 usuario@servidor`.
6. Reemplazar los servidores de desarrollo (Werkzeug, `php -S`) por gunicorn y PHP-FPM.
7. Programar `docker exec tesis-web-1 python limpiar_biometria.py` a diario (cron) y un respaldo con `mysqldump`.
8. Limitar `/recognize` a las IPs de los kioscos.
9. No reutilizar la antigua contraseña de MySQL `123456`, que quedó en el historial de git.
