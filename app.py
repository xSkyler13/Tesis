from flask import Flask, render_template, jsonify
from flask_cors import CORS
import requests
import utils.face_utils as fu
from utils.face_utils import load_known_faces
from python.app import face_bp

app = Flask(__name__, static_folder='statics', static_url_path='/statics')
app.secret_key = " "
CORS(app, supports_credentials=True)

# ==================== MÓDULO FACIAL ====================
app.register_blueprint(face_bp)

# ==================== CARGA DE ENCODINGS ====================
print("🔄 Cargando encodings conocidos...")
load_known_faces()
print(f"📊 Total de rostros cargados: {len(fu.known_face_encodings)}")
if len(fu.known_face_encodings) == 0:
    print("⚠️  ¡ADVERTENCIA! No hay ningún rostro registrado. Registra primero en /register")

# ==================== PÁGINAS ====================
@app.route('/')
@app.route('/register')
def register_page():
    return render_template('register.html')

@app.route('/registerp')
def register_page_plus():
    return render_template('registerp.html')

@app.route('/asistencia')
def asistencia_page():
    return render_template('asistencia.html')

@app.route('/login_movil')
def login_movil_page():
    return render_template('login_movil.html')

@app.route('/home')
def home_page():
    return render_template('home.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

# ================== PÁGINAS_API ==================
@app.route("/roles")
def roles():
    respuesta = requests.get(
        "http://172.19.0.1:8000/templates/api_register.php"
    )

    datos = respuesta.json()

    return jsonify(datos)

@app.route("/users")
def users():
    respuesta = requests.get(
        "http://172.19.0.1:8000/templates/api_login_user.php"
    )

    datos = respuesta.json()

    return jsonify(datos)


if __name__ == '__main__':
    print("🚀 Servidor Flask iniciado - Reconocimiento web + liveness listo")
    app.run(host='0.0.0.0', port=5001, debug=True)
