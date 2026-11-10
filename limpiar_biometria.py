"""
Aplica la política de retención de datos biométricos (ver api_retencion_biometrica.php).
Se ejecuta dentro del contenedor de Flask, que es dueño de known_faces_inactivos/:
    docker exec tesis-web-1 python limpiar_biometria.py
start.sh lo corre al iniciar; en el hosting conviene un cron diario.
No toca encodings.npz: los rostros de residentes dados de baja ya salieron del
reconocimiento al darlos de baja (y el servidor en ejecución lo tiene en memoria).
"""
import os

import requests

from utils.config import PHP_URL, headers_internos
from utils.face_utils import INACTIVE_FACES_DIR, KNOWN_FACES_DIR, nombre_valido


def main():
    resp = requests.post(f"{PHP_URL}/templates/api_retencion_biometrica.php", headers=headers_internos(), timeout=30)
    resp.raise_for_status()
    datos = resp.json()

    borradas = 0
    for nombre in datos.get("residentes_de_baja", []):
        if not nombre_valido(nombre):
            continue
        for carpeta in (INACTIVE_FACES_DIR, KNOWN_FACES_DIR):
            ruta = os.path.join(carpeta, f"{nombre}.jpg")
            if os.path.exists(ruta):
                os.remove(ruta)
                borradas += 1

    print(f"🧹 Retención biométrica: {datos.get('fotos_no_reconocidos_borradas', 0)} fotos de no reconocidos, "
          f"{len(datos.get('residentes_de_baja', []))} residentes de baja ({borradas} fotos del módulo facial).")


if __name__ == "__main__":
    main()
