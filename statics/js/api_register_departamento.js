const form = document.getElementById('form-departamento');
let torres = [];

// CHAR COUNTERS
function bindCounter(textareaId, counterId) {
	const textarea = document.getElementById(textareaId);
	const counter = document.getElementById(counterId);
	textarea.addEventListener('input', () => {
		counter.textContent = textarea.value.length;
	})
}
bindCounter('observaciones', 'observaciones-count');
bindCounter('notas_internas', 'notas_internas-count');

// FECHA DE REGISTRO (hoy, solo informativa)
document.getElementById('fecha_registro').value = new Date().toLocaleDateString('es-ES', {
	day: '2-digit', month: '2-digit', year: 'numeric'
});

// TORRES
const torreSelect      = document.getElementById('torre_id');
const capacidadAviso    = document.getElementById('capacidad-aviso');
const btnGuardar        = document.getElementById('btn-guardar-departamento');
const pisoInput         = document.getElementById('piso');
const numeroInput       = document.getElementById('numero');

async function cargarTorres() {
	try {
		const response = await fetch('http://localhost:8000/templates/api_torres.php');
		torres = await response.json();

		torreSelect.innerHTML = '<option value="">-- Seleccione --</option>';
		torres.forEach(torre => {
			const option = document.createElement('option');
			option.value = torre.id;
			option.textContent = torre.nombre;
			torreSelect.appendChild(option);
		})
	} catch (error) {
		console.error(error);
		torreSelect.innerHTML = '<option value="">Error al cargar</option>';
	}
}
cargarTorres();

async function validarCapacidad() {
	const torreId = torreSelect.value;
	capacidadAviso.innerHTML = '';
	btnGuardar.disabled = false;

	if (!torreId) return;

	const torre = torres.find(t => String(t.id) === torreId);
	if (!torre) return;

	if (torre.numero_pisos) {
		pisoInput.max = torre.numero_pisos;
	}

	if (!torre.numero_departamentos) return;

	try {
		const response = await fetch(`http://localhost:8000/templates/api_departamentos.php?torre_id=${torreId}`);
		const deptos = await response.json();
		const actual = deptos.length;
		const max = parseInt(torre.numero_departamentos);

		if (actual >= max) {
			capacidadAviso.innerHTML = `<p class="error">⚠️ La ${torre.nombre} ya alcanzó su capacidad máxima (${actual}/${max} departamentos). No se pueden registrar más.</p>`;
			btnGuardar.disabled = true;
		} else {
			capacidadAviso.innerHTML = `<p class="success">${torre.nombre}: ${actual}/${max} departamentos registrados.</p>`;
		}
	} catch (error) {
		console.error(error);
	}
}
torreSelect.addEventListener('change', () => { validarCapacidad(); actualizarPreview(); })

pisoInput.addEventListener('input', () => {
	const torreId = torreSelect.value;
	const torre = torres.find(t => String(t.id) === torreId);
	if (torre && torre.numero_pisos && parseInt(pisoInput.value) > parseInt(torre.numero_pisos)) {
		pisoInput.setCustomValidity(`El piso no puede superar ${torre.numero_pisos} (máximo de la torre)`);
	} else {
		pisoInput.setCustomValidity('');
	}
})

// PROPIETARIOS
async function cargarPropietarios() {
	const select = document.getElementById('propietario_id');
	try {
		const response = await fetch('http://localhost:8000/templates/api_residentes.php');
		const result = await response.json();

		select.innerHTML = '<option value="">-- Sin asignar --</option>';
		result.forEach(r => {
			const option = document.createElement('option');
			option.value = r.id;
			option.textContent = r.nombre;
			select.appendChild(option);
		})
	} catch (error) {
		console.error(error);
		select.innerHTML = '<option value="">Error al cargar</option>';
	}
}
cargarPropietarios();

// VISTA PREVIA / RESUMEN
const tipoSelect   = document.getElementById('tipo');
const estadoSelect = document.getElementById('estado');
const areaInput    = document.getElementById('area');
const habInput     = document.getElementById('habitaciones');
const banosInput   = document.getElementById('banos');
const estacInput   = document.getElementById('estacionamiento');
const propietarioSelect = document.getElementById('propietario_id');

function actualizarPreview() {
	const torreId = torreSelect.value;
	const torre = torres.find(t => String(t.id) === torreId);
	const torreNombre = torre ? torre.nombre : 'Torre';
	const piso = pisoInput.value || '--';
	const numero = numeroInput.value.trim();
	const tipo = tipoSelect.value;
	const estado = estadoSelect.value;
	const propietarioTexto = propietarioSelect.options[propietarioSelect.selectedIndex]?.textContent || '--';

	document.getElementById('preview-titulo').textContent = `${torreNombre} - Piso ${piso}`;
	document.getElementById('preview-numero').textContent = numero || '--';
	document.getElementById('preview-tipo').textContent = tipo;
	document.getElementById('preview-estado').textContent = estado;
	document.getElementById('preview-estado').className = 'torre-preview-estado badge-status ' + (estado === 'Activo' ? 'success' : estado === 'Mantenimiento' ? 'warning' : 'info');

	document.getElementById('resumen-torre').textContent = torreNombre;
	document.getElementById('resumen-piso').textContent = piso;
	document.getElementById('resumen-area-hab').textContent = `${areaInput.value || '--'} m² / ${habInput.value || '--'}`;
	document.getElementById('resumen-banos').textContent = banosInput.value || '--';
	document.getElementById('resumen-estacionamiento').textContent = estacInput.value || '--';
	document.getElementById('resumen-propietario').textContent = propietarioTexto === '-- Sin asignar --' ? '--' : propietarioTexto;
	document.getElementById('resumen-estado').textContent = estado;
	document.getElementById('resumen-estado').className = 'badge-status ' + (estado === 'Activo' ? 'success' : estado === 'Mantenimiento' ? 'warning' : 'info');

	const codigoTorre = torre ? (torre.codigo || torre.id) : '';
	document.getElementById('codigo_interno').value = (codigoTorre && numero) ? `DEP-${codigoTorre}-${numero}` : '';
}

[numeroInput, pisoInput, tipoSelect, estadoSelect, areaInput, habInput, banosInput, estacInput, propietarioSelect].forEach(el => {
	el.addEventListener('input', actualizarPreview);
	el.addEventListener('change', actualizarPreview);
})
actualizarPreview();

// SUBMIT
form.addEventListener('submit', async (e) => {
	e.preventDefault();

	const mensaje = document.getElementById('mensaje');
	const formData = new FormData(form);

	try {
		const response = await fetch(
			'http://localhost:8000/templates/api_register_departamento.php',
			{ method: 'POST', body: formData }
		);
		const data = await response.json();

		if (data.success) {
			mensaje.innerHTML = `<p class="success">✅ Departamento registrado correctamente (${data.codigo_interno}).</p>`;
			form.reset();
			document.getElementById('observaciones-count').textContent = '0';
			document.getElementById('notas_internas-count').textContent = '0';
			document.getElementById('fecha_registro').value = new Date().toLocaleDateString('es-ES', {
				day: '2-digit', month: '2-digit', year: 'numeric'
			});
			capacidadAviso.innerHTML = '';
			actualizarPreview();
		} else {
			mensaje.innerHTML = `<p class="error">❌ ${data.message}</p>`;
		}
	} catch (error) {
		console.error(error);
		document.getElementById('mensaje').innerHTML = '<p class="error">❌ Error de conexión con la API.</p>';
	}
})
