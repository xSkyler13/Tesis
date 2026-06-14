const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const octx = overlay.getContext('2d');
const statusDiv = document.getElementById('status');

let stream = null;
let busy = false;
let approvedUntil = 0;

const grab = document.createElement('canvas');
grab.width = 500;
grab.height = 350;

const gctx = grab.getContext('2d');

function drawBoxes(faces, color) {
    octx.clearRect(0, 0, overlay.width, overlay.height);
    (faces || []).forEach(f => {
        octx.strokeStyle = color;
        octx.lineWidth = 3;
        octx.strokeRect(f.left, f.top, f.right - f.left, f.bottom - f.top);
    });
}

async function ingresar() {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("faceSection").style.display = "block";
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
    octx.clearRect(0, 0, overlay.width, overlay.height);
    document.getElementById("faceSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";
    statusDiv.className = "status esperando";
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
                drawBoxes(data.faces, "#28a745");
                statusDiv.className = "status acceso";
                statusDiv.innerHTML = `✅ ¡Bienvenido ${data.name}!
                <br>
                <small> Acceso concedido </small>`;
                approvedUntil = Date.now() + 4000;
                setTimeout(() => {
                    cerrarReconocimiento();
                }, 4000);
                break;
            case 'challenge':
                drawBoxes(data.faces, "#007bff");
                statusDiv.className = "status reto";
                statusDiv.innerHTML = `🔐 ${data.name}
                <br>
                Verificación:
                <b>${data.instruction}</b>`;
                break;
            case 'unknown':
                drawBoxes(data.faces, "#dc3545");
                statusDiv.className = "status denegado";
                statusDiv.innerHTML = "❌ Persona no registrada";
                break;
            default:
                octx.clearRect(0, 0, overlay.width, overlay.height);
                statusDiv.className = "status esperando";
                statusDiv.innerHTML = "👀 Esperando detección de rostro...";
        }
    } catch (error) { console.log(error);}
    busy = false;
}
setInterval(tick, 500);
