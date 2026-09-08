let paginaActual = 1;
let totalPaginas = 1;

const tipoSelect = document.getElementById('f-tipo');

async function cargarTipos() {
	try {
		const response = await fetch('http://localhost:8000/templates/api_tipo_residentes.php');
		const tipos = await response.json();
		tipos.forEach(t => {
			const option = document.createElement('option');
			option.value = t.id;
			option.textContent = t.nombre;
			tipoSelect.appendChild(option);
		})
	} catch (error) {
		console.error(error);
	}
}
cargarTipos();

function valorDe(id) {
	const el = document.getElementById(id);
	return el ? el.value : '';
}

function construirQuery(page) {
	const params = new URLSearchParams();
	if (valorDe('f-estado')) params.set('estado', valorDe('f-estado'));
	if (valorDe('f-tipo')) params.set('tipo_residente_id', valorDe('f-tipo'));
	if (valorDe('f-buscar')) params.set('buscar', valorDe('f-buscar'));
	params.set('page', page);
	params.set('per_page', valorDe('per-page') || 10);
	return params.toString();
}

function badgeEstado(activo) {
	return activo == 1
		? `<span class="badge-status success">Activo</span>`
		: `<span class="badge-status warning">Inactivo</span>`;
}

function renderTabla(filas, offset) {
	const tbody = document.getElementById('tabla-residentes');

	if (filas.length === 0) {
		tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No se encontraron residentes con esos filtros</td></tr>';
		return;
	}

	tbody.innerHTML = filas.map((r, i) => {
		const nombreCompleto = `${r.nombres} ${r.apellidos}`;
		const torreDepto = r.torre_nombre ? `${r.torre_nombre} - Dep ${r.depto_numero}` : '–';
		const accionEstado = r.activo == 1
			? `<button type="button" class="btn-icon-edit btn-toggle-estado" data-id="${r.id}" data-nombre="${nombreCompleto}" data-activo="1" title="Desactivar"><i class='bx bx-user-x'></i></button>`
			: `<button type="button" class="btn-icon-edit btn-toggle-estado" data-id="${r.id}" data-nombre="${nombreCompleto}" data-activo="0" title="Reactivar"><i class='bx bx-user-check'></i></button>`;

		return `
			<tr>
				<td>${offset + i + 1}</td>
				<td>${nombreCompleto}</td>
				<td>${r.dni}</td>
				<td><span class="badge-status info">${r.tipo_nombre}</span></td>
				<td>${torreDepto}</td>
				<td>${r.celular || '–'}</td>
				<td>${r.correo || '–'}</td>
				<td>${badgeEstado(r.activo)}</td>
				<td class="acciones-cell">
					<button type="button" class="btn-icon-edit btn-editar" data-id="${r.id}" title="Editar"><i class='bx bx-edit'></i></button>
					${accionEstado}
				</td>
			</tr>
		`;
	}).join('');
}

function renderPaginacion(total, page, perPage) {
	totalPaginas = Math.max(1, Math.ceil(total / perPage));
	paginaActual = page;

	const desde = total === 0 ? 0 : (page - 1) * perPage + 1;
	const hasta = Math.min(page * perPage, total);
	document.getElementById('paginacion-info').textContent = `Mostrando ${desde} a ${hasta} de ${total} residentes`;
	document.getElementById('paginas').textContent = `${page} / ${totalPaginas}`;

	document.getElementById('btn-prev').disabled = page <= 1;
	document.getElementById('btn-next').disabled = page >= totalPaginas;
}

async function cargarResidentes(page = 1) {
	const tbody = document.getElementById('tabla-residentes');
	tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Cargando...</td></tr>';

	try {
		const query = construirQuery(page);
		const response = await fetch(`http://localhost:8000/templates/api_residentes_lista.php?${query}`);
		const result = await response.json();

		const perPage = parseInt(document.getElementById('per-page').value);
		renderTabla(result.data, (page - 1) * perPage);
		renderPaginacion(result.total, result.page, result.per_page);
	} catch (error) {
		console.error(error);
		tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Error al cargar los residentes</td></tr>';
	}
}
cargarResidentes();

document.getElementById('btn-buscar').addEventListener('click', () => cargarResidentes(1));
document.getElementById('f-buscar').addEventListener('keyup', (e) => {
	if (e.key === 'Enter') cargarResidentes(1);
})
document.getElementById('per-page').addEventListener('change', () => cargarResidentes(1));

document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
	const ids = ['f-estado', 'f-tipo', 'f-buscar'];
	ids.forEach(id => {
		const el = document.getElementById(id);
		if (el) el.value = '';
	})
	cargarResidentes(1);
})

document.getElementById('btn-prev').addEventListener('click', () => {
	if (paginaActual > 1) cargarResidentes(paginaActual - 1);
})
document.getElementById('btn-next').addEventListener('click', () => {
	if (paginaActual < totalPaginas) cargarResidentes(paginaActual + 1);
})

// ===== MODAL EDITAR =====

const modalEditar = document.getElementById('modal-editar');
const formEditar = document.getElementById('form-editar-residente');
const editTipoSelect = document.getElementById('edit-tipo_residente_id');

async function cargarTiposEnModal() {
	if (editTipoSelect.dataset.cargado) return;
	try {
		const response = await fetch('http://localhost:8000/templates/api_tipo_residentes.php');
		const tipos = await response.json();
		editTipoSelect.innerHTML = '';
		tipos.forEach(t => {
			const option = document.createElement('option');
			option.value = t.id;
			option.textContent = t.nombre;
			editTipoSelect.appendChild(option);
		})
		editTipoSelect.dataset.cargado = '1';
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
	await cargarTiposEnModal();

	try {
		const response = await fetch(`http://localhost:8000/templates/api_residente_detalle.php?id=${id}`);
		const result = await response.json();

		if (!result.success) {
			alert(result.message || 'No se pudo cargar el residente');
			return;
		}

		const r = result.residente;
		document.getElementById('edit-id').value = r.id;
		editTipoSelect.value = r.tipo_residente_id;
		document.getElementById('edit-nombres').value = r.nombres;
		document.getElementById('edit-apellidos').value = r.apellidos;
		document.getElementById('edit-dni').value = r.dni;
		document.getElementById('edit-fecha_nacimiento').value = r.fecha_nacimiento || '';
		document.getElementById('edit-sexo').value = r.sexo || '';
		document.getElementById('edit-estado_civil').value = r.estado_civil || '';
		document.getElementById('edit-correo').value = r.correo || '';
		document.getElementById('edit-celular').value = r.celular || '';
		document.getElementById('edit-telefono').value = r.telefono || '';
		document.getElementById('edit-direccion').value = r.direccion || '';

		const torreWrap = document.getElementById('edit-torre-info-wrap');
		if (r.torre_nombre) {
			document.getElementById('edit-torre-info').textContent = `${r.torre_nombre} - Dep ${r.depto_numero}`;
			torreWrap.style.display = 'block';
		} else {
			torreWrap.style.display = 'none';
		}

		modalEditar.classList.add('activo');
	} catch (error) {
		console.error(error);
		alert('Error al cargar el residente');
	}
}

document.getElementById('tabla-residentes').addEventListener('click', (e) => {
	const btnEditar = e.target.closest('.btn-editar');
	if (btnEditar) {
		abrirModalEditar(btnEditar.dataset.id);
		return;
	}

	const btnEstado = e.target.closest('.btn-toggle-estado');
	if (btnEstado) {
		abrirModalEstado(btnEstado.dataset.id, btnEstado.dataset.nombre, btnEstado.dataset.activo);
	}
})

document.getElementById('btn-cancelar-editar').addEventListener('click', cerrarModalEditar);
modalEditar.addEventListener('click', (e) => {
	if (e.target === modalEditar) cerrarModalEditar();
})

formEditar.addEventListener('submit', async (e) => {
	e.preventDefault();
	try {
		const formData = new FormData(formEditar);
		const response = await fetch('http://localhost:8000/templates/api_residente_editar.php', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		if (result.success) {
			cerrarModalEditar();
			cargarResidentes(paginaActual);
		} else {
			mostrarMensajeModal(result.message || 'No se pudo actualizar el residente', 'error');
		}
	} catch (error) {
		console.error(error);
		mostrarMensajeModal('Error al actualizar el residente', 'error');
	}
})

// ===== MODAL ESTADO (activar/desactivar) =====

const modalEstado = document.getElementById('modal-estado');
let residenteEstadoObjetivo = null;

function abrirModalEstado(id, nombre, activoActual) {
	const vaADesactivar = activoActual === '1';
	residenteEstadoObjetivo = { id, activo: vaADesactivar ? '0' : '1' };

	document.getElementById('estado-titulo').textContent = vaADesactivar ? 'Desactivar Residente' : 'Reactivar Residente';
	document.getElementById('estado-nombre').textContent = nombre;
	document.getElementById('estado-mensaje').innerHTML = vaADesactivar
		? `¿Desactivar a <strong id="estado-nombre">${nombre}</strong>? Ya no podrá ingresar por reconocimiento facial hasta que sea reactivado.`
		: `¿Reactivar a <strong id="estado-nombre">${nombre}</strong>? Podrá volver a ingresar por reconocimiento facial.`;

	modalEstado.classList.add('activo');
}

function cerrarModalEstado() {
	residenteEstadoObjetivo = null;
	modalEstado.classList.remove('activo');
}

document.getElementById('btn-cancelar-estado').addEventListener('click', cerrarModalEstado);
modalEstado.addEventListener('click', (e) => {
	if (e.target === modalEstado) cerrarModalEstado();
})

document.getElementById('btn-confirmar-estado').addEventListener('click', async () => {
	if (!residenteEstadoObjetivo) return;

	try {
		const formData = new FormData();
		formData.set('id', residenteEstadoObjetivo.id);
		formData.set('activo', residenteEstadoObjetivo.activo);
		const response = await fetch('http://localhost:8000/templates/api_residente_estado.php', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		cerrarModalEstado();

		if (result.success) {
			cargarResidentes(paginaActual);
		} else {
			alert(result.message || 'No se pudo actualizar el estado del residente');
		}
	} catch (error) {
		console.error(error);
		cerrarModalEstado();
		alert('Error al actualizar el estado del residente');
	}
})
