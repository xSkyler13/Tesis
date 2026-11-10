let paginaActual = 1;
let totalPaginas = 1;
let idResaltado = null;

const modalEditar = document.getElementById('modal-editar');
const modalEliminar = document.getElementById('modal-eliminar');
let idAEliminar = null;
const formEditar = document.getElementById('form-editar-visita');
const editTorre = document.getElementById('edit-torre_id');
const editDepto = document.getElementById('edit-departamento_id');
const editResidente = document.getElementById('edit-residente_id');

function valorDe(id) {
	const el = document.getElementById(id);
	return el ? el.value : '';
}

function formatFecha(fecha) {
	const [a, m, d] = fecha.split('-');
	return `${d}/${m}/${a}`;
}

function badgeEstado(estado) {
	const clase = estado === 'Permitido' ? 'success' : estado === 'Denegado' ? 'danger' : 'warning';
	return `<span class="badge-status ${clase}">${esc(estado)}</span>`;
}

function construirQuery(page) {
	const params = new URLSearchParams();
	if (valorDe('f-estado')) params.set('estado', valorDe('f-estado'));
	if (valorDe('f-tipo')) params.set('tipo_visita', valorDe('f-tipo'));
	if (valorDe('f-fecha-desde')) params.set('fecha_desde', valorDe('f-fecha-desde'));
	if (valorDe('f-fecha-hasta')) params.set('fecha_hasta', valorDe('f-fecha-hasta'));
	if (valorDe('f-sexo')) params.set('sexo', valorDe('f-sexo'));
	if (valorDe('f-dni')) params.set('dni', valorDe('f-dni'));
	if (valorDe('f-buscar')) params.set('buscar', valorDe('f-buscar'));
	params.set('page', page);
	params.set('per_page', valorDe('per-page') || 10);
	return params.toString();
}

function renderTabla(filas, offset) {
	const tbody = document.getElementById('tabla-visitas');

	if (filas.length === 0) {
		tbody.innerHTML = '<tr><td colspan="12" class="table-empty">No se encontraron visitas con esos filtros</td></tr>';
		return;
	}

	tbody.innerHTML = filas.map((v, i) => `
		<tr data-id="${v.id}"${String(v.id) === String(idResaltado) ? ' class="fila-actualizada"' : ''}>
			<td>${offset + i + 1}</td>
			<td>${esc(v.nombres_visitante)}</td>
			<td>${v.sexo ? esc(v.sexo) : '–'}</td>
			<td>${esc(v.tipo_documento)} ${esc(v.numero_documento)}</td>
			<td><span class="badge-status info">${esc(v.tipo_visita)}</span></td>
			<td>${esc(v.motivo)}</td>
			<td>${formatFecha(v.fecha_visita)}</td>
			<td>${v.hora_ingreso.slice(0, 5)}</td>
			<td>${esc(v.torre_nombre)} - Dep ${esc(v.depto_numero)}</td>
			<td>${esc(v.anfitrion)}</td>
			<td>${badgeEstado(v.estado)}</td>
			<td class="acciones-cell">
				<button type="button" class="btn-icon-edit btn-editar" data-id="${v.id}" title="Editar"><i class='bx bx-edit'></i></button>
				<button type="button" class="btn-icon-edit btn-eliminar solo-admin" data-id="${v.id}" data-nombre="${esc(v.nombres_visitante)}" title="Eliminar"><i class='bx bx-trash'></i></button>
			</td>
		</tr>
	`).join('');
	idResaltado = null;
}

function renderPaginacion(total, page, perPage) {
	totalPaginas = Math.max(1, Math.ceil(total / perPage));
	paginaActual = page;

	const desde = total === 0 ? 0 : (page - 1) * perPage + 1;
	const hasta = Math.min(page * perPage, total);
	document.getElementById('paginacion-info').textContent = `Mostrando ${desde} a ${hasta} de ${total} visitas`;
	document.getElementById('paginas').textContent = `${page} / ${totalPaginas}`;

	document.getElementById('btn-prev').disabled = page <= 1;
	document.getElementById('btn-next').disabled = page >= totalPaginas;
}

async function cargarVisitas(page = 1, silencioso = false) {
	const tbody = document.getElementById('tabla-visitas');
	if (!silencioso) tbody.innerHTML = skeletonFilasTabla(12);

	try {
		const response = await fetch(`/api/api_visitas_lista.php?${construirQuery(page)}`,
			silencioso ? { headers: { 'X-Refresco-Automatico': '1' } } : {});
		const result = await response.json();

		const perPage = parseInt(document.getElementById('per-page').value);
		renderTabla(result.data, (page - 1) * perPage);
		renderPaginacion(result.total, result.page, result.per_page);
	} catch (error) {
		console.error(error);
		if (!silencioso) tbody.innerHTML = '<tr><td colspan="12" class="table-empty">Error al cargar las visitas</td></tr>';
	}
}
cargarVisitas();

document.getElementById('btn-buscar').addEventListener('click', () => cargarVisitas(1));
['f-buscar', 'f-dni'].forEach(id => {
	document.getElementById(id).addEventListener('keyup', (e) => {
		if (e.key === 'Enter') cargarVisitas(1);
	})
})
document.getElementById('per-page').addEventListener('change', () => cargarVisitas(1));

document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
	['f-estado', 'f-tipo', 'f-sexo', 'f-dni', 'f-fecha-desde', 'f-fecha-hasta', 'f-buscar'].forEach(id => {
		document.getElementById(id).value = '';
	})
	cargarVisitas(1);
})

document.getElementById('btn-prev').addEventListener('click', () => {
	if (paginaActual > 1) cargarVisitas(paginaActual - 1);
})
document.getElementById('btn-next').addEventListener('click', () => {
	if (paginaActual < totalPaginas) cargarVisitas(paginaActual + 1);
})

// Refresco automático: si otra sesión (o el panel de control) cambia una visita, se ve sin recargar.
setInterval(() => {
	if (!modalEditar.classList.contains('activo') && !modalEliminar.classList.contains('activo') && !document.hidden) {
		cargarVisitas(paginaActual, true);
	}
}, 15000);

// ===== MODAL EDITAR =====

function opcion(valor, texto) {
	const option = document.createElement('option');
	option.value = valor;
	option.textContent = texto;
	return option;
}

async function cargarTorresEnModal() {
	if (editTorre.dataset.cargado) return;
	const response = await fetch('/api/api_torres.php');
	const torres = await response.json();
	editTorre.innerHTML = '';
	torres.forEach(t => editTorre.appendChild(opcion(t.id, t.nombre)));
	editTorre.dataset.cargado = '1';
}

// actual = { id, texto }: departamento actual de la visita, por si ya no está activo.
async function cargarDeptosEnModal(torreId, actual) {
	const response = await fetch(`/api/api_departamentos.php?torre_id=${torreId}`);
	const deptos = await response.json();
	editDepto.innerHTML = '';
	deptos.forEach(d => editDepto.appendChild(opcion(d.id, `${d.numero} (Piso ${d.piso})`)));
	if (actual && !deptos.some(d => String(d.id) === String(actual.id))) {
		editDepto.appendChild(opcion(actual.id, actual.texto));
	}
}

// actual = { id, texto }: anfitrión actual de la visita, por si ya no está vinculado.
async function cargarResidentesEnModal(deptoId, actual) {
	editResidente.innerHTML = '';
	if (!deptoId) return;
	const response = await fetch(`/api/api_residentes_por_departamento.php?departamento_id=${deptoId}`);
	const residentes = await response.json();
	residentes.forEach(r => editResidente.appendChild(opcion(r.id, r.nombre)));
	if (actual && !residentes.some(r => String(r.id) === String(actual.id))) {
		editResidente.appendChild(opcion(actual.id, actual.texto));
	}
}

editTorre.addEventListener('change', async () => {
	await cargarDeptosEnModal(editTorre.value);
	await cargarResidentesEnModal(editDepto.value);
})
editDepto.addEventListener('change', () => cargarResidentesEnModal(editDepto.value))

function mostrarMensajeModal(texto, tipo) {
	document.getElementById('modal-editar-mensaje').innerHTML = `<p class="${tipo}">${tipo === 'error' ? '❌' : '✅'} ${esc(texto)}</p>`;
}

function cerrarModalEditar() {
	modalEditar.classList.remove('activo');
	formEditar.reset();
	document.getElementById('modal-editar-mensaje').innerHTML = '';
}

const CAMPOS_SIMPLES = [
	'tipo_visita', 'motivo', 'fecha_visita', 'tiempo_estimado', 'numero_visitantes',
	'autorizacion_residente', 'via_autorizacion', 'estado', 'nombres_visitante', 'sexo', 'tipo_documento',
	'numero_documento', 'fecha_nacimiento', 'telefono', 'correo', 'parentesco', 'direccion',
	'empresa', 'observaciones'
];

async function abrirModalEditar(id) {
	try {
		await cargarTorresEnModal();
		const response = await fetch(`/api/api_visita_detalle.php?id=${id}`);
		const result = await response.json();

		if (!result.success) {
			alert(result.message || 'No se pudo cargar la visita');
			return;
		}

		const v = result.visita;
		document.getElementById('edit-id').value = v.id;
		CAMPOS_SIMPLES.forEach(campo => {
			document.getElementById(`edit-${campo}`).value = v[campo] ?? '';
		})
		document.getElementById('edit-hora_ingreso').value = v.hora_ingreso.slice(0, 5);

		editTorre.value = v.torre_id;
		await cargarDeptosEnModal(v.torre_id, { id: v.departamento_id, texto: v.depto_numero });
		editDepto.value = v.departamento_id;
		await cargarResidentesEnModal(v.departamento_id, { id: v.residente_id, texto: v.anfitrion });
		editResidente.value = v.residente_id;

		modalEditar.classList.add('activo');
	} catch (error) {
		console.error(error);
		alert('Error al cargar la visita');
	}
}

document.getElementById('tabla-visitas').addEventListener('click', (e) => {
	const btnEditar = e.target.closest('.btn-editar');
	if (btnEditar) {
		abrirModalEditar(btnEditar.dataset.id);
		return;
	}

	const btnEliminar = e.target.closest('.btn-eliminar');
	if (btnEliminar) abrirModalEliminar(btnEliminar.dataset.id, btnEliminar.dataset.nombre);
})

document.getElementById('btn-cancelar-editar').addEventListener('click', cerrarModalEditar);
modalEditar.addEventListener('click', (e) => {
	if (e.target === modalEditar) cerrarModalEditar();
})

formEditar.addEventListener('submit', async (e) => {
	e.preventDefault();
	try {
		const idEditado = document.getElementById('edit-id').value;
		const response = await fetch('/api/api_visita_editar.php', {
			method: 'POST',
			body: new FormData(formEditar)
		});
		const result = await response.json();

		if (result.success) {
			cerrarModalEditar();
			idResaltado = idEditado;
			await cargarVisitas(paginaActual, true);
		} else {
			mostrarMensajeModal(result.message || 'No se pudo actualizar la visita', 'error');
		}
	} catch (error) {
		console.error(error);
		mostrarMensajeModal('Error al actualizar la visita', 'error');
	}
})

// ===== MODAL ELIMINAR =====

function abrirModalEliminar(id, nombre) {
	idAEliminar = id;
	document.getElementById('eliminar-nombre').textContent = nombre;
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
		const response = await fetch('/api/api_visita_eliminar.php', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		cerrarModalEliminar();

		if (result.success) {
			// Si era la única fila de la última página, se retrocede una página.
			const filasEnPagina = document.querySelectorAll('#tabla-visitas tr[data-id]').length;
			const pagina = filasEnPagina === 1 && paginaActual > 1 ? paginaActual - 1 : paginaActual;
			await cargarVisitas(pagina, true);
		} else {
			alert(result.message || 'No se pudo eliminar la visita');
		}
	} catch (error) {
		console.error(error);
		cerrarModalEliminar();
		alert('Error al eliminar la visita');
	}
})
