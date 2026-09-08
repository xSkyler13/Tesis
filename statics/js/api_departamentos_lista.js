let paginaActual = 1;
let totalPaginas = 1;

const torreSelect = document.getElementById('f-torre');
const pisoSelect  = document.getElementById('f-piso');

async function cargarTorres() {
	try {
		const response = await fetch('http://localhost:8000/templates/api_torres.php');
		const torres = await response.json();
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

function valorDe(id) {
	const el = document.getElementById(id);
	return el ? el.value : '';
}

function construirQuery(page) {
	const params = new URLSearchParams();
	if (torreSelect.value) params.set('torre_id', torreSelect.value);
	if (pisoSelect.value) params.set('piso', pisoSelect.value);
	if (valorDe('f-estado')) params.set('estado', valorDe('f-estado'));
	if (valorDe('f-tipo')) params.set('tipo', valorDe('f-tipo'));
	if (valorDe('f-numero-desde')) params.set('numero_desde', valorDe('f-numero-desde'));
	if (valorDe('f-numero-hasta')) params.set('numero_hasta', valorDe('f-numero-hasta'));
	if (valorDe('f-area-desde')) params.set('area_desde', valorDe('f-area-desde'));
	if (valorDe('f-area-hasta')) params.set('area_hasta', valorDe('f-area-hasta'));
	if (valorDe('f-fecha-desde')) params.set('fecha_desde', valorDe('f-fecha-desde'));
	if (valorDe('f-fecha-hasta')) params.set('fecha_hasta', valorDe('f-fecha-hasta'));
	if (valorDe('f-buscar')) params.set('buscar', valorDe('f-buscar'));
	params.set('page', page);
	params.set('per_page', valorDe('per-page') || 10);
	return params.toString();
}

function badgeEstado(estado) {
	const clase = estado === 'Activo' ? 'success' : estado === 'Mantenimiento' ? 'warning' : 'info';
	return `<span class="badge-status ${clase}">${estado}</span>`;
}

function formatFecha(fechaStr) {
	const d = new Date(fechaStr.replace(' ', 'T'));
	return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderTabla(filas, offset) {
	const tbody = document.getElementById('tabla-departamentos');

	if (filas.length === 0) {
		tbody.innerHTML = '<tr><td colspan="13" class="table-empty">No se encontraron departamentos con esos filtros</td></tr>';
		return;
	}

	tbody.innerHTML = filas.map((d, i) => `
		<tr>
			<td>${offset + i + 1}</td>
			<td><a href="#" class="link-action">${d.numero}</a></td>
			<td>${d.torre_nombre}</td>
			<td>${d.piso}</td>
			<td><span class="badge-status info">${d.tipo || '--'}</span></td>
			<td>${d.area ?? '--'}</td>
			<td>${d.habitaciones ?? '--'}</td>
			<td>${d.banos ?? '--'}</td>
			<td>${d.estacionamiento ?? '--'}</td>
			<td>${badgeEstado(d.estado)}</td>
			<td>${d.propietario && d.propietario.trim() ? d.propietario : '–'}</td>
			<td>${formatFecha(d.fecha_creacion)}</td>
			<td class="acciones-cell">
				<button type="button" class="btn-icon-edit btn-editar" data-id="${d.id}" title="Editar"><i class='bx bx-edit'></i></button>
				<button type="button" class="btn-icon-edit btn-eliminar" data-id="${d.id}" data-numero="${d.numero}" title="Eliminar"><i class='bx bx-trash'></i></button>
			</td>
		</tr>
	`).join('');
}

function renderResumen(resumen, torre) {
	document.getElementById('resumen-total').textContent = resumen.total;
	document.getElementById('resumen-activos').textContent = resumen.activos ?? 0;
	document.getElementById('resumen-inactivos').textContent = resumen.inactivos ?? 0;
	document.getElementById('resumen-area').textContent = `${parseFloat(resumen.area_total).toLocaleString('es-ES')} m²`;

	const titulo = document.getElementById('resumen-titulo');
	const torreCard = document.getElementById('resumen-torre-card');

	if (torre) {
		titulo.innerHTML = `<i class='bx bx-bar-chart-alt-2 icon'></i> Resumen de la Torre`;
		torreCard.style.display = 'flex';

		document.getElementById('resumen-torre-nombre').textContent = torre.nombre;

		const img = document.getElementById('resumen-torre-img');
		const placeholder = document.getElementById('resumen-torre-placeholder');
		if (torre.imagen) {
			img.src = '/' + torre.imagen;
			img.style.display = 'block';
			placeholder.style.display = 'none';
		} else {
			img.style.display = 'none';
			placeholder.style.display = 'block';
		}

		const estadoEl = document.getElementById('resumen-torre-estado');
		const activa = torre.activo == 1;
		estadoEl.textContent = activa ? 'Activo' : 'Inactivo';
		estadoEl.className = 'torre-preview-estado badge-status ' + (activa ? 'success' : 'warning');
	} else {
		titulo.innerHTML = `<i class='bx bx-bar-chart-alt-2 icon'></i> Resumen General`;
		torreCard.style.display = 'none';
	}
}

function renderPisos(pisos) {
	if (pisoSelect.dataset.cargado) return;
	pisos.forEach(p => {
		const option = document.createElement('option');
		option.value = p;
		option.textContent = `Piso ${p}`;
		pisoSelect.appendChild(option);
	})
	pisoSelect.dataset.cargado = '1';
}

function renderPaginacion(total, page, perPage) {
	totalPaginas = Math.max(1, Math.ceil(total / perPage));
	paginaActual = page;

	const desde = total === 0 ? 0 : (page - 1) * perPage + 1;
	const hasta = Math.min(page * perPage, total);
	document.getElementById('paginacion-info').textContent = `Mostrando ${desde} a ${hasta} de ${total} departamentos`;
	document.getElementById('paginas').textContent = `${page} / ${totalPaginas}`;

	document.getElementById('btn-prev').disabled = page <= 1;
	document.getElementById('btn-next').disabled = page >= totalPaginas;
}

async function cargarDepartamentos(page = 1) {
	const tbody = document.getElementById('tabla-departamentos');
	tbody.innerHTML = skeletonFilasTabla(13);

	try {
		const query = construirQuery(page);
		const response = await fetch(`http://localhost:8000/templates/api_departamentos_lista.php?${query}`);
		const result = await response.json();

		const perPage = parseInt(document.getElementById('per-page').value);
		renderTabla(result.data, (page - 1) * perPage);
		renderResumen(result.resumen, result.torre);
		renderPisos(result.pisos_disponibles);
		renderPaginacion(result.total, result.page, result.per_page);
	} catch (error) {
		console.error(error);
		tbody.innerHTML = '<tr><td colspan="13" class="table-empty">Error al cargar los departamentos</td></tr>';
	}
}
cargarDepartamentos();

document.getElementById('btn-buscar').addEventListener('click', () => cargarDepartamentos(1));
document.getElementById('f-buscar').addEventListener('keyup', (e) => {
	if (e.key === 'Enter') cargarDepartamentos(1);
})
document.getElementById('per-page').addEventListener('change', () => cargarDepartamentos(1));

document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
	const ids = ['f-torre', 'f-piso', 'f-estado', 'f-tipo', 'f-numero-desde', 'f-numero-hasta', 'f-area-desde', 'f-area-hasta', 'f-fecha-desde', 'f-fecha-hasta', 'f-buscar'];
	ids.forEach(id => {
		const el = document.getElementById(id);
		if (el) el.value = '';
	})
	cargarDepartamentos(1);
})

document.getElementById('btn-prev').addEventListener('click', () => {
	if (paginaActual > 1) cargarDepartamentos(paginaActual - 1);
})
document.getElementById('btn-next').addEventListener('click', () => {
	if (paginaActual < totalPaginas) cargarDepartamentos(paginaActual + 1);
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

document.getElementById('tabla-departamentos').addEventListener('click', (e) => {
	const btnEditar = e.target.closest('.btn-editar');
	if (btnEditar) {
		abrirModalEditar(btnEditar.dataset.id);
		return;
	}

	const btnEliminar = e.target.closest('.btn-eliminar');
	if (btnEliminar) {
		abrirModalEliminar(btnEliminar.dataset.id, btnEliminar.dataset.numero);
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
		const response = await fetch('http://localhost:8000/templates/api_departamento_editar.php', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		if (result.success) {
			cerrarModalEditar();
			cargarDepartamentos(paginaActual);
		} else {
			mostrarMensajeModal(result.message || 'No se pudo actualizar el departamento', 'error');
		}
	} catch (error) {
		console.error(error);
		mostrarMensajeModal('Error al actualizar el departamento', 'error');
	}
})

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

		cerrarModalEliminar();

		if (result.success) {
			cargarDepartamentos(paginaActual);
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
