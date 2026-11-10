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

const homeGrab = document.createElement('canvas');
homeGrab.width = 500;
homeGrab.height = 350;
const homeGctx = homeGrab.getContext('2d');

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
				// El acceso ya lo registró el servidor al aprobar el rostro
				if (typeof cargarDashboardHome === 'function') cargarDashboardHome();
				break;
			case 'challenge':
				drawBoxesHome(data.faces, '#007bff');
				homeStatus.className = 'camera-status reto';
				// El nombre no se revela hasta aprobar
				homeStatus.textContent = `🔐 Verificando (${data.paso}/${data.total_pasos}) — ${data.instruction}`;
				break;
			case 'unknown':
				drawBoxesHome(data.faces, '#dc3545');
				homeStatus.className = 'camera-status denegado';
				homeStatus.textContent = '❌ Persona no registrada';
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
