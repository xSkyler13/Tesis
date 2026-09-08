"""
Limpia encodings.pkl / known_faces/ de rostros que ya no corresponden
a ningun residente ni usuario activo en la base de datos.
Uso: python clean_encodings.py
"""
import requests
import utils.face_utils as fu
from utils.face_utils import load_known_faces, delete_face

API_URL = "http://172.19.0.1:8000/templates/api_encodings_validos.php"

def main():
    load_known_faces()
    registrados = list(fu.known_face_names)

    if not registrados:
        print("ℹ️ No hay rostros registrados, nada que limpiar.")
        return

    resp = requests.get(API_URL, timeout=10)
    resp.raise_for_status()
    validos = set(resp.json())

    huerfanos = [n for n in registrados if n not in validos]

    if not huerfanos:
        print(f"✅ Todo en orden: los {len(registrados)} rostros registrados corresponden a residentes/usuarios activos.")
        return

    print(f"🗑️ Eliminando {len(huerfanos)} rostro(s) huérfano(s): {huerfanos}")
    for nombre in huerfanos:
        delete_face(nombre)

    print(f"✅ Limpieza completa. Quedan {len(fu.known_face_names)} rostro(s) registrados: {fu.known_face_names}")

if __name__ == "__main__":
    main()
