let paginaActual = 1;
let totalPaginas = 1;
let incidenciasCache = [];
let incidenciaAbierta = null;

const modalIncidencia = document.getElementById('modal-incidencia');

function valorDe(id) {
	const el = document.getElementById(id);
	return el ? el.value : '';
}

function formatFechaHora(fechaStr) {
	const d = new Date(fechaStr.replace(' ', 'T'));
	return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function badgeEstado(estado) {
	return estado === 'Revisado'
		? `<span class="badge-status success">Revisado</span>`
		: `<span class="badge-status warning">Pendiente</span>`;
}

function construirQuery(page) {
	const params = new URLSearchParams();
	if (valorDe('f-estado')) params.set('estado', valorDe('f-estado'));
	if (valorDe('f-fecha-desde')) params.set('fecha_desde', valorDe('f-fecha-desde'));
	if (valorDe('f-fecha-hasta')) params.set('fecha_hasta', valorDe('f-fecha-hasta'));
	params.set('page', page);
	params.set('per_page', valorDe('per-page') || 12);
	return params.toString();
}

function renderGrid(filas) {
	const grid = document.getElementById('incidencias-grid');

	if (filas.length === 0) {
		const hayFiltros = valorDe('f-estado') || valorDe('f-fecha-desde') || valorDe('f-fecha-hasta');
		grid.innerHTML = `
			<div class="table-empty incidencias-vacio">
				<i class='bx bx-search-alt'></i>
				<strong>No se encontraron datos registrados</strong>
				<span>${hayFiltros ? 'Prueba cambiando o limpiando los filtros.' : 'Aún no hay intentos de acceso no reconocidos.'}</span>
			</div>`;
		return;
	}

	grid.innerHTML = filas.map(i => `
		<button type="button" class="incidencia-card" data-id="${esc(i.id)}">
			${i.foto_path
				? `<img src="/${esc(i.foto_path)}" alt="Foto del intento" loading="lazy">`
				: `<span class="incidencia-sin-foto"><i class='bx bx-image'></i></span>`}
			<div class="incidencia-card-body">
				<span class="incidencia-card-fecha">${formatFechaHora(i.fecha_hora)}</span>
				${badgeEstado(i.estado)}
				${i.nota ? `<p class="incidencia-card-nota">${esc(i.nota)}</p>` : ''}
			</div>
		</button>
	`).join('');
}

function renderPaginacion(total, page, perPage) {
	totalPaginas = Math.max(1, Math.ceil(total / perPage));
	paginaActual = page;

	const desde = total === 0 ? 0 : (page - 1) * perPage + 1;
	const hasta = Math.min(page * perPage, total);
	document.getElementById('paginacion-info').textContent = `Mostrando ${desde} a ${hasta} de ${total} incidencias`;
	document.getElementById('paginas').textContent = `${page} / ${totalPaginas}`;

	document.getElementById('btn-prev').disabled = page <= 1;
	document.getElementById('btn-next').disabled = page >= totalPaginas;
}

async function cargarIncidencias(page = 1) {
	const grid = document.getElementById('incidencias-grid');
	grid.innerHTML = '<p class="table-empty">Cargando...</p>';

	try {
		const response = await fetch(`/api/api_incidencias_lista.php?${construirQuery(page)}`);
		const result = await response.json();

		incidenciasCache = result.data;
		renderGrid(result.data);
		renderPaginacion(result.total, result.page, result.per_page);
		document.getElementById('contador-pendientes').textContent =
			`${result.pendientes} pendiente${result.pendientes === 1 ? '' : 's'}`;
	} catch (error) {
		console.error(error);
		grid.innerHTML = '<p class="table-empty">Error al cargar las incidencias</p>';
	}
}

document.getElementById('btn-buscar').addEventListener('click', () => cargarIncidencias(1));
document.getElementById('per-page').addEventListener('change', () => cargarIncidencias(1));
document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
	['f-estado', 'f-fecha-desde', 'f-fecha-hasta'].forEach(id => document.getElementById(id).value = '');
	cargarIncidencias(1);
})
document.getElementById('btn-prev').addEventListener('click', () => {
	if (paginaActual > 1) cargarIncidencias(paginaActual - 1);
})
document.getElementById('btn-next').addEventListener('click', () => {
	if (paginaActual < totalPaginas) cargarIncidencias(paginaActual + 1);
})

// ===== MODAL REVISAR =====

function mostrarMensajeModal(texto, tipo) {
	document.getElementById('modal-incidencia-mensaje').innerHTML =
		`<p class="${tipo}">${tipo === 'error' ? '❌' : '✅'} ${esc(texto)}</p>`;
}

function abrirModalIncidencia(i) {
	incidenciaAbierta = i;
	document.getElementById('modal-incidencia-mensaje').innerHTML = '';
	const foto = document.getElementById('incidencia-foto');
	foto.style.display = i.foto_path ? '' : 'none';
	if (i.foto_path) foto.src = '/' + i.foto_path;
	document.getElementById('incidencia-fecha').textContent = formatFechaHora(i.fecha_hora);
	document.getElementById('incidencia-estado').innerHTML = badgeEstado(i.estado);
	document.getElementById('incidencia-nota').value = i.nota || '';

	const revisado = i.estado === 'Revisado';
	document.getElementById('incidencia-revision-wrap').style.display = revisado ? '' : 'none';
	document.getElementById('incidencia-revision').textContent = revisado
		? `${i.revisado_por || '--'} · ${i.fecha_revision ? formatFechaHora(i.fecha_revision) : ''}`
		: '';
	document.getElementById('btn-incidencia-pendiente').style.display = revisado ? '' : 'none';
	document.getElementById('btn-incidencia-revisado').innerHTML = revisado
		? "<i class='bx bx-save'></i> Guardar nota"
		: "<i class='bx bx-check'></i> Marcar como revisado";

	modalIncidencia.classList.add('activo');
}

function cerrarModalIncidencia() {
	incidenciaAbierta = null;
	modalIncidencia.classList.remove('activo');
}

async function guardarRevision(estado) {
	if (!incidenciaAbierta) return;
	try {
		const formData = new FormData();
		formData.set('id', incidenciaAbierta.id);
		formData.set('estado', estado);
		formData.set('nota', document.getElementById('incidencia-nota').value);
		const response = await fetch('/api/api_incidencia_revisar.php', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.success) {
			cerrarModalIncidencia();
			cargarIncidencias(paginaActual);
		} else {
			mostrarMensajeModal(result.message || 'No se pudo guardar la revisión', 'error');
		}
	} catch (error) {
		console.error(error);
		mostrarMensajeModal('Error al guardar la revisión', 'error');
	}
}

document.getElementById('incidencias-grid').addEventListener('click', (e) => {
	const card = e.target.closest('.incidencia-card');
	if (!card) return;
	const i = incidenciasCache.find(x => String(x.id) === card.dataset.id);
	if (i) abrirModalIncidencia(i);
})

document.getElementById('btn-incidencia-revisado').addEventListener('click', () => guardarRevision('Revisado'));
document.getElementById('btn-incidencia-pendiente').addEventListener('click', () => guardarRevision('Pendiente'));
document.getElementById('btn-cerrar-incidencia').addEventListener('click', cerrarModalIncidencia);
modalIncidencia.addEventListener('click', (e) => {
	if (e.target === modalIncidencia) cerrarModalIncidencia();
})

// ===== CARGA INICIAL =====
// Desde el panel de control se llega con ?id=N para abrir esa incidencia directo.

async function cargaInicial() {
	const idInicial = new URLSearchParams(window.location.search).get('id');
	await cargarIncidencias(1);
	if (!idInicial) return;

	try {
		const response = await fetch(`/api/api_incidencias_lista.php?id=${encodeURIComponent(idInicial)}`);
		const result = await response.json();
		if (result.data.length) abrirModalIncidencia(result.data[0]);
	} catch (error) {
		console.error(error);
	}
}
cargaInicial();
