// ===== ESTADO GLOBAL =====
let torresCache = [];
let torreSeleccionada = null;        // id de la torre activa
let pisoSeleccionado = null;         // número de piso activo (int)
let departamentoSeleccionado = null; // id del departamento activo
let departamentosPiso = [];          // filas de la torre activa (todos los pisos)
let conteoPorTorre = {};             // { nombreTorre: cantidadRealDeDepartamentos }

const torreSelect = document.getElementById('f-torre');
const pisoSelect = document.getElementById('f-piso');

function valorDe(id) {
	const el = document.getElementById(id);
	return el ? el.value : '';
}

function badgeEstado(estado) {
	const clase = estado === 'Activo' ? 'success' : estado === 'Mantenimiento' ? 'warning' : 'danger';
	return `<span class="badge-status ${clase}">${estado}</span>`;
}

function claseEstado(estado) {
	return estado === 'Activo' ? 'success' : estado === 'Mantenimiento' ? 'warning' : 'danger';
}

// ===== CARGA DE TORRES =====

async function cargarTorres() {
	try {
		const response = await fetch('http://localhost:8000/templates/api_torres.php');
		torresCache = await response.json();
		torreSelect.innerHTML = '<option value="">Todos</option>';
		torresCache.forEach(t => {
			const option = document.createElement('option');
			option.value = t.id;
			option.textContent = t.nombre;
			torreSelect.appendChild(option);
		})
	} catch (error) {
		console.error(error);
	}
}

async function cargarConteoPorTorre() {
	try {
		const response = await fetch('http://localhost:8000/templates/api_departamentos_lista.php?per_page=100');
		const result = await response.json();
		conteoPorTorre = {};
		result.data.forEach(d => {
			conteoPorTorre[d.torre_nombre] = (conteoPorTorre[d.torre_nombre] || 0) + 1;
		})
	} catch (error) {
		console.error(error);
	}
}

function renderTorreTabs() {
	const cont = document.getElementById('torre-tabs');

	if (torresCache.length === 0) {
		cont.innerHTML = '<p class="table-empty">No hay torres registradas</p>';
		return;
	}

	cont.innerHTML = torresCache.map(t => `
		<button type="button" class="torre-tab-card${String(t.id) === String(torreSeleccionada) ? ' activo' : ''}" data-id="${t.id}">
			<span class="torre-tab-icon"><i class='bx bxs-buildings'></i></span>
			<div>
				<strong>${t.nombre}</strong>
				<span>${conteoPorTorre[t.nombre] ?? 0} departamentos</span>
			</div>
		</button>
	`).join('');
}

document.getElementById('torre-tabs').addEventListener('click', (e) => {
	const btn = e.target.closest('.torre-tab-card');
	if (!btn) return;
	if (String(btn.dataset.id) === String(torreSeleccionada)) return;

	torreSeleccionada = btn.dataset.id;
	torreSelect.value = torreSeleccionada;
	pisoSeleccionado = null;
	cargarDepartamentos();
})

// ===== FILTROS =====

function construirQuery() {
	const params = new URLSearchParams();
	if (torreSeleccionada) params.set('torre_id', torreSeleccionada);
	if (valorDe('f-estado')) params.set('estado', valorDe('f-estado'));
	if (valorDe('f-tipo')) params.set('tipo', valorDe('f-tipo'));
	if (valorDe('f-fecha-desde')) params.set('fecha_desde', valorDe('f-fecha-desde'));
	if (valorDe('f-fecha-hasta')) params.set('fecha_hasta', valorDe('f-fecha-hasta'));
	if (valorDe('f-buscar')) params.set('buscar', valorDe('f-buscar'));
	params.set('page', 1);
	params.set('per_page', 100);
	return params.toString();
}

function aplicarFiltros() {
	torreSeleccionada = torreSelect.value || (torresCache[0] && torresCache[0].id) || null;
	torreSelect.value = torreSeleccionada || '';
	if (valorDe('f-piso')) {
		pisoSeleccionado = parseInt(valorDe('f-piso'), 10);
	}
	cargarDepartamentos();
}

document.getElementById('btn-buscar').addEventListener('click', aplicarFiltros);
document.getElementById('f-buscar').addEventListener('keyup', (e) => {
	if (e.key === 'Enter') aplicarFiltros();
})

document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
	const ids = ['f-estado', 'f-tipo', 'f-fecha-desde', 'f-fecha-hasta', 'f-buscar'];
	ids.forEach(id => {
		const el = document.getElementById(id);
		if (el) el.value = '';
	})
	pisoSeleccionado = null;
	cargarDepartamentos();
})

// ===== PISOS =====

function agruparPorPiso(filas) {
	const mapa = new Map();
	filas.forEach(d => {
		const piso = Number(d.piso);
		if (!mapa.has(piso)) mapa.set(piso, []);
		mapa.get(piso).push(d);
	})
	return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
}

function renderPisoList() {
	const cont = document.getElementById('piso-list');
	const grupos = agruparPorPiso(departamentosPiso);

	if (grupos.length === 0) {
		cont.innerHTML = '<li class="table-empty">Sin departamentos registrados</li>';
		pisoSelect.innerHTML = '<option value="">Todos</option>';
		pisoSeleccionado = null;
		return;
	}

	if (pisoSeleccionado === null || !grupos.some(([p]) => p === pisoSeleccionado)) {
		pisoSeleccionado = grupos[0][0];
	}

	cont.innerHTML = grupos.map(([piso, filas]) => `
		<li class="piso-item${piso === pisoSeleccionado ? ' activo' : ''}" data-piso="${piso}">
			<span>Piso ${piso}</span>
			<span class="count">${filas.length} depto${filas.length === 1 ? '' : 's'}</span>
		</li>
	`).join('');

	pisoSelect.innerHTML = '<option value="">Todos</option>' + grupos.map(([piso]) =>
		`<option value="${piso}">Piso ${piso}</option>`
	).join('');
	pisoSelect.value = pisoSeleccionado;

	const torre = torresCache.find(t => String(t.id) === String(torreSeleccionada));
	document.getElementById('piso-panel-titulo').textContent = torre ? `Pisos - ${torre.nombre}` : 'Pisos';
}

document.getElementById('piso-list').addEventListener('click', (e) => {
	const item = e.target.closest('.piso-item');
	if (!item || !item.dataset.piso) return;

	pisoSeleccionado = parseInt(item.dataset.piso, 10);
	pisoSelect.value = pisoSeleccionado;
	renderPisoList();
	renderGrid();
})

// ===== GRILLA DE DEPARTAMENTOS =====

function renderGrid() {
	const cont = document.getElementById('departamento-grid');
	const filas = departamentosPiso.filter(d => Number(d.piso) === pisoSeleccionado);

	if (filas.length === 0) {
		cont.innerHTML = '<p class="table-empty">No hay departamentos en este piso</p>';
	} else {
		cont.innerHTML = filas.map(d => `
			<div class="departamento-card${String(d.id) === String(departamentoSeleccionado) ? ' activo' : ''}" data-id="${d.id}">
				<div class="departamento-card-head">
					<span class="departamento-card-icon"><i class='bx bxs-buildings'></i></span>
					<span class="departamento-card-numero">${d.numero}</span>
					${badgeEstado(d.estado)}
				</div>
				<p class="departamento-card-area">${d.area ? parseFloat(d.area).toFixed(2) + ' m²' : 'Área no registrada'}</p>
				<div class="departamento-card-meta">
					<span><i class='bx bx-bed'></i> ${d.habitaciones ?? '-'}</span>
					<span><i class='bx bx-bath'></i> ${d.banos ?? '-'}</span>
					<span><i class='bx bx-car'></i> ${d.estacionamiento ? '1' : '0'}</span>
				</div>
			</div>
		`).join('');
	}

	document.getElementById('cards-panel-titulo').textContent = pisoSeleccionado !== null ? `Piso ${pisoSeleccionado}` : 'Departamentos';
	document.getElementById('departamento-grid-count').textContent = `${filas.length} departamento${filas.length === 1 ? '' : 's'} en este piso`;
}

document.getElementById('departamento-grid').addEventListener('click', (e) => {
	const card = e.target.closest('.departamento-card');
	if (!card) return;
	seleccionarDepartamento(card.dataset.id);
})

// ===== CARGA PRINCIPAL =====

async function cargarDepartamentos() {
	document.getElementById('piso-list').innerHTML = skeletonListaItems('piso-item', 4);
	document.getElementById('departamento-grid').innerHTML = skeletonDepartamentoCards(4);

	try {
		const query = construirQuery();
		const response = await fetch(`http://localhost:8000/templates/api_departamentos_lista.php?${query}`);
		const result = await response.json();

		departamentosPiso = result.data;

		if (departamentoSeleccionado && !departamentosPiso.some(d => String(d.id) === String(departamentoSeleccionado))) {
			departamentoSeleccionado = null;
			document.getElementById('detail-panel-empty').style.display = 'block';
			document.getElementById('detail-panel-body').style.display = 'none';
		}

		await cargarConteoPorTorre();
		renderTorreTabs();
		renderPisoList();
		renderGrid();
	} catch (error) {
		console.error(error);
		document.getElementById('piso-list').innerHTML = '<li class="table-empty">Error al cargar</li>';
		document.getElementById('departamento-grid').innerHTML = '<p class="table-empty">Error al cargar los departamentos</p>';
	}
}

async function iniciar() {
	await cargarTorres();
	if (torresCache.length > 0) {
		torreSeleccionada = torresCache[0].id;
		torreSelect.value = torreSeleccionada;
	}
	await cargarDepartamentos();
}
iniciar();

// ===== PANEL DE DETALLE =====

function mostrarDetallePanelCargando() {
	document.getElementById('detail-panel-empty').style.display = 'none';
	document.getElementById('detail-panel-body').style.display = 'block';
	document.getElementById('detalle-numero').textContent = '...';
	document.getElementById('detalle-residentes-lista').innerHTML = skeletonListaItems('mini-lista-item', 3);
}

function limpiarDetalle() {
	departamentoSeleccionado = null;
	document.getElementById('detail-panel-empty').style.display = 'block';
	document.getElementById('detail-panel-body').style.display = 'none';
	renderGrid();
}

function renderDetalle(d, residentes) {
	document.getElementById('detalle-numero').textContent = d.numero;

	const badge = document.getElementById('detalle-estado-badge');
	badge.className = 'badge-status ' + claseEstado(d.estado);
	badge.textContent = d.estado;

	const torre = torresCache.find(t => String(t.id) === String(d.torre_id));
	document.getElementById('detalle-torre').textContent = torre ? torre.nombre : '--';
	document.getElementById('detalle-piso').textContent = d.piso;
	document.getElementById('detalle-area').textContent = d.area ? `${parseFloat(d.area).toFixed(2)} m²` : '--';
	document.getElementById('detalle-habitaciones').textContent = d.habitaciones ?? '--';
	document.getElementById('detalle-banos').textContent = d.banos ?? '--';
	document.getElementById('detalle-estacionamiento').textContent = d.estacionamiento || 'Sin asignar';
	document.getElementById('detalle-tipo').textContent = d.tipo || '--';

	const tieneDueno = !!d.propietario_id;
	document.getElementById('detalle-prop-nombre').textContent = tieneDueno ? d.propietario_nombre : 'Sin propietario asignado';
	document.getElementById('detalle-prop-dni').textContent = tieneDueno ? (d.propietario_dni || '--') : '--';
	document.getElementById('detalle-prop-celular').textContent = tieneDueno ? (d.propietario_celular || '--') : '--';
	document.getElementById('detalle-prop-correo').textContent = tieneDueno ? (d.propietario_correo || '--') : '--';

	document.getElementById('tab-residentes-count').textContent = `(${residentes.length})`;
	document.getElementById('chk-residentes-n').textContent = residentes.length;

	const listaResidentes = document.getElementById('detalle-residentes-lista');
	if (residentes.length === 0) {
		listaResidentes.innerHTML = '<li class="table-empty">Sin residentes registrados</li>';
	} else {
		listaResidentes.innerHTML = residentes.map(r => `
			<li>
				<i class='bx bxs-user-circle'></i>
				<div>
					<strong>${r.nombre} <em class="badge-status ${r.tipo_relacion === 'Titular' ? 'success' : 'info'}">${r.tipo_relacion === 'Titular' ? 'Propietario' : r.tipo_nombre}</em></strong>
					<span>${r.celular || '--'} · ${r.correo || '--'}</span>
				</div>
			</li>
		`).join('');
	}

	const checks = {
		propietario: tieneDueno,
		residentes: residentes.length > 0,
		estacionamiento: !!(d.estacionamiento && d.estacionamiento.trim()),
		contacto: !!(d.telefono_contacto && d.telefono_contacto.trim()),
	};
	document.querySelectorAll('#checklist li').forEach(li => {
		li.classList.toggle('incompleto', !checks[li.dataset.check]);
	})

	const completo = Object.values(checks).every(Boolean);
	const badgeChecklist = document.getElementById('checklist-badge');
	badgeChecklist.textContent = completo ? 'Completo' : 'Incompleto';
	badgeChecklist.className = 'badge-status checklist-badge ' + (completo ? 'success' : 'warning');
}

async function seleccionarDepartamento(id) {
	departamentoSeleccionado = id;
	renderGrid();
	mostrarDetallePanelCargando();

	try {
		const [detalleRes, residentesRes] = await Promise.all([
			fetch(`http://localhost:8000/templates/api_departamento_detalle.php?id=${id}`),
			fetch(`http://localhost:8000/templates/api_residentes_por_departamento.php?departamento_id=${id}`),
		]);
		const detalle = await detalleRes.json();
		const residentes = await residentesRes.json();

		if (!detalle.success) {
			limpiarDetalle();
			return;
		}

		renderDetalle(detalle.departamento, residentes);
	} catch (error) {
		console.error(error);
		limpiarDetalle();
	}
}

document.querySelectorAll('.detail-tab').forEach(btn => {
	btn.addEventListener('click', () => {
		document.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('activo'));
		btn.classList.add('activo');
		document.querySelectorAll('.detail-tab-panel').forEach(panel => {
			panel.style.display = panel.dataset.tabPanel === btn.dataset.tab ? 'block' : 'none';
		})
	})
})

document.getElementById('btn-detalle-editar').addEventListener('click', () => {
	if (departamentoSeleccionado) abrirModalEditar(departamentoSeleccionado);
})

document.getElementById('btn-detalle-eliminar').addEventListener('click', () => {
	if (!departamentoSeleccionado) return;
	const d = departamentosPiso.find(x => String(x.id) === String(departamentoSeleccionado));
	abrirModalEliminar(departamentoSeleccionado, d ? d.numero : '');
})

// ===== MODAL EDITAR =====

const modalEditar = document.getElementById('modal-editar');
const formEditar = document.getElementById('form-editar-departamento');
const editTorreSelect = document.getElementById('edit-torre_id');
const editPropietarioSelect = document.getElementById('edit-propietario_id');

async function cargarTorresEnModal() {
	if (editTorreSelect.dataset.cargado) return;
	try {
		const response = await fetch('http://localhost:8000/templates/api_torres.php');
		const torres = await response.json();
		editTorreSelect.innerHTML = '';
		torres.forEach(t => {
			const option = document.createElement('option');
			option.value = t.id;
			option.textContent = t.nombre;
			editTorreSelect.appendChild(option);
		})
		editTorreSelect.dataset.cargado = '1';
	} catch (error) {
		console.error(error);
	}
}

async function cargarPropietariosEnModal() {
	if (editPropietarioSelect.dataset.cargado) return;
	try {
		const response = await fetch('http://localhost:8000/templates/api_residentes.php');
		const residentes = await response.json();
		editPropietarioSelect.innerHTML = '<option value="">Sin asignar</option>';
		residentes.forEach(r => {
			const option = document.createElement('option');
			option.value = r.id;
			option.textContent = r.nombre;
			editPropietarioSelect.appendChild(option);
		})
		editPropietarioSelect.dataset.cargado = '1';
	} catch (error) {
		console.error(error);
	}
}

function mostrarMensajeModal(texto, tipo) {
	const el = document.getElementById('modal-editar-mensaje');
	el.innerHTML = `<p class="${tipo}">${tipo === 'error' ? '❌' : '✅'} ${texto}</p>`;
}

function cerrarModalEditar() {
	modalEditar.classList.remove('activo');
	formEditar.reset();
	document.getElementById('modal-editar-mensaje').innerHTML = '';
}

async function abrirModalEditar(id) {
	await Promise.all([cargarTorresEnModal(), cargarPropietariosEnModal()]);

	try {
		const response = await fetch(`http://localhost:8000/templates/api_departamento_detalle.php?id=${id}`);
		const result = await response.json();

		if (!result.success) {
			alert(result.message || 'No se pudo cargar el departamento');
			return;
		}

		const d = result.departamento;
		document.getElementById('edit-id').value = d.id;
		editTorreSelect.value = d.torre_id;
		document.getElementById('edit-numero').value = d.numero;
		document.getElementById('edit-tipo').value = d.tipo || 'Departamento';
		document.getElementById('edit-piso').value = d.piso;
		document.getElementById('edit-area').value = d.area ?? '';
		document.getElementById('edit-habitaciones').value = d.habitaciones ?? '';
		document.getElementById('edit-banos').value = d.banos ?? '';
		document.getElementById('edit-estacionamiento').value = d.estacionamiento ?? '';
		editPropietarioSelect.value = d.propietario_id ?? '';
		document.getElementById('edit-telefono_contacto').value = d.telefono_contacto ?? '';
		document.getElementById('edit-estado').value = d.estado;
		document.getElementById('edit-observaciones').value = d.observaciones ?? '';
		document.getElementById('edit-notas_internas').value = d.notas_internas ?? '';

		modalEditar.classList.add('activo');
	} catch (error) {
		console.error(error);
		alert('Error al cargar el departamento');
	}
}

document.getElementById('btn-cancelar-editar').addEventListener('click', cerrarModalEditar);
modalEditar.addEventListener('click', (e) => {
	if (e.target === modalEditar) cerrarModalEditar();
})

formEditar.addEventListener('submit', async (e) => {
	e.preventDefault();
	try {
		const formData = new FormData(formEditar);
		const idEditado = document.getElementById('edit-id').value;
		const response = await fetch('http://localhost:8000/templates/api_departamento_editar.php', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		if (result.success) {
			cerrarModalEditar();
			await cargarDepartamentos();
			if (String(idEditado) === String(departamentoSeleccionado)) {
				seleccionarDepartamento(idEditado);
			}
		} else {
			mostrarMensajeModal(result.message || 'No se pudo actualizar el departamento', 'error');
		}
	} catch (error) {
		console.error(error);
		mostrarMensajeModal('Error al actualizar el departamento', 'error');
	}
})

// ===== MODAL ELIMINAR =====

const modalEliminar = document.getElementById('modal-eliminar');
let idAEliminar = null;

function abrirModalEliminar(id, numero) {
	idAEliminar = id;
	document.getElementById('eliminar-numero').textContent = numero;
	modalEliminar.classList.add('activo');
}

function cerrarModalEliminar() {
	idAEliminar = null;
	modalEliminar.classList.remove('activo');
}

document.getElementById('btn-cancelar-eliminar').addEventListener('click', cerrarModalEliminar);
modalEliminar.addEventListener('click', (e) => {
	if (e.target === modalEliminar) cerrarModalEliminar();
})

document.getElementById('btn-confirmar-eliminar').addEventListener('click', async () => {
	if (!idAEliminar) return;

	try {
		const formData = new FormData();
		formData.set('id', idAEliminar);
		const response = await fetch('http://localhost:8000/templates/api_departamento_eliminar.php', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		const eraElSeleccionado = String(idAEliminar) === String(departamentoSeleccionado);
		cerrarModalEliminar();

		if (result.success) {
			if (eraElSeleccionado) limpiarDetalle();
			cargarDepartamentos();
		} else {
			alert(result.message || 'No se pudo eliminar el departamento');
		}
	} catch (error) {
		console.error(error);
		cerrarModalEliminar();
		alert('Error al eliminar el departamento');
	}
})

// ===== EXPORTAR A EXCEL =====

document.getElementById('btn-exportar').addEventListener('click', () => {
	const params = new URLSearchParams();
	if (torreSelect.value) params.set('torre_id', torreSelect.value);
	if (pisoSelect.value) params.set('piso', pisoSelect.value);
	if (valorDe('f-estado')) params.set('estado', valorDe('f-estado'));
	if (valorDe('f-tipo')) params.set('tipo', valorDe('f-tipo'));
	if (valorDe('f-fecha-desde')) params.set('fecha_desde', valorDe('f-fecha-desde'));
	if (valorDe('f-fecha-hasta')) params.set('fecha_hasta', valorDe('f-fecha-hasta'));
	if (valorDe('f-buscar')) params.set('buscar', valorDe('f-buscar'));

	window.location.href = `http://localhost:8000/templates/api_departamentos_exportar.php?${params.toString()}`;
})
