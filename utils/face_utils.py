import os
import pickle
import face_recognition
import cv2

KNOWN_FACES_DIR = "known_faces"
INACTIVE_FACES_DIR = "known_faces_inactivos"
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

def delete_face(name: str) -> bool:
    """Saca a `name` del reconocimiento facial. La foto NO se borra: se mueve a
    known_faces_inactivos/ para poder reactivarla luego sin volver a tomarla."""
    global known_face_encodings, known_face_names

    if name not in known_face_names:
        return False

    indices = [i for i, n in enumerate(known_face_names) if n == name]
    known_face_encodings = [e for i, e in enumerate(known_face_encodings) if i not in indices]
    known_face_names = [n for i, n in enumerate(known_face_names) if i not in indices]

    with open(ENCODINGS_FILE, "wb") as f:
        pickle.dump({"encodings": known_face_encodings, "names": known_face_names}, f)

    origen = os.path.join(KNOWN_FACES_DIR, f"{name}.jpg")
    if os.path.exists(origen):
        if not os.path.exists(INACTIVE_FACES_DIR):
            os.makedirs(INACTIVE_FACES_DIR)
        destino = os.path.join(INACTIVE_FACES_DIR, f"{name}.jpg")
        os.replace(origen, destino)

    print(f"🚫 {name} desactivado del reconocimiento facial")
    return True


def reactivate_face(name: str) -> bool:
    """Reactiva a `name`: mueve su foto de known_faces_inactivos/ de vuelta a
    known_faces/ y vuelve a generar su encoding facial."""
    global known_face_encodings, known_face_names

    origen = os.path.join(INACTIVE_FACES_DIR, f"{name}.jpg")
    if not os.path.exists(origen):
        return False

    if not os.path.exists(KNOWN_FACES_DIR):
        os.makedirs(KNOWN_FACES_DIR)
    destino = os.path.join(KNOWN_FACES_DIR, f"{name}.jpg")
    os.replace(origen, destino)

    # La foto ya quedó movida a known_faces/ pase lo que pase de acá en más:
    # si algo falla al re-generar el encoding, no se pierde el archivo.
    try:
        rgb_image = face_recognition.load_image_file(destino)
        encodings = face_recognition.face_encodings(rgb_image)
    except Exception as e:
        print(f"❌ Error leyendo la foto de {name} al reactivar: {e}")
        return False

    if len(encodings) == 0:
        print(f"❌ No se detectó rostro claro al reactivar a {name}")
        return False

    if name not in known_face_names:
        known_face_encodings.append(encodings[0])
        known_face_names.append(name)

    with open(ENCODINGS_FILE, "wb") as f:
        pickle.dump({"encodings": known_face_encodings, "names": known_face_names}, f)

    print(f"✅ {name} reactivado en el reconocimiento facial")
    return True