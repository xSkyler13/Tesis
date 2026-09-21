const MAX_INTENTOS = 3;
let intentosUsados = 0;

const modal          = document.getElementById('modal-camara');
const video          = document.getElementById('video-cam');
const canvas         = document.getElementById('canvas-cam');
const previewImg     = document.getElementById('preview-img');
const photoPlaceholder = document.getElementById('photo-placeholder');
const statusLabel    = document.getElementById('foto-label-status');
const base64Input    = document.getElementById('foto_base64');
const btnAbrir       = document.getElementById('btn-abrir-camara');
const btnCapturar    = document.getElementById('btn-capturar');
const intentosNum    = document.getElementById('intentos-num');
const form           = document.getElementById('form-propietario');

const faceidRing     = document.getElementById('faceid-ring');
const faceidStatus   = document.getElementById('faceid-status');
const faceidCheck    = document.getElementById('faceid-check');

let stream = null;
let polling = null;
let capturando = false;
let listoDesde = 0;

function actualizarContador() {
	const restantes = MAX_INTENTOS - intentosUsados;
	intentosNum.textContent = restantes;
	intentosNum.style.color = restantes === 1 ? '#FC3B56' : '';
}

function setAnilloEstado(estado, mensaje) {
	faceidRing.className = 'faceid-ring' + (estado ? ` ${estado}` : '');
	faceidStatus.textContent = mensaje;
}

btnAbrir.addEventListener('click', () => {
	if (intentosUsados >= MAX_INTENTOS) return;
	navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
		.then(s => {
			stream = s;
			video.srcObject = s;
			actualizarContador();
			capturando = false;
			listoDesde = 0;
			faceidCheck.classList.remove('mostrar');
			setAnilloEstado('', 'Colocá tu rostro dentro del círculo');
			modal.classList.add('activo');
			iniciarDeteccion();
		})
		.catch(() => alert('❌ No se pudo acceder a la cámara'));
})

function iniciarDeteccion() {
	detenerDeteccion();
	polling = setInterval(async () => {
		if (capturando || video.readyState !== 4) return;

		canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
		const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

		try {
			const fd = new FormData();
			fd.append('image', dataUrl);
			const res = await fetch('http://localhost:5001/detectar_rostro', { method: 'POST', body: fd });
			const data = await res.json();

			if (!data.rostro) {
				listoDesde = 0;
				setAnilloEstado('', 'Colocá tu rostro dentro del círculo');
			} else if (data.listo) {
				if (!listoDesde) listoDesde = Date.now();
				setAnilloEstado('listo', 'Mantené la posición...');
				if (Date.now() - listoDesde > 700) {
					capturarFoto(dataUrl);
				}
			} else {
				listoDesde = 0;
				const msg = !data.centrado ? 'Centrá tu rostro en el círculo' : 'Acercate un poco más';
				setAnilloEstado('ajustando', msg);
			}
		} catch (error) {
			// Si el backend de reconocimiento no responde, no bloqueamos: se
			// puede seguir usando "Capturar manualmente".
			listoDesde = 0;
		}
	}, 700);
}

function detenerDeteccion() {
	if (polling) {
		clearInterval(polling);
		polling = null;
	}
}

function cerrarModal() {
	detenerDeteccion();
	if (stream) {
		stream.getTracks().forEach(t => t.stop());
		stream = null;
	}
	modal.classList.remove('activo');
}

function capturarFoto(dataUrlPrecomputado) {
	if (capturando) return;
	capturando = true;
	detenerDeteccion();

	const dataUrl = dataUrlPrecomputado || (() => {
		canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
		return canvas.toDataURL('image/jpeg', 0.9);
	})();

	base64Input.value        = dataUrl;
	previewImg.src           = dataUrl;
	previewImg.style.display = 'block';
	photoPlaceholder.style.display = 'none';
	intentosUsados++;

	const restantes = MAX_INTENTOS - intentosUsados;
	if (restantes === 0) {
		statusLabel.innerHTML  = '✅ Foto capturada — <span style="color:red">sin más intentos</span>';
		btnAbrir.disabled      = true;
		btnAbrir.style.opacity = '0.5';
		btnAbrir.title         = 'Límite de intentos alcanzado';
	} else {
		statusLabel.textContent = `✅ Foto capturada (${restantes} intento${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''})`;
	}

	faceidCheck.classList.add('mostrar');
	faceidStatus.textContent = '✅ ¡Listo!';

	setTimeout(cerrarModal, 600);
}

btnCapturar.addEventListener('click', () => capturarFoto());

document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModal);

async function cargarTorres() {
	const select = document.getElementById('torre_id');
	try {
		const response = await fetch('http://localhost:8000/templates/api_torres.php');
		const result = await response.json();

		select.innerHTML = '<option value="">-- Seleccione --</option>';

		result.forEach(torre => {
			const option = document.createElement('option');
			option.value = torre.id;
			option.textContent = torre.nombre;
			select.appendChild(option);
		})
	} catch (error) {
		console.error(error);
		select.innerHTML = '<option value="">Error al cargar</option>';
	}
}
cargarTorres();

const departamentoSelect = document.getElementById('departamento_id');

document.getElementById('torre_id').addEventListener('change', async function () {
	const torreId = this.value;

	if (!torreId) {
		departamentoSelect.innerHTML = '<option value="">-- Seleccione una torre primero --</option>';
		departamentoSelect.disabled = true;
		return;
	}

	departamentoSelect.disabled = true;
	departamentoSelect.innerHTML = '<option value="">Cargando...</option>';

	try {
		const response = await fetch(
			`http://localhost:8000/templates/api_departamentos.php?torre_id=${torreId}`
		);
		const result = await response.json();

		if (result.length === 0) {
			departamentoSelect.innerHTML = '<option value="">Sin departamentos registrados</option>';
			return;
		}

		departamentoSelect.innerHTML = '<option value="">-- Seleccione --</option>';
		result.forEach(depto => {
			const option = document.createElement('option');
			option.value = depto.id;
			option.textContent = `${depto.numero} (Piso ${depto.piso})`;
			departamentoSelect.appendChild(option);
		})
		departamentoSelect.disabled = false;
	} catch (error) {
		console.error(error);
		departamentoSelect.innerHTML = '<option value="">Error al cargar</option>';
	}
})

async function cargarTipoResidentes() {
	const select = document.getElementById('tipo_residente_id');
	try {
		const response = await fetch(
			'http://localhost:8000/templates/api_tipo_residentes.php'
		);
		const result = await response.json();

		select.innerHTML = '<option value="">-- Seleccione --</option>';

		result.forEach(tipo => {
			const option = document.createElement('option');
			option.value = tipo.id;
			option.textContent = tipo.nombre;
			select.appendChild(option);
		})
	} catch (error) {
		console.error(error);
		select.innerHTML = '<option value="">Error al cargar</option>';
	}
}
cargarTipoResidentes();

form.addEventListener('submit', async (e) => {
	e.preventDefault();

	if (base64Input.value === '') {
		const confirmar = confirm(
			'⚠️ No capturaste una foto.\n' +
			'Sin foto, este propietario NO podrá usar el ingreso por reconocimiento facial.\n\n' +
			'¿Deseas continuar?'
		);
		if (!confirmar) return;
	}

	const mensaje = document.getElementById('mensaje');
	const nombres = document.getElementById('nombres').value.trim();
	const apellidos = document.getElementById('apellidos').value.trim();
	const nombreCompleto = `${nombres} ${apellidos}`.trim();

	const formData = new FormData(form);

	try {
		const response = await fetch(
			'http://localhost:8000/templates/api_register_residente.php',
			{ method: 'POST', body: formData }
		);

		const data = await response.json();

		if (data.success) {
			if (base64Input.value) {
				const flaskForm = new FormData();
				flaskForm.append('name', nombreCompleto);
				flaskForm.append('image', base64Input.value);
				fetch('http://localhost:5001/save_face', { method: 'POST', body: flaskForm })
					.catch(() => {});
			}

			mensaje.innerHTML = '<p class="success">✅ Propietario registrado correctamente.</p>';
			form.reset();
			previewImg.style.display = 'none';
			photoPlaceholder.style.display = 'flex';
			base64Input.value = '';
			statusLabel.textContent = 'Sin foto capturada';
		} else {
			mensaje.innerHTML = `<p class="error">❌ ${data.message}</p>`;
		}
	} catch (error) {
		console.error(error);
		document.getElementById('mensaje').innerHTML = '<p class="error">❌ Error de conexión con la API.</p>';
	}
})
