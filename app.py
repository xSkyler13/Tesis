import re
import time
from datetime import timedelta
from functools import wraps

from flask import Flask, render_template, jsonify, send_from_directory, request, session, redirect, Response, abort
import requests
import utils.face_utils as fu
from werkzeug.middleware.proxy_fix import ProxyFix
from utils.config import (FLASK_SECRET_KEY, FLASK_DEBUG, PHP_URL, headers_internos,
                          SESION_INACTIVIDAD_MIN, SESION_MAXIMA_HORAS, COOKIE_SEGURA)
from utils.seguridad import LimitadorIntentos, sesion_expirada
from utils.face_utils import load_known_faces
from python.app import face_bp

app = Flask(__name__, static_folder='statics', static_url_path='/statics')
app.secret_key = FLASK_SECRET_KEY
# TEMPLATES_AUTO_RELOAD: sin debug, Flask cachea las plantillas y no ve los cambios en los .html
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=COOKIE_SEGURA,
    PERMANENT_SESSION_LIFETIME=timedelta(hours=SESION_MAXIMA_HORAS),
    TEMPLATES_AUTO_RELOAD=True,
    # Rechaza cuerpos enormes (las fotos en base64 pesan < 1 MB)
    MAX_CONTENT_LENGTH=5 * 1024 * 1024,
)
# Detrás de nginx: la IP real del cliente llega en X-Forwarded-For (un solo proxy)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

# ==================== MÓDULO FACIAL ====================
app.register_blueprint(face_bp)

# ==================== CARGA DE ENCODINGS ====================
print("🔄 Cargando encodings conocidos...")
load_known_faces()
print(f"📊 Total de rostros cargados: {len(fu.known_face_encodings)}")
if len(fu.known_face_encodings) == 0:
    print("⚠️  ¡ADVERTENCIA! No hay ningún rostro registrado. Registra residentes en /residente")

# ==================== SESIÓN ====================
# Roles: 1 = Administrador, 2 = Seguridad. Agente de Cobros (3) no tiene acceso web.
# La misma matriz se aplica en cada endpoint PHP (requerir_usuario en php/templates).
ADMIN = (1,)
PERSONAL = (1, 2)
INICIO_POR_ROL = {1: '/home', 2: '/home'}

# Fotos de personas: solo para sesiones iniciadas
RUTAS_PRIVADAS = ('/known_faces/', '/statics/img/usuarios/', '/statics/img/residentes/',
                  '/statics/img/visitas_docs/', '/statics/img/no_reconocidos/')


def requiere_login(*roles):
    def decorador(vista):
        @wraps(vista)
        def envuelta(*args, **kwargs):
            rol = session.get('rol_id')
            if rol is None:
                return redirect('/login')
            if roles and rol not in roles:
                return redirect(INICIO_POR_ROL.get(rol, '/login'))
            return vista(*args, **kwargs)
        return envuelta
    return decorador


limitador_login = LimitadorIntentos(maximo=5, ventana=15 * 60, bloqueo=15 * 60)

# Peticiones que no cuentan como actividad del usuario: refrescos automáticos
# del panel y la cámara, para que una pantalla abierta sola igual expire.
RUTAS_SIN_ACTIVIDAD = ('/recognize',)


@app.before_request
def controlar_expiracion_sesion():
    if 'usuario_id' not in session:
        return
    ahora = time.time()
    if sesion_expirada(session, SESION_INACTIVIDAD_MIN * 60, SESION_MAXIMA_HORAS * 3600, ahora):
        session.clear()
        return
    session.setdefault('inicio', ahora)  # sesiones iniciadas antes de este control
    automatica = request.headers.get('X-Refresco-Automatico') == '1' or request.path in RUTAS_SIN_ACTIVIDAD
    if not automatica:
        session['ultima_actividad'] = ahora


@app.before_request
def proteger_archivos_privados():
    if request.path.startswith(RUTAS_PRIVADAS) and 'usuario_id' not in session:
        abort(401)


@app.route('/api/login', methods=['POST'])
def api_login():
    nombre = request.form.get('usuario', '').strip().lower()
    claves = (f"ip:{request.remote_addr}", f"usuario:{nombre}")

    espera = limitador_login.segundos_bloqueado(*claves)
    if espera > 0:
        minutos = espera // 60 + 1
        return jsonify({"success": False, "message": f"Demasiados intentos fallidos. Intenta de nuevo en {minutos} min."}), 429

    try:
        r = requests.post(
            f"{PHP_URL}/templates/api_login_user.php",
            data={'usuario': request.form.get('usuario', ''), 'password': request.form.get('password', '')},
            headers=headers_internos(ip=request.remote_addr),
            timeout=10,
        )
        datos = r.json()
    except (requests.RequestException, ValueError):
        return jsonify({"success": False, "message": "Error de conexión con la API."}), 502

    if not datos.get('success'):
        limitador_login.registrar_fallo(*claves)
        return jsonify(datos)

    limitador_login.limpiar(*claves)
    usuario = datos['data']
    if int(usuario['rol_id']) not in INICIO_POR_ROL:
        return jsonify({"success": False, "message": "Tu rol no tiene acceso al sistema web."})
    session.clear()
    session.permanent = True
    session['usuario_id'] = int(usuario['id'])
    session['usuario'] = usuario['usuario']
    session['rol_id'] = int(usuario['rol_id'])
    session['inicio'] = session['ultima_actividad'] = time.time()
    return jsonify(datos)


@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"success": True})


# ==================== PROXY A PHP ====================
# El navegador nunca habla con PHP directamente: Flask valida la sesión y
# reenvía la petición con el token interno y la identidad del usuario.
NOMBRE_API = re.compile(r'^api_[a-z_]+$')


@app.route('/api/<nombre>.php', methods=['GET', 'POST'])
def api_proxy(nombre):
    if not NOMBRE_API.match(nombre):
        abort(404)
    if 'usuario_id' not in session:
        return jsonify({"success": False, "message": "Sesión expirada"}), 401

    archivos = [(k, (f.filename, f.stream, f.mimetype)) for k, f in request.files.items(multi=True)]
    try:
        r = requests.request(
            request.method,
            f"{PHP_URL}/templates/{nombre}.php",
            params=list(request.args.items(multi=True)),
            data=list(request.form.items(multi=True)),
            files=archivos or None,
            headers=headers_internos(session['usuario_id'], session['rol_id'], ip=request.remote_addr),
            timeout=30,
        )
    except requests.RequestException:
        return jsonify({"success": False, "message": "Error de conexión con la API."}), 502

    # PHP responde 401 si el usuario fue desactivado: se cierra también la sesión de Flask
    if r.status_code == 401:
        session.clear()
    respuesta = Response(r.content, status=r.status_code, content_type=r.headers.get('Content-Type'))
    if 'Content-Disposition' in r.headers:
        respuesta.headers['Content-Disposition'] = r.headers['Content-Disposition']
    return respuesta


# ==================== ARCHIVOS ====================
@app.route('/known_faces/<path:filename>')
def known_faces_file(filename):
    return send_from_directory('known_faces', filename)

# ==================== PÁGINAS ====================
@app.route('/')
def raiz():
    return redirect(INICIO_POR_ROL.get(session.get('rol_id'), '/login'))

@app.route('/usuarios')
@requiere_login(*ADMIN)
def usuarios_page():
    return render_template('Usuarios.html')

# Página anterior de registro de usuarios, reemplazada por /usuarios
@app.route('/register')
def register_page():
    return redirect('/usuarios')

@app.route('/login_movil')
def login_movil_page():
    return render_template('login_movil.html')

@app.route('/home')
@requiere_login(*PERSONAL)
def home_page():
    return render_template('home.html')

@app.route('/inicio')
@requiere_login(*PERSONAL)
def inicio_page():
    return render_template('Inicio.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/residente')
@requiere_login(*ADMIN)
def residente_page():
    return render_template('Residente.html')

# Ruta anterior, por si alguien la tiene guardada
@app.route('/propietario')
def propietario_page():
    return redirect('/residente')

@app.route('/torre')
@requiere_login(*ADMIN)
def torre_page():
    return render_template('Torre.html')

@app.route('/departamento')
@requiere_login(*ADMIN)
def departamento_page():
    return render_template('Departamento.html')

@app.route('/departamentos')
@requiere_login(*PERSONAL)
def departamentos_page():
    return render_template('Departamentos.html')

@app.route('/residentes')
@requiere_login(*PERSONAL)
def residentes_page():
    return render_template('Residentes.html')

@app.route('/visitas')
@requiere_login(*PERSONAL)
def visitas_page():
    return render_template('Visitas.html')

@app.route('/visita')
@requiere_login(*PERSONAL)
def visita_page():
    return render_template('Visita.html')

@app.route('/incidencias')
@requiere_login(*PERSONAL)
def incidencias_page():
    return render_template('Incidencias.html')

@app.route('/auditoria')
@requiere_login(*ADMIN)
def auditoria_page():
    return render_template('Auditoria.html')


if __name__ == '__main__':
    print("🚀 Servidor Flask iniciado - Reconocimiento web + liveness listo")
    app.run(host='0.0.0.0', port=5001, debug=FLASK_DEBUG)
