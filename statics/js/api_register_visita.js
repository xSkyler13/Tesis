const torreSelect = document.getElementById('torre_id');
const departamentoSelect = document.getElementById('departamento_id');
const residenteSelect = document.getElementById('residente_id');
const contactoBox = document.getElementById('contacto-residente');

let residentesCache = [];

async function cargarTorres() {
	try {
		const response = await fetch('http://localhost:8000/templates/api_torres.php');
		const torres = await response.json();
		torreSelect.innerHTML = '<option value="">Seleccione una torre</option>';
		torres.forEach(t => {
			const option = document.createElement('option');
			option.value = t.id;
			option.textContent = t.nombre;
			torreSelect.appendChild(option);
		})
	} catch (error) {
		console.error(error);
	}
}
cargarTorres();

torreSelect.addEventListener('change', async () => {
	departamentoSelect.innerHTML = '<option value="">Cargando...</option>';
	departamentoSelect.disabled = true;
	residenteSelect.innerHTML = '<option value="">-- Seleccione un departamento primero --</option>';
	residenteSelect.disabled = true;
	contactoBox.style.display = 'none';
	actualizarPreview();

	if (!torreSelect.value) {
		departamentoSelect.innerHTML = '<option value="">-- Seleccione una torre primero --</option>';
		return;
	}

	try {
		const response = await fetch(`http://localhost:8000/templates/api_departamentos.php?torre_id=${torreSelect.value}`);
		const deptos = await response.json();
		departamentoSelect.innerHTML = '<option value="">Seleccione un departamento</option>';
		deptos.forEach(d => {
			const option = document.createElement('option');
			option.value = d.id;
			option.textContent = d.numero;
			departamentoSelect.appendChild(option);
		})
		departamentoSelect.disabled = false;
	} catch (error) {
		console.error(error);
	}
})

departamentoSelect.addEventListener('change', async () => {
	residenteSelect.innerHTML = '<option value="">Cargando...</option>';
	residenteSelect.disabled = true;
	contactoBox.style.display = 'none';
	actualizarPreview();

	if (!departamentoSelect.value) {
		residenteSelect.innerHTML = '<option value="">-- Seleccione un departamento primero --</option>';
		return;
	}

	try {
		const response = await fetch(`http://localhost:8000/templates/api_residentes_por_departamento.php?departamento_id=${departamentoSelect.value}`);
		residentesCache = await response.json();
		residenteSelect.innerHTML = '<option value="">Seleccione un residente</option>';
		residentesCache.forEach(r => {
			const option = document.createElement('option');
			option.value = r.id;
			option.textContent = r.nombre;
			residenteSelect.appendChild(option);
		})
		residenteSelect.disabled = false;
	} catch (error) {
		console.error(error);
	}
})

residenteSelect.addEventListener('change', () => {
	const residente = residentesCache.find(r => r.id == residenteSelect.value);
	if (residente) {
		document.getElementById('contacto-celular').textContent = residente.celular || 'Sin celular';
		document.getElementById('contacto-celular').href = residente.celular ? `tel:${residente.celular}` : '#';
		document.getElementById('contacto-correo').textContent = residente.correo || 'Sin correo';
		document.getElementById('contacto-correo').href = residente.correo ? `mailto:${residente.correo}` : '#';
		contactoBox.style.display = 'flex';
	} else {
		contactoBox.style.display = 'none';
	}
	actualizarPreview();
})

// ===== VISTA PREVIA =====

function actualizarPreview() {
	document.getElementById('preview-nombre').textContent =
		document.getElementById('nombres_visitante').value || 'Nombre del Visitante';

	const fecha = document.getElementById('fecha_visita').value;
	document.getElementById('preview-fecha').textContent = fecha
		? new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES')
		: '--';

	document.getElementById('preview-hora').textContent = document.getElementById('hora_ingreso').value || '--';
	document.getElementById('preview-tiempo').textContent = document.getElementById('tiempo_estimado').value || '--';

	const numVisitantes = document.getElementById('numero_visitantes').value;
	document.getElementById('preview-numvisitantes').textContent = numVisitantes ? `${numVisitantes} visitante(s)` : '--';

	const torreTexto = torreSelect.options[torreSelect.selectedIndex]?.textContent;
	const deptoTexto = departamentoSelect.options[departamentoSelect.selectedIndex]?.textContent;
	document.getElementById('preview-torredepto').textContent =
		(torreSelect.value && departamentoSelect.value) ? `${torreTexto} - Dpto. ${deptoTexto}` : '--';

	const residenteTexto = residenteSelect.options[residenteSelect.selectedIndex]?.textContent;
	document.getElementById('preview-anfitrion').textContent = residenteSelect.value ? residenteTexto : '--';
}

['nombres_visitante', 'fecha_visita', 'hora_ingreso', 'tiempo_estimado', 'numero_visitantes'].forEach(id => {
	document.getElementById(id).addEventListener('input', actualizarPreview);
	document.getElementById(id).addEventListener('change', actualizarPreview);
})

// ===== CONTADOR DE CARACTERES =====

document.getElementById('observaciones').addEventListener('input', (e) => {
	document.getElementById('observaciones-count').textContent = e.target.value.length;
})

// ===== DOCUMENTO (dropzone) =====

const dropzone = document.getElementById('dropzone-doc');
const fotoInput = document.getElementById('foto_documento');
let fotoDocumentoBase64 = '';

fotoInput.addEventListener('change', () => {
	const file = fotoInput.files[0];
	if (!file) return;
	if (file.size > 2 * 1024 * 1024) {
		alert('El archivo supera los 2MB permitidos');
		fotoInput.value = '';
		return;
	}
	const reader = new FileReader();
	reader.onload = () => {
		fotoDocumentoBase64 = reader.result;
		document.getElementById('doc-nombre-archivo').textContent = `✅ ${file.name}`;
	};
	reader.readAsDataURL(file);
})

dropzone.addEventListener('dragover', (e) => {
	e.preventDefault();
	dropzone.classList.add('dragover');
})
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
	e.preventDefault();
	dropzone.classList.remove('dragover');
	if (e.dataTransfer.files.length > 0) {
		fotoInput.files = e.dataTransfer.files;
		fotoInput.dispatchEvent(new Event('change'));
	}
})

// ===== REGISTROS RECIENTES =====

function badgeVisita(estado) {
	if (estado === 'Permitido') return `<span class="badge-status success">Permitido</span>`;
	if (estado === 'Denegado') return `<span class="badge-status warning">Denegado</span>`;
	return `<span class="badge-status info">Pendiente</span>`;
}

function formatFechaHora(fecha, hora) {
	const d = new Date(fecha + 'T00:00:00');
	const fechaTexto = d.toLocaleDateString('es-ES');
	return `${fechaTexto} - ${hora}`;
}

async function cargarVisitasRecientes() {
	const lista = document.getElementById('lista-visitas-recientes');
	try {
		const response = await fetch('http://localhost:8000/templates/api_visitas_recientes.php');
		const visitas = await response.json();

		if (visitas.length === 0) {
			lista.innerHTML = '<li class="access-item"><p class="table-empty">Sin visitas registradas</p></li>';
			return;
		}

		lista.innerHTML = visitas.map(v => `
			<li class="access-item">
				<div class="access-row">
					<span class="avatar avatar-placeholder"><i class='bx bx-user'></i></span>
					<div class="access-info">
						<p class="access-name">${v.nombres_visitante}</p>
						<span class="access-sub">${formatFechaHora(v.fecha_visita, v.hora_ingreso)}</span>
					</div>
					${badgeVisita(v.estado)}
				</div>
			</li>
		`).join('');
	} catch (error) {
		console.error(error);
		lista.innerHTML = '<li class="access-item"><p class="table-empty">Error al cargar</p></li>';
	}
}
cargarVisitasRecientes();

// ===== ENVÍO DEL FORMULARIO =====

const form = document.getElementById('form-visita');
const mensaje = document.getElementById('mensaje');

document.querySelector('.btn-cancel').addEventListener('click', () => {
	form.reset();
	actualizarPreview();
})

form.addEventListener('submit', async (e) => {
	e.preventDefault();

	const formData = new FormData(form);
	if (fotoDocumentoBase64) {
		formData.set('foto_documento_base64', fotoDocumentoBase64);
	}

	try {
		const response = await fetch('http://localhost:8000/templates/api_visita_registrar.php', {
			method: 'POST',
			body: formData
		});
		const data = await response.json();

		if (data.success) {
			mensaje.innerHTML = `<p class="success">✅ Visita registrada. Queda pendiente de autorización en el Panel de Control.</p>`;
			form.reset();
			departamentoSelect.innerHTML = '<option value="">-- Seleccione una torre primero --</option>';
			departamentoSelect.disabled = true;
			residenteSelect.innerHTML = '<option value="">-- Seleccione un departamento primero --</option>';
			residenteSelect.disabled = true;
			contactoBox.style.display = 'none';
			fotoDocumentoBase64 = '';
			document.getElementById('doc-nombre-archivo').textContent = '';
			document.getElementById('observaciones-count').textContent = '0';
			actualizarPreview();
			cargarVisitasRecientes();
		} else {
			mensaje.innerHTML = `<p class="error">❌ ${data.message}</p>`;
		}
	} catch (error) {
		console.error(error);
		mensaje.innerHTML = '<p class="error">❌ Error de conexión con la API.</p>';
	}
})

actualizarPreview();
