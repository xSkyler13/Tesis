import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _cargar_env(ruta):
    """Carga KEY=VALUE de .env sin pisar variables ya definidas en el entorno."""
    if not os.path.exists(ruta):
        return
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, valor = linea.split("=", 1)
            os.environ.setdefault(clave.strip(), valor.strip())


_cargar_env(os.path.join(RAIZ, ".env"))

FLASK_SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "")
FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"
INTERNAL_TOKEN = os.environ.get("INTERNAL_TOKEN", "")
PHP_URL = os.environ.get("PHP_URL", "http://172.19.0.1:8000").rstrip("/")

# Sesión: se cierra tras este tiempo sin actividad, o al cumplir la duración máxima (un turno)
SESION_INACTIVIDAD_MIN = int(os.environ.get("SESION_INACTIVIDAD_MIN", "60"))
SESION_MAXIMA_HORAS = int(os.environ.get("SESION_MAXIMA_HORAS", "12"))
# true cuando se sirve por HTTPS (nginx): la cookie de sesión solo viaja cifrada
COOKIE_SEGURA = os.environ.get("COOKIE_SEGURA", "0") == "1"

if not FLASK_SECRET_KEY or not INTERNAL_TOKEN:
    raise RuntimeError("Faltan FLASK_SECRET_KEY o INTERNAL_TOKEN en .env (ver .env.example)")


def headers_internos(usuario_id=None, rol_id=None, ip=None):
    """Cabeceras para llamar a PHP. Sin usuario = llamada interna de Flask.
    `ip` es la del cliente real, para la auditoría."""
    h = {"X-Internal-Token": INTERNAL_TOKEN}
    if ip:
        h["X-Cliente-Ip"] = ip
    if usuario_id is not None:
        h["X-Usuario-Id"] = str(usuario_id)
        h["X-Rol-Id"] = str(rol_id)
    return h
