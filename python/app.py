from flask import Blueprint, request, jsonify, session
import cv2
import base64
import time
import random
import numpy as np
import face_recognition

import utils.face_utils as fu
from utils.face_utils import load_known_faces, save_new_face, delete_face, reactivate_face

face_bp = Blueprint('face', __name__)

# ==================== PARÁMETROS LIVENESS ====================
EAR_THRESHOLD = 0.21
TURN_THRESHOLD = 0.10
CHALLENGE_TIMEOUT = 8.0

CHALLENGES = ["blink", "turn_left", "turn_right"]
CHALLENGE_LABEL = {
    "blink": "Parpadea 😉",
    "turn_left": "Gira la cabeza a tu IZQUIERDA ⬅️",
    "turn_right": "Gira la cabeza a tu DERECHA ➡️",
}


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
        matches = face_recognition.compare_faces(fu.known_face_encodings, encodings[0], tolerance=0.5)
        if True in matches:
            name = fu.known_face_names[matches.index(True)]

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


def start_challenge(name):
    challenge = random.choice(CHALLENGES)
    session["lv"] = {
        "name": name,
        "challenge": challenge,
        "start": time.time(),
        "ear_open_seen": False,
        "blinked": False,
        "turn_base": None,
    }
    return challenge


# ==================== REGISTRO ====================
@face_bp.route('/save_face', methods=['POST'])
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
def delete_face_route():
    name = request.form.get('name')
    if not name:
        return jsonify({"success": False, "message": "Falta el nombre"})
    if delete_face(name):
        return jsonify({"success": True, "message": f"🚫 {name} desactivado"})
    return jsonify({"success": False, "message": "No se encontró ese rostro registrado"})


# ==================== REACTIVACIÓN ====================
@face_bp.route('/reactivate_face', methods=['POST'])
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
            return jsonify({"status": "unknown", "faces": [box]})

        lv = session.get("lv")
        if not lv or lv["name"] != name:
            challenge = start_challenge(name)
            return jsonify({
                "status": "challenge",
                "name": name,
                "challenge": challenge,
                "instruction": CHALLENGE_LABEL[challenge],
                "faces": [box],
            })

        if time.time() - lv["start"] > CHALLENGE_TIMEOUT:
            challenge = start_challenge(name)
            return jsonify({
                "status": "challenge",
                "name": name,
                "challenge": challenge,
                "instruction": CHALLENGE_LABEL[challenge],
                "faces": [box],
                "retry": True,
            })

        challenge = lv["challenge"]
        passed = False
        debug = {}

        if challenge == "blink":
            ear = compute_ear(landmarks)
            if ear is not None:
                if ear > EAR_THRESHOLD + 0.05:
                    lv["ear_open_seen"] = True
                if lv["ear_open_seen"] and ear < EAR_THRESHOLD:
                    lv["blinked"] = True
                debug = {"ear": round(ear, 3), "thr": EAR_THRESHOLD, "open_seen": lv["ear_open_seen"]}
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
                debug = {"ratio": round(ratio, 3), "base": round(lv["turn_base"], 3),
                         "delta": round(delta, 3), "thr": TURN_THRESHOLD}

        session["lv"] = lv

        if passed:
            session.pop("lv", None)
            return jsonify({"status": "approved", "name": name, "faces": [box]})

        return jsonify({
            "status": "challenge",
            "name": name,
            "challenge": challenge,
            "instruction": CHALLENGE_LABEL[challenge],
            "faces": [box],
            "debug": debug,
        })

    except Exception as e:
        print("Error recognize:", str(e))
        return jsonify({"status": "error", "faces": []})
