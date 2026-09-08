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
let stream           = null;

function actualizarContador() {
	const restantes = MAX_INTENTOS - intentosUsados;
	intentosNum.textContent = restantes;
	intentosNum.style.color = restantes === 1 ? 'red' : '#333';
}

btnAbrir.addEventListener('click', () => {
	if (intentosUsados >= MAX_INTENTOS) return;
	navigator.mediaDevices.getUserMedia({ video: true })
		.then(s => {
			stream = s;
			video.srcObject = s;
			actualizarContador();
			modal.classList.add('activo');
		})
		.catch(() => alert('❌ No se pudo acceder a la cámara'));
})

function cerrarModal() {
	if (stream) {
		stream.getTracks().forEach(t => t.stop());
		stream = null;
	}
	modal.classList.remove('activo');
}

btnCapturar.addEventListener('click', () => {
	canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
	const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

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
	cerrarModal();
})

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
