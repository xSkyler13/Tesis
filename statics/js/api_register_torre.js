const form = document.getElementById('form-torre');

// CHAR COUNTERS
function bindCounter(textareaId, counterId) {
	const textarea = document.getElementById(textareaId);
	const counter = document.getElementById(counterId);
	textarea.addEventListener('input', () => {
		counter.textContent = textarea.value.length;
	})
}
bindCounter('descripcion', 'descripcion-count');
bindCounter('observaciones', 'observaciones-count');

// IMAGEN - drag & drop / seleccionar
const imageDrop      = document.getElementById('image-drop');
const imageInput     = document.getElementById('imagen_torre');
const imageEmpty     = document.getElementById('image-drop-empty');
const imagePreview   = document.getElementById('image-drop-preview');
const imageImg       = document.getElementById('image-drop-img');
const imageRemoveBtn = document.getElementById('image-drop-remove');
const imageBase64Input = document.getElementById('imagen_base64');
const previewImg      = document.getElementById('preview-img');
const previewPlaceholderIcon = document.getElementById('preview-placeholder-icon');

function leerImagen(file) {
	if (!file) return;
	const reader = new FileReader();
	reader.onload = (e) => {
		imageBase64Input.value = e.target.result;
		imageImg.src = e.target.result;
		imageEmpty.style.display = 'none';
		imagePreview.style.display = 'block';

		previewImg.src = e.target.result;
		previewImg.style.display = 'block';
		previewPlaceholderIcon.style.display = 'none';
	}
	reader.readAsDataURL(file);
}

imageDrop.addEventListener('click', (e) => {
	if (e.target !== imageRemoveBtn) imageInput.click();
})
imageInput.addEventListener('change', () => leerImagen(imageInput.files[0]));

imageDrop.addEventListener('dragover', (e) => {
	e.preventDefault();
	imageDrop.classList.add('dragover');
})
imageDrop.addEventListener('dragleave', () => imageDrop.classList.remove('dragover'));
imageDrop.addEventListener('drop', (e) => {
	e.preventDefault();
	imageDrop.classList.remove('dragover');
	leerImagen(e.dataTransfer.files[0]);
})
imageRemoveBtn.addEventListener('click', (e) => {
	e.stopPropagation();
	imageInput.value = '';
	imageBase64Input.value = '';
	imageEmpty.style.display = 'block';
	imagePreview.style.display = 'none';
	previewImg.style.display = 'none';
	previewPlaceholderIcon.style.display = 'block';
})

// VISTA PREVIA / RESUMEN / DISTRIBUCIÓN en vivo
const nombreInput   = document.getElementById('nombre');
const codigoInput   = document.getElementById('codigo');
const pisosInput    = document.getElementById('numero_pisos');
const deptosInput   = document.getElementById('numero_departamentos');
const estadoSelect  = document.getElementById('estado');

const previewNombre = document.getElementById('preview-nombre');
const previewEstado = document.getElementById('preview-estado');
const previewPisos  = document.getElementById('preview-pisos');
const previewDeptos = document.getElementById('preview-deptos');
const resumenCodigo = document.getElementById('resumen-codigo');
const resumenPisos  = document.getElementById('resumen-pisos');
const resumenDeptosPiso = document.getElementById('resumen-deptos-piso');
const resumenEstado = document.getElementById('resumen-estado');
const distribucionEl = document.getElementById('torre-distribucion');

function actualizarPreview() {
	const nombre = nombreInput.value.trim() || 'Torre';
	const codigo = codigoInput.value.trim();
	const pisos  = parseInt(pisosInput.value) || 0;
	const deptos = parseInt(deptosInput.value) || 0;
	const estado = estadoSelect.value;

	previewNombre.textContent = nombre;
	previewEstado.textContent = estado;
	previewEstado.className = 'torre-preview-estado badge-status ' + (estado === 'Activo' ? 'success' : 'warning');
	previewPisos.textContent = pisos || '--';
	previewDeptos.textContent = deptos || '--';

	resumenCodigo.textContent = codigo || '--';
	resumenPisos.textContent = pisos || '--';
	resumenDeptosPiso.textContent = (pisos > 0 && deptos > 0) ? Math.round(deptos / pisos) : '--';
	resumenEstado.textContent = estado;
	resumenEstado.className = 'badge-status ' + (estado === 'Activo' ? 'success' : 'warning');

	actualizarDistribucion(pisos, deptos);
}

function actualizarDistribucion(pisos, deptos) {
	if (!pisos || !deptos) {
		distribucionEl.innerHTML = '<li class="dist-empty">Completá pisos y departamentos para ver la distribución</li>';
		return;
	}

	const deptosPorPiso = Math.round(deptos / pisos);
	const gruposDeseados = 4;
	const tamanoGrupo = Math.max(1, Math.ceil(pisos / gruposDeseados));

	let html = '';
	for (let inicio = pisos; inicio >= 1; inicio -= tamanoGrupo) {
		const fin = Math.max(1, inicio - tamanoGrupo + 1);
		const label = (inicio === fin) ? `Piso ${inicio}` : `Piso ${fin} - ${inicio}`;
		const anchoPorcentaje = Math.min(100, (deptosPorPiso / (deptosPorPiso + 2)) * 100);
		html += `
			<li>
				<span class="dist-label">${label}</span>
				<span class="dist-bar"><span class="dist-bar-fill" style="width:${anchoPorcentaje}%"></span></span>
				<span class="dist-count">${deptosPorPiso} dptos.</span>
			</li>
		`;
	}
	distribucionEl.innerHTML = html;
}

[nombreInput, codigoInput, pisosInput, deptosInput, estadoSelect].forEach(el => {
	el.addEventListener('input', actualizarPreview);
	el.addEventListener('change', actualizarPreview);
})
actualizarPreview();

// ADMINISTRADORES
async function cargarAdministradores() {
	const select = document.getElementById('administrador_id');
	try {
		const response = await fetch('http://localhost:8000/templates/api_administradores.php');
		const result = await response.json();

		select.innerHTML = '<option value="">-- Sin asignar --</option>';

		result.forEach(admin => {
			const option = document.createElement('option');
			option.value = admin.id;
			option.textContent = admin.usuario;
			select.appendChild(option);
		})
	} catch (error) {
		console.error(error);
		select.innerHTML = '<option value="">Error al cargar</option>';
	}
}
cargarAdministradores();

// SUBMIT
form.addEventListener('submit', async (e) => {
	e.preventDefault();

	const mensaje = document.getElementById('mensaje');
	const formData = new FormData(form);

	try {
		const response = await fetch(
			'http://localhost:8000/templates/api_register_torre.php',
			{ method: 'POST', body: formData }
		);
		const data = await response.json();

		if (data.success) {
			mensaje.innerHTML = '<p class="success">✅ Torre registrada correctamente.</p>';
			form.reset();
			imageEmpty.style.display = 'block';
			imagePreview.style.display = 'none';
			previewImg.style.display = 'none';
			previewPlaceholderIcon.style.display = 'block';
			document.getElementById('descripcion-count').textContent = '0';
			document.getElementById('observaciones-count').textContent = '0';
			actualizarPreview();
		} else {
			mensaje.innerHTML = `<p class="error">❌ ${data.message}</p>`;
		}
	} catch (error) {
		console.error(error);
		document.getElementById('mensaje').innerHTML = '<p class="error">❌ Error de conexión con la API.</p>';
	}
})
