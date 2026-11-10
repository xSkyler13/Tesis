let paginaActual = 1;
let totalPaginas = 1;

function valorDe(id) {
	const el = document.getElementById(id);
	return el ? el.value : '';
}

function formatFechaHora(fechaStr) {
	const d = new Date(fechaStr.replace(' ', 'T'));
	return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Acciones delicadas resaltadas
function badgeAccion(accion) {
	const clase = ['eliminar', 'baja', 'login_fallido', 'desactivar'].includes(accion) ? 'danger'
		: ['exportar', 'editar'].includes(accion) ? 'warning'
		: ['crear', 'login'].includes(accion) ? 'success' : 'info';
	return `<span class="badge-status ${clase}">${esc(accion)}</span>`;
}

function llenarSelect(id, valores) {
	const select = document.getElementById(id);
	const actual = select.value;
	select.innerHTML = '<option value="">Todas</option>';
	valores.forEach(v => {
		const option = document.createElement('option');
		option.value = v;
		option.textContent = v;
		select.appendChild(option);
	})
	select.value = actual;
}

function construirQuery(page) {
	const params = new URLSearchParams();
	['usuario', 'accion', 'entidad'].forEach(k => {
		if (valorDe(`f-${k}`)) params.set(k, valorDe(`f-${k}`));
	})
	if (valorDe('f-fecha-desde')) params.set('fecha_desde', valorDe('f-fecha-desde'));
	if (valorDe('f-fecha-hasta')) params.set('fecha_hasta', valorDe('f-fecha-hasta'));
	params.set('page', page);
	params.set('per_page', valorDe('per-page') || 25);
	return params.toString();
}

function renderTabla(filas) {
	const tbody = document.getElementById('tabla-auditoria');
	if (filas.length === 0) {
		tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No se encontraron registros con esos filtros</td></tr>';
		return;
	}
	tbody.innerHTML = filas.map(a => `
		<tr>
			<td>${formatFechaHora(a.fecha)}</td>
			<td>${esc(a.usuario) || '–'}</td>
			<td>${badgeAccion(a.accion)}</td>
			<td>${esc(a.entidad)}${a.entidad_id ? ` #${esc(a.entidad_id)}` : ''}</td>
			<td>${esc(a.detalle) || '–'}</td>
			<td>${esc(a.ip) || '–'}</td>
		</tr>
	`).join('');
}

function renderPaginacion(total, page, perPage) {
	totalPaginas = Math.max(1, Math.ceil(total / perPage));
	paginaActual = page;
	const desde = total === 0 ? 0 : (page - 1) * perPage + 1;
	const hasta = Math.min(page * perPage, total);
	document.getElementById('paginacion-info').textContent = `Mostrando ${desde} a ${hasta} de ${total} registros`;
	document.getElementById('paginas').textContent = `${page} / ${totalPaginas}`;
	document.getElementById('btn-prev').disabled = page <= 1;
	document.getElementById('btn-next').disabled = page >= totalPaginas;
}

async function cargarAuditoria(page = 1) {
	const tbody = document.getElementById('tabla-auditoria');
	tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Cargando...</td></tr>';
	try {
		const response = await fetch(`/api/api_auditoria_lista.php?${construirQuery(page)}`);
		const result = await response.json();
		llenarSelect('f-accion', result.acciones);
		llenarSelect('f-entidad', result.entidades);
		renderTabla(result.data);
		renderPaginacion(result.total, result.page, result.per_page);
	} catch (error) {
		console.error(error);
		tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Error al cargar la auditoría</td></tr>';
	}
}

document.getElementById('btn-buscar').addEventListener('click', () => cargarAuditoria(1));
document.getElementById('f-usuario').addEventListener('keyup', (e) => {
	if (e.key === 'Enter') cargarAuditoria(1);
})
document.getElementById('per-page').addEventListener('change', () => cargarAuditoria(1));
document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
	['f-usuario', 'f-accion', 'f-entidad', 'f-fecha-desde', 'f-fecha-hasta'].forEach(id => document.getElementById(id).value = '');
	cargarAuditoria(1);
})
document.getElementById('btn-prev').addEventListener('click', () => {
	if (paginaActual > 1) cargarAuditoria(paginaActual - 1);
})
document.getElementById('btn-next').addEventListener('click', () => {
	if (paginaActual < totalPaginas) cargarAuditoria(paginaActual + 1);
})

cargarAuditoria(1);
