import hmac
from functools import wraps

from flask import Blueprint, request, jsonify, session
import cv2
import base64
import time
import random
import numpy as np
import face_recognition
import requests

import utils.face_utils as fu
from utils.config import INTERNAL_TOKEN, PHP_URL, headers_internos
from utils.face_utils import load_known_faces, save_new_face, delete_face, reactivate_face

face_bp = Blueprint('face', __name__)

# ==================== PARÁMETROS LIVENESS ====================
EAR_THRESHOLD = 0.21
TURN_THRESHOLD = 0.10
CHALLENGE_TIMEOUT = 8.0        # segundos para cumplir cada reto
RETOS_POR_VERIFICACION = 2     # retos distintos, en orden aleatorio
INTERVALO_MIN_FRAMES = 0.25    # frames más seguidos se ignoran (envío automatizado)

CHALLENGES = ["blink", "turn_left", "turn_right"]
CHALLENGE_LABEL = {
    "blink": "Parpadea 😉",
    "turn_left": "Gira la cabeza a tu IZQUIERDA ⬅️",
    "turn_right": "Gira la cabeza a tu DERECHA ➡️",
}


# Un mismo desconocido frente a la cámara no debe generar una foto por frame
UNKNOWN_CAPTURE_INTERVAL = 10.0
_ultima_captura_desconocido = 0.0


# ==================== PERMISOS ====================
def requiere_sesion(vista):
    @wraps(vista)
    def envuelta(*args, **kwargs):
        if 'usuario_id' not in session:
            return jsonify({"success": False, "message": "Sesión expirada"}), 401
        return vista(*args, **kwargs)
    return envuelta


def requiere_interno(vista):
    """Solo para llamadas servidor a servidor (PHP -> Flask)."""
    @wraps(vista)
    def envuelta(*args, **kwargs):
        if not hmac.compare_digest(request.headers.get('X-Internal-Token', ''), INTERNAL_TOKEN):
            return jsonify({"success": False, "message": "No autorizado"}), 403
        return vista(*args, **kwargs)
    return envuelta


# ==================== REGISTRO EN PHP ====================
# El resultado del reconocimiento lo registra el servidor, nunca el navegador:
# así nadie puede marcar un acceso con un simple POST.
def registrar_acceso(nombre):
    try:
        r = requests.post(
            f"{PHP_URL}/templates/api_acceso.php",
            data={"usuario": nombre, "resultado": "APROBADO"},
            headers=headers_internos(),
            timeout=5,
        )
        return r.json().get("tipo")
    except (requests.RequestException, ValueError) as e:
        print("Error registrando acceso:", str(e))
        return None


def registrar_desconocido(image_data):
    global _ultima_captura_desconocido
    ahora = time.time()
    if ahora - _ultima_captura_desconocido < UNKNOWN_CAPTURE_INTERVAL:
        return
    _ultima_captura_desconocido = ahora
    try:
        requests.post(
            f"{PHP_URL}/templates/api_unknown_face.php",
            data={"foto_base64": image_data},
            headers=headers_internos(),
            timeout=5,
        )
    except requests.RequestException as e:
        print("Error guardando rostro desconocido:", str(e))


# ==================== UTILIDADES ====================
def decode_base64_image(image_data):
    if "," in image_data:
        _, encoded = image_data.split(",", 1)
    else:
        encoded = image_data
    img_bytes = base64.b64decode(encoded)
    nparr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def eye_aspect_ratio(eye):
    p = [np.array(pt, dtype=float) for pt in eye]
    a = np.linalg.norm(p[1] - p[5])
    b = np.linalg.norm(p[2] - p[4])
    c = np.linalg.norm(p[0] - p[3])
    if c == 0:
        return 0.0
    return (a + b) / (2.0 * c)


def analyze_face(rgb_frame):
    locations = face_recognition.face_locations(rgb_frame)
    if not locations:
        return None

    idx = max(range(len(locations)),
              key=lambda i: (locations[i][2] - locations[i][0]) * (locations[i][1] - locations[i][3]))
    location = locations[idx]

    encodings = face_recognition.face_encodings(rgb_frame, [location])
    name = "Desconocido"
    if encodings and len(fu.known_face_encodings) > 0:
        # La coincidencia más cercana, no la primera que entre en la tolerancia
        distancias = face_recognition.face_distance(fu.known_face_encodings, encodings[0])
        mejor = int(np.argmin(distancias))
        if distancias[mejor] <= 0.5:
            name = fu.known_face_names[mejor]

    landmarks_list = face_recognition.face_landmarks(rgb_frame, [location])
    landmarks = landmarks_list[0] if landmarks_list else {}
    return name, landmarks, location


def compute_ear(landmarks):
    if "left_eye" not in landmarks or "right_eye" not in landmarks:
        return None
    return (eye_aspect_ratio(landmarks["left_eye"]) + eye_aspect_ratio(landmarks["right_eye"])) / 2.0


def head_turn_ratio(landmarks, location):
    if "nose_tip" not in landmarks or "chin" not in landmarks:
        return None
    chin = landmarks["chin"]
    jaw_left_x = chin[0][0]
    jaw_right_x = chin[-1][0]
    span = jaw_right_x - jaw_left_x
    if span == 0:
        return None
    nose_x = np.mean([p[0] for p in landmarks["nose_tip"]])
    return (nose_x - jaw_left_x) / span


def _iniciar_paso(lv):
    """Reinicia el estado de medición para el reto actual."""
    lv.update({"start": time.time(), "ear_open_seen": False, "blinked": False, "turn_base": None})


def start_challenge(name):
    # Varios retos distintos en orden aleatorio: un video pregrabado tendría que
    # coincidir con esta secuencia exacta (6 combinaciones posibles con 2 de 3).
    lv = {"name": name, "retos": random.sample(CHALLENGES, RETOS_POR_VERIFICACION), "paso": 0, "ultimo_frame": 0}
    _iniciar_paso(lv)
    session["lv"] = lv
    return lv


def respuesta_reto(lv, box, retry=False):
    """Instrucción del reto actual. No revela el nombre (no permite averiguar
    quién está registrado) ni datos internos de medición."""
    reto = lv["retos"][lv["paso"]]
    return jsonify({
        "status": "challenge",
        "challenge": reto,
        "instruction": CHALLENGE_LABEL[reto],
        "paso": lv["paso"] + 1,
        "total_pasos": len(lv["retos"]),
        "faces": [{k: v for k, v in box.items() if k != "name"}],
        "retry": retry,
    })


# ==================== GUÍA DE CAPTURA (estilo Face ID) ====================
# No identifica a nadie: solo dice si hay un rostro en el frame, y qué tan
# grande/centrado está, para guiar al usuario mientras encuadra la foto.
@face_bp.route('/detectar_rostro', methods=['POST'])
@requiere_sesion
def detectar_rostro():
    image_data = request.form.get('image')
    if not image_data:
        return jsonify({"rostro": False})

    try:
        frame = decode_base64_image(image_data)
        if frame is None:
            return jsonify({"rostro": False})

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        alto_frame, ancho_frame = rgb.shape[:2]

        locations = face_recognition.face_locations(rgb)
        if not locations:
            return jsonify({"rostro": False})

        # Si hay más de un rostro, usamos el más grande (el más cerca de la cámara)
        idx = max(range(len(locations)),
                  key=lambda i: (locations[i][2] - locations[i][0]) * (locations[i][1] - locations[i][3]))
        top, right, bottom, left = locations[idx]

        area_rostro = (right - left) * (bottom - top)
        area_frame = ancho_frame * alto_frame
        proporcion = area_rostro / area_frame if area_frame else 0

        centro_x = (left + right) / 2 / ancho_frame
        centro_y = (top + bottom) / 2 / alto_frame
        desvio_x = abs(centro_x - 0.5)
        desvio_y = abs(centro_y - 0.5)

        centrado = desvio_x < 0.12 and desvio_y < 0.15
        tamano_ok = proporcion >= 0.06

        return jsonify({
            "rostro": True,
            "listo": centrado and tamano_ok,
            "centrado": centrado,
            "tamano_ok": tamano_ok,
        })
    except Exception as e:
        print("Error en detectar_rostro:", str(e))
        return jsonify({"rostro": False})


# ==================== REGISTRO ====================
@face_bp.route('/save_face', methods=['POST'])
@requiere_sesion
def save_face():
    name = request.form.get('name')
    image_data = request.form.get('image')
    if not name or not image_data:
        return jsonify({"success": False, "message": "Faltan datos"})
    try:
        frame = decode_base64_image(image_data)
        if frame is None:
            return jsonify({"success": False, "message": "Imagen inválida"})
        if save_new_face(name, frame):
            return jsonify({"success": True, "message": f"✅ {name} registrado correctamente"})
        return jsonify({"success": False, "message": "❌ No se detectó rostro claro"})
    except Exception as e:
        print("Error:", str(e))
        return jsonify({"success": False, "message": "Error interno"})


# ==================== ELIMINACIÓN ====================
@face_bp.route('/delete_face', methods=['POST'])
@requiere_interno
def delete_face_route():
    name = request.form.get('name')
    if not name:
        return jsonify({"success": False, "message": "Falta el nombre"})
    if delete_face(name):
        return jsonify({"success": True, "message": f"🚫 {name} desactivado"})
    return jsonify({"success": False, "message": "No se encontró ese rostro registrado"})


# ==================== REACTIVACIÓN ====================
@face_bp.route('/reactivate_face', methods=['POST'])
@requiere_interno
def reactivate_face_route():
    name = request.form.get('name')
    if not name:
        return jsonify({"success": False, "message": "Falta el nombre"})
    if reactivate_face(name):
        return jsonify({"success": True, "message": f"✅ {name} reactivado"})
    return jsonify({"success": False, "message": "No se encontró la foto para reactivar, o no se detectó un rostro claro"})


# ==================== RECONOCIMIENTO + LIVENESS ====================
@face_bp.route('/recognize', methods=['POST'])
def recognize():
    image_data = request.form.get('image')
    if not image_data:
        return jsonify({"status": "no_face", "faces": []})

    try:
        frame = decode_base64_image(image_data)
        if frame is None:
            return jsonify({"status": "no_face", "faces": []})

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = analyze_face(rgb)

        if result is None:
            session.pop("lv", None)
            return jsonify({"status": "no_face", "faces": []})

        name, landmarks, location = result
        top, right, bottom, left = location
        box = {"top": top, "right": right, "bottom": bottom, "left": left, "name": name}

        if name == "Desconocido":
            session.pop("lv", None)
            registrar_desconocido(image_data)
            return jsonify({"status": "unknown", "faces": [box]})

        lv = session.get("lv")
        if not lv or lv.get("name") != name or "retos" not in lv:
            return respuesta_reto(start_challenge(name), box)

        ahora = time.time()
        if ahora - lv["start"] > CHALLENGE_TIMEOUT:
            return respuesta_reto(start_challenge(name), box, retry=True)

        if ahora - lv["ultimo_frame"] < INTERVALO_MIN_FRAMES:
            return respuesta_reto(lv, box)
        lv["ultimo_frame"] = ahora

        challenge = lv["retos"][lv["paso"]]
        passed = False

        if challenge == "blink":
            ear = compute_ear(landmarks)
            if ear is not None:
                if ear > EAR_THRESHOLD + 0.05:
                    lv["ear_open_seen"] = True
                if lv["ear_open_seen"] and ear < EAR_THRESHOLD:
                    lv["blinked"] = True
            passed = lv["blinked"]
        else:
            ratio = head_turn_ratio(landmarks, location)
            if ratio is not None:
                if lv.get("turn_base") is None:
                    lv["turn_base"] = ratio
                delta = ratio - lv["turn_base"]
                if challenge == "turn_left" and delta > TURN_THRESHOLD:
                    passed = True
                if challenge == "turn_right" and delta < -TURN_THRESHOLD:
                    passed = True

        if passed:
            lv["paso"] += 1
            if lv["paso"] >= len(lv["retos"]):
                session.pop("lv", None)
                tipo = registrar_acceso(name)
                return jsonify({"status": "approved", "name": name, "tipo": tipo, "faces": [box]})
            _iniciar_paso(lv)

        session["lv"] = lv
        return respuesta_reto(lv, box)

    except Exception as e:
        print("Error recognize:", str(e))
        return jsonify({"status": "error", "faces": []})
