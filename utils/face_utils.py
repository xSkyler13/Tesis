import os
import pickle
import face_recognition
import cv2

KNOWN_FACES_DIR = "known_faces"
ENCODINGS_FILE = "encodings.pkl"

known_face_encodings = []
known_face_names = []

def load_known_faces():
    global known_face_encodings, known_face_names
    if os.path.exists(ENCODINGS_FILE):
        with open(ENCODINGS_FILE, "rb") as f:
            data = pickle.load(f)
            known_face_encodings = data["encodings"]
            known_face_names = data["names"]
        print("✅ Encodings cargados correctamente")
    else:
        print("ℹ️ Aún no hay encodings")

def save_new_face(name: str, frame):
    if frame is None:
        print("❌ Frame recibido es None")
        return False

    if not os.path.exists(KNOWN_FACES_DIR):
        os.makedirs(KNOWN_FACES_DIR)

    # Guardar la imagen primero (esto corrige el formato)
    path = os.path.join(KNOWN_FACES_DIR, f"{name}.jpg")
    cv2.imwrite(path, frame)
    print(f"📸 Foto guardada: {path}")

    # === MÉTODO MÁS SEGURO ===
    # Cargamos la imagen desde el disco con face_recognition (evita el error de tipo)
    rgb_image = face_recognition.load_image_file(path)

    encodings = face_recognition.face_encodings(rgb_image)

    if len(encodings) > 0:
        known_face_encodings.append(encodings[0])
        known_face_names.append(name)

        with open(ENCODINGS_FILE, "wb") as f:
            pickle.dump({"encodings": known_face_encodings, "names": known_face_names}, f)

        print(f"✅ {name} registrado correctamente")
        return True
    else:
        print("❌ No se detectó ningún rostro claro")
        return False