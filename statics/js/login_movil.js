const video = document.getElementById('video');
const faceSection = document.getElementById('faceSection');
const faceidRing = document.getElementById('faceid-ring');
const faceidCheck = document.getElementById('faceid-check');
const statusDiv = document.getElementById('status');

let stream = null;
let busy = false;
let approvedUntil = 0;
let unknownCapturedUntil = 0;
let accessRegisteredUntil = 0;

function registrarAcceso(usuario, resultado) {
    const fd = new FormData();
    fd.append('usuario', usuario);
    fd.append('resultado', resultado);
    fetch('http://localhost:8000/templates/api_acceso.php', { method: 'POST', body: fd }).catch(() => {});
}

const grab = document.createElement('canvas');
grab.width = 500;
grab.height = 350;

const gctx = grab.getContext('2d');

function setAnilloEstado(estado) {
    faceidRing.className = 'faceid-ring' + (estado ? ` ${estado}` : '');
}

async function ingresar() {
    document.getElementById("loginSection").style.display = "none";
    faceSection.classList.add('activo');
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        video.srcObject = stream;
    } catch (error) {
        statusDiv.innerHTML = "❌ No se pudo acceder a la cámara";
    }
}

function cerrarReconocimiento() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    setAnilloEstado('');
    faceidCheck.classList.remove('mostrar');
    faceSection.classList.remove('activo');
    document.getElementById("loginSection").style.display = "block";
    statusDiv.className = "faceid-status";
    statusDiv.innerHTML = "👀 Esperando detección de rostro...";
}

async function tick() {
    if (!stream) return;
    if (busy || video.readyState !== 4) return;
    if (Date.now() < approvedUntil) return;
    busy = true;
    try {
        gctx.drawImage(
            video,
            0,
            0,
            grab.width,
            grab.height
        );
        const image =
            grab.toDataURL('image/jpeg', 0.7);

        const fd = new FormData();
        fd.append('image', image);

        const res = await fetch(
            '/recognize',
            {
                method: 'POST',
                body: fd,
                credentials: 'same-origin'
            }
        );

        const data = await res.json();
        switch (data.status) {
            case 'approved':
                setAnilloEstado('listo');
                faceidCheck.classList.add('mostrar');
                statusDiv.className = "faceid-status";
                statusDiv.innerHTML = `✅ ¡Bienvenido ${data.name}!
                <br>
                <small> Acceso concedido </small>`;
                approvedUntil = Date.now() + 4000;
                if (Date.now() > accessRegisteredUntil) {
                    accessRegisteredUntil = Date.now() + 5000;
                    registrarAcceso(data.name, 'APROBADO');
                }
                setTimeout(() => {
                    cerrarReconocimiento();
                }, 4000);
                break;
            case 'challenge':
                faceidCheck.classList.remove('mostrar');
                setAnilloEstado('ajustando');
                statusDiv.className = "faceid-status";
                statusDiv.innerHTML = `🔐 ${data.name}
                <br>
                Verificación:
                <b>${data.instruction}</b>`;
                break;
            case 'unknown':
                faceidCheck.classList.remove('mostrar');
                setAnilloEstado('error');
                statusDiv.className = "faceid-status";
                statusDiv.innerHTML = "❌ Persona no registrada";
                if (Date.now() > unknownCapturedUntil) {
                    unknownCapturedUntil = Date.now() + 10000;
                    const fotoFd = new FormData();
                    fotoFd.append('foto_base64', image);
                    fetch('http://localhost:8000/templates/api_unknown_face.php', {
                        method: 'POST',
                        body: fotoFd
                    }).catch(() => {});
                    registrarAcceso('desconocido', 'DENEGADO');
                }
                break;
            default:
                faceidCheck.classList.remove('mostrar');
                setAnilloEstado('');
                statusDiv.className = "faceid-status";
                statusDiv.innerHTML = "👀 Esperando detección de rostro...";
        }
    } catch (error) { console.log(error);}
    busy = false;
}
setInterval(tick, 500);
