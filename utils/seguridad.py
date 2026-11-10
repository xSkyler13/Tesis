"""Controles de seguridad de la sesión web: límite de intentos de login y
expiración de sesión por inactividad / duración máxima."""
import threading
import time


class LimitadorIntentos:
    """Bloquea una clave (IP o usuario) tras `maximo` fallos dentro de `ventana`
    segundos, durante `bloqueo` segundos. En memoria: se reinicia con Flask, lo
    que es aceptable para frenar fuerza bruta en un solo servidor."""

    def __init__(self, maximo=5, ventana=15 * 60, bloqueo=15 * 60):
        self.maximo = maximo
        self.ventana = ventana
        self.bloqueo = bloqueo
        self._fallos = {}          # clave -> [timestamps de fallos]
        self._bloqueado_hasta = {}  # clave -> timestamp
        self._lock = threading.Lock()

    def segundos_bloqueado(self, *claves):
        """Segundos que faltan para desbloquear la clave más restringida (0 = libre)."""
        ahora = time.time()
        with self._lock:
            return max([int(self._bloqueado_hasta.get(c, 0) - ahora) for c in claves] + [0])

    def registrar_fallo(self, *claves):
        ahora = time.time()
        with self._lock:
            for c in claves:
                recientes = [t for t in self._fallos.get(c, []) if ahora - t < self.ventana]
                recientes.append(ahora)
                self._fallos[c] = recientes
                if len(recientes) >= self.maximo:
                    self._bloqueado_hasta[c] = ahora + self.bloqueo
                    self._fallos[c] = []

    def limpiar(self, *claves):
        with self._lock:
            for c in claves:
                self._fallos.pop(c, None)
                self._bloqueado_hasta.pop(c, None)


def sesion_expirada(sesion, inactividad, duracion_maxima, ahora=None):
    """True si la sesión superó su duración máxima o el tiempo sin actividad."""
    ahora = ahora or time.time()
    inicio = sesion.get('inicio', ahora)
    ultima = sesion.get('ultima_actividad', ahora)
    return ahora - inicio > duracion_maxima or ahora - ultima > inactividad
