const homeVideo = document.getElementById('home-video');
const homeOverlay = document.getElementById('home-overlay');
const homeCtx = homeOverlay ? homeOverlay.getContext('2d') : null;
const homeStatus = document.getElementById('camera-status');
const cameraOff = document.getElementById('camera-off');
const btnIniciar = document.getElementById('btn-camara-iniciar');

let homeStream = null;
let homeBusy = false;
let homePollId = null;
let homeApprovedUntil = 0;
let homeUnknownCapturedUntil = 0;
let homeAccessRegisteredUntil = 0;

const homeGrab = document.createElement('canvas');
homeGrab.width = 500;
homeGrab.height = 350;
const homeGctx = homeGrab.getContext('2d');

function registrarAccesoHome(usuario, resultado) {
	const fd = new FormData();
	fd.append('usuario', usuario);
	fd.append('resultado', resultado);
	fetch('http://localhost:8000/templates/api_acceso.php', { method: 'POST', body: fd })
		.then(() => { if (typeof cargarDashboardHome === 'function') cargarDashboardHome(); })
		.catch(() => {});
}

function drawBoxesHome(faces, color) {
	if (!homeCtx) return;
	homeCtx.clearRect(0, 0, homeOverlay.width, homeOverlay.height);
	(faces || []).forEach(f => {
		homeCtx.strokeStyle = color;
		homeCtx.lineWidth = 3;
		homeCtx.strokeRect(f.left, f.top, f.right - f.left, f.bottom - f.top);
	});
}

async function iniciarCamaraHome() {
	try {
		homeStream = await navigator.mediaDevices.getUserMedia({ video: true });
		homeVideo.srcObject = homeStream;
		cameraOff.style.display = 'none';
		homePollId = setInterval(tickHome, 1500);
	} catch (error) {
		homeStatus.className = 'camera-status denegado';
		homeStatus.textContent = '❌ No se pudo acceder a la cámara';
	}
}

function detenerCamaraHome() {
	if (homeStream) {
		homeStream.getTracks().forEach(track => track.stop());
		homeStream = null;
	}
	if (homePollId) {
		clearInterval(homePollId);
		homePollId = null;
	}
	if (homeCtx) homeCtx.clearRect(0, 0, homeOverlay.width, homeOverlay.height);
	cameraOff.style.display = 'flex';
	homeStatus.className = 'camera-status esperando';
	homeStatus.textContent = '👀 Esperando detección de rostro...';
}

async function tickHome() {
	if (!homeStream || homeBusy || homeVideo.readyState !== 4) return;
	if (Date.now() < homeApprovedUntil) return;
	homeBusy = true;
	try {
		homeGctx.drawImage(homeVideo, 0, 0, homeGrab.width, homeGrab.height);
		const image = homeGrab.toDataURL('image/jpeg', 0.7);

		const fd = new FormData();
		fd.append('image', image);

		const res = await fetch('/recognize', { method: 'POST', body: fd, credentials: 'same-origin' });
		const data = await res.json();

		switch (data.status) {
			case 'approved':
				drawBoxesHome(data.faces, '#28a745');
				homeStatus.className = 'camera-status acceso';
				homeStatus.textContent = `✅ Bienvenido ${data.name}`;
				homeApprovedUntil = Date.now() + 4000;
				if (Date.now() > homeAccessRegisteredUntil) {
					homeAccessRegisteredUntil = Date.now() + 5000;
					registrarAccesoHome(data.name, 'APROBADO');
				}
				break;
			case 'challenge':
				drawBoxesHome(data.faces, '#007bff');
				homeStatus.className = 'camera-status reto';
				homeStatus.textContent = `🔐 ${data.name} — ${data.instruction}`;
				break;
			case 'unknown':
				drawBoxesHome(data.faces, '#dc3545');
				homeStatus.className = 'camera-status denegado';
				homeStatus.textContent = '❌ Persona no registrada';
				if (Date.now() > homeUnknownCapturedUntil) {
					homeUnknownCapturedUntil = Date.now() + 10000;
					const fotoFd = new FormData();
					fotoFd.append('foto_base64', image);
					fetch('http://localhost:8000/templates/api_unknown_face.php', { method: 'POST', body: fotoFd }).catch(() => {});
					registrarAccesoHome('desconocido', 'DENEGADO');
				}
				break;
			default:
				if (homeCtx) homeCtx.clearRect(0, 0, homeOverlay.width, homeOverlay.height);
				homeStatus.className = 'camera-status esperando';
				homeStatus.textContent = '👀 Esperando detección de rostro...';
		}
	} catch (error) {
		console.error(error);
	}
	homeBusy = false;
}

if (btnIniciar) {
	btnIniciar.addEventListener('click', iniciarCamaraHome);
}
