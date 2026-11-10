let paginaActual = 1;
let totalPaginas = 1;

const tipoSelect = document.getElementById('f-tipo');

async function cargarTipos() {
	try {
		const response = await fetch('/api/api_tipo_residentes.php');
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

function badgeEstado(r) {
	if (r.activo == 1) return `<span class="badge-status success">Activo</span>`;
	if (r.fecha_baja) return `<span class="badge-status danger" title="Desde ${esc(r.fecha_baja)}">De baja</span>`;
	return `<span class="badge-status warning">Inactivo</span>`;
}

function renderTabla(filas, offset) {
	const tbody = document.getElementById('tabla-residentes');

	if (filas.length === 0) {
		tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No se encontraron residentes con esos filtros</td></tr>';
		return;
	}

	tbody.innerHTML = filas.map((r, i) => {
		const nombreCompleto = esc(`${r.nombres} ${r.apellidos}`);
		// Solo el primero; si tiene más, "…" con la lista completa al pasar el mouse
		const deptos = r.departamentos.length === 0 ? '–'
			: esc(r.departamentos[0]) + (r.departamentos.length > 1
				? ` <span class="deptos-mas" title="${esc(r.departamentos.join('\n'))}">…</span>`
				: '');
		const accionEstado = r.activo == 1
			? `<button type="button" class="btn-icon-edit btn-toggle-estado solo-admin" data-id="${r.id}" data-nombre="${nombreCompleto}" data-activo="1" data-deptos="${r.departamentos.length}" title="Desactivar"><i class='bx bx-user-x'></i></button>`
			: `<button type="button" class="btn-icon-edit btn-toggle-estado solo-admin" data-id="${r.id}" data-nombre="${nombreCompleto}" data-activo="0" title="Reactivar"><i class='bx bx-user-check'></i></button>`;
		// Baja por mudanza: para activos y para desactivados temporalmente
		const accionBaja = r.fecha_baja ? ''
			: `<button type="button" class="btn-icon-edit btn-eliminar btn-baja solo-admin" data-id="${r.id}" title="Dar de baja (mudanza)"><i class='bx bx-exit'></i></button>`;

		return `
			<tr>
				<td>${offset + i + 1}</td>
				<td>${nombreCompleto}</td>
				<td>${esc(r.dni)}</td>
				<td><span class="badge-status info">${esc(r.tipo_nombre)}</span></td>
				<td>${deptos}</td>
				<td>${esc(r.celular) || '–'}</td>
				<td>${esc(r.correo) || '–'}</td>
				<td>${badgeEstado(r)}</td>
				<td class="acciones-cell solo-admin">
					<button type="button" class="btn-icon-edit btn-editar solo-admin" data-id="${r.id}" title="Editar"><i class='bx bx-edit'></i></button>
					${accionEstado}
					${accionBaja}
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
	tbody.innerHTML = skeletonFilasTabla(9);

	try {
		const query = construirQuery(page);
		const response = await fetch(`/api/api_residentes_lista.php?${query}`);
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
		const response = await fetch('/api/api_tipo_residentes.php');
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
	el.innerHTML = `<p class="${tipo}">${tipo === 'error' ? '❌' : '✅'} ${esc(texto)}</p>`;
}

function cerrarModalEditar() {
	modalEditar.classList.remove('activo');
	formEditar.reset();
	editPerfilBase64.value = '';
	editPerfilInput.value = '';
	document.getElementById('modal-editar-mensaje').innerHTML = '';
	if (deptosCambiaron) cargarResidentes(paginaActual);
	deptosCambiaron = false;
}

// ===== FOTO DE PERFIL (dentro del modal editar) =====

const editPerfilInput = document.getElementById('edit-perfil-input');
const editPerfilBase64 = document.getElementById('edit-foto_perfil_base64');
const editPerfilPreview = document.getElementById('edit-perfil-preview');
const editPerfilPlaceholder = document.getElementById('edit-perfil-placeholder');

function setPerfilPreview(src) {
	if (src) {
		editPerfilPreview.src = src;
		editPerfilPreview.style.display = 'block';
		editPerfilPlaceholder.style.display = 'none';
	} else {
		editPerfilPreview.style.display = 'none';
		editPerfilPlaceholder.style.display = 'flex';
	}
}

document.getElementById('btn-edit-perfil').addEventListener('click', () => editPerfilInput.click());

editPerfilInput.addEventListener('change', () => {
	const file = editPerfilInput.files[0];
	if (!file) return;
	if (file.size > 2 * 1024 * 1024) {
		alert('La imagen supera los 2MB permitidos');
		editPerfilInput.value = '';
		return;
	}
	const reader = new FileReader();
	reader.onload = () => {
		editPerfilBase64.value = reader.result;
		setPerfilPreview(reader.result);
	};
	reader.readAsDataURL(file);
})

// ===== DEPARTAMENTOS DEL RESIDENTE (dentro del modal editar) =====

const asignarTorre = document.getElementById('asignar-torre');
const asignarDepto = document.getElementById('asignar-departamento');
const asignarRelacion = document.getElementById('asignar-relacion');
let deptosCambiaron = false;

function renderDeptosResidente(departamentos) {
	const lista = document.getElementById('edit-deptos-lista');
	if (departamentos.length === 0) {
		lista.innerHTML = '<li class="table-empty">Sin departamentos asignados</li>';
		return;
	}
	lista.innerHTML = departamentos.map(d => `
		<li>
			<span>${esc(d.torre_nombre)} - Dep ${esc(d.depto_numero)}</span>
			<span class="badge-status ${d.tipo_relacion === 'Titular' ? 'success' : 'info'}">${esc(d.tipo_relacion)}</span>
			<button type="button" class="btn-icon-edit btn-quitar-depto" data-depto="${esc(d.departamento_id)}" title="Quitar"><i class='bx bx-x'></i></button>
		</li>
	`).join('');
}

async function recargarDeptosResidente() {
	const response = await fetch(`/api/api_residente_detalle.php?id=${document.getElementById('edit-id').value}`);
	const result = await response.json();
	if (result.success) renderDeptosResidente(result.residente.departamentos);
}

async function cargarTorresAsignar() {
	if (asignarTorre.dataset.cargado) return;
	try {
		const response = await fetch('/api/api_torres.php');
		const torres = await response.json();
		torres.forEach(t => {
			const option = document.createElement('option');
			option.value = t.id;
			option.textContent = t.nombre;
			asignarTorre.appendChild(option);
		})
		asignarTorre.dataset.cargado = '1';
	} catch (error) {
		console.error(error);
	}
}

asignarTorre.addEventListener('change', async () => {
	asignarDepto.innerHTML = '<option value="">Departamento...</option>';
	asignarDepto.disabled = true;
	if (!asignarTorre.value) return;
	try {
		const response = await fetch(`/api/api_departamentos.php?torre_id=${asignarTorre.value}`);
		const deptos = await response.json();
		deptos.forEach(d => {
			const option = document.createElement('option');
			option.value = d.id;
			option.textContent = `${d.numero} (Piso ${d.piso})`;
			asignarDepto.appendChild(option);
		})
		asignarDepto.disabled = false;
	} catch (error) {
		console.error(error);
	}
})

document.getElementById('btn-asignar-departamento').addEventListener('click', async () => {
	if (!asignarDepto.value) {
		mostrarMensajeModal('Selecciona una torre y un departamento', 'error');
		return;
	}
	try {
		const formData = new FormData();
		formData.set('residente_id', document.getElementById('edit-id').value);
		formData.set('departamento_id', asignarDepto.value);
		formData.set('tipo_relacion', asignarRelacion.value);
		const response = await fetch('/api/api_residente_asignar_departamento.php', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.success) {
			deptosCambiaron = true;
			asignarTorre.value = '';
			asignarTorre.dispatchEvent(new Event('change'));
			mostrarMensajeModal('Departamento asignado', 'success');
			await recargarDeptosResidente();
		} else {
			mostrarMensajeModal(result.message || 'No se pudo asignar el departamento', 'error');
		}
	} catch (error) {
		console.error(error);
		mostrarMensajeModal('Error al asignar el departamento', 'error');
	}
})

document.getElementById('edit-deptos-lista').addEventListener('click', async (e) => {
	const btn = e.target.closest('.btn-quitar-depto');
	if (!btn) return;
	if (!confirm('¿Quitar este departamento al residente?')) return;
	try {
		const formData = new FormData();
		formData.set('residente_id', document.getElementById('edit-id').value);
		formData.set('departamento_id', btn.dataset.depto);
		const response = await fetch('/api/api_residente_quitar_departamento.php', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.success) {
			deptosCambiaron = true;
			mostrarMensajeModal('Departamento quitado', 'success');
			await recargarDeptosResidente();
		} else {
			mostrarMensajeModal(result.message || 'No se pudo quitar el departamento', 'error');
		}
	} catch (error) {
		console.error(error);
		mostrarMensajeModal('Error al quitar el departamento', 'error');
	}
})

async function abrirModalEditar(id) {
	await Promise.all([cargarTiposEnModal(), cargarTorresAsignar()]);

	try {
		const response = await fetch(`/api/api_residente_detalle.php?id=${id}`);
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

		setPerfilPreview(r.foto_perfil ? '/' + r.foto_perfil : null);
		renderDeptosResidente(r.departamentos);
		asignarTorre.value = '';
		asignarTorre.dispatchEvent(new Event('change'));
		// Un residente inactivo no puede recibir departamentos (se restauran al reactivarlo)
		document.querySelector('.deptos-residente-asignar').style.display = r.activo == 1 ? '' : 'none';

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
		abrirModalEstado(btnEstado.dataset.id, btnEstado.dataset.nombre, btnEstado.dataset.activo, Number(btnEstado.dataset.deptos || 0));
		return;
	}

	const btnBaja = e.target.closest('.btn-baja');
	if (btnBaja) abrirModalBaja(btnBaja.dataset.id);
})

document.getElementById('btn-cancelar-editar').addEventListener('click', cerrarModalEditar);
modalEditar.addEventListener('click', (e) => {
	if (e.target === modalEditar) cerrarModalEditar();
})

formEditar.addEventListener('submit', async (e) => {
	e.preventDefault();
	try {
		const formData = new FormData(formEditar);
		const response = await fetch('/api/api_residente_editar.php', {
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

function abrirModalEstado(id, nombre, activoActual, cantidadDeptos) {
	const vaADesactivar = activoActual === '1';
	residenteEstadoObjetivo = { id, activo: vaADesactivar ? '0' : '1' };

	const avisoDeptos = cantidadDeptos > 0
		? ` Se cerrarán sus ${cantidadDeptos} departamento${cantidadDeptos === 1 ? '' : 's'}; al reactivarlo se restaurarán, salvo los que ya tengan otro titular.`
		: '';

	document.getElementById('estado-titulo').textContent = vaADesactivar ? 'Desactivar Residente' : 'Reactivar Residente';
	document.getElementById('estado-mensaje').innerHTML = vaADesactivar
		? `¿Desactivar a <strong id="estado-nombre">${esc(nombre)}</strong>? Ya no podrá ingresar por reconocimiento facial hasta que sea reactivado.${avisoDeptos}`
		: `¿Reactivar a <strong id="estado-nombre">${esc(nombre)}</strong>? Podrá volver a ingresar por reconocimiento facial y se restaurarán sus departamentos.`;

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
		const response = await fetch('/api/api_residente_estado.php', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		cerrarModalEstado();

		if (result.success) {
			cargarResidentes(paginaActual);
			if (result.departamentos_no_restaurados && result.departamentos_no_restaurados.length) {
				alert('Estos departamentos no se restauraron porque ya tienen otro titular:\n- '
					+ result.departamentos_no_restaurados.join('\n- ')
					+ '\n\nPuedes asignarlo de nuevo desde Editar (como Copropietario o Habitante).');
			}
		} else {
			alert(result.message || 'No se pudo actualizar el estado del residente');
		}
	} catch (error) {
		console.error(error);
		cerrarModalEstado();
		alert('Error al actualizar el estado del residente');
	}
})

// ===== MODAL BAJA POR MUDANZA =====
// Cierra sus departamentos de forma definitiva. Por cada departamento donde
// viven otras personas, el operador decide si se quedan o si se libera por completo.

const modalBaja = document.getElementById('modal-baja');
let residenteBajaId = null;

async function abrirModalBaja(id) {
	try {
		const response = await fetch(`/api/api_residente_detalle.php?id=${id}`);
		const result = await response.json();
		if (!result.success) {
			alert(result.message || 'No se pudo cargar el residente');
			return;
		}

		const r = result.residente;
		residenteBajaId = r.id;
		document.getElementById('baja-nombre').textContent = `${r.nombres} ${r.apellidos}`;
		document.getElementById('modal-baja-mensaje').innerHTML = '';

		const lista = document.getElementById('baja-deptos');
		lista.innerHTML = r.departamentos_baja.length === 0
			? '<li class="table-empty">No tiene departamentos asignados</li>'
			: r.departamentos_baja.map(d => {
				const nombreDepto = `${esc(d.torre_nombre)} - Dep ${esc(d.depto_numero)}`;
				if (d.otros_ocupantes.length === 0) {
					return `
						<li>
							<strong>${nombreDepto}</strong>
							<span class="baja-libre"><i class='bx bx-check-circle'></i> Quedará libre (no vive nadie más)</span>
						</li>`;
				}
				return `
					<li>
						<strong>${nombreDepto}</strong>
						<span class="baja-otros">También viven: ${d.otros_ocupantes.map(esc).join(', ')}</span>
						<label class="baja-check">
							<input type="checkbox" value="${esc(d.departamento_id)}">
							Liberar por completo (también salen ellos)
						</label>
					</li>`;
			}).join('');

		modalBaja.classList.add('activo');
	} catch (error) {
		console.error(error);
		alert('Error al cargar el residente');
	}
}

function cerrarModalBaja() {
	residenteBajaId = null;
	modalBaja.classList.remove('activo');
}

document.getElementById('btn-cancelar-baja').addEventListener('click', cerrarModalBaja);
modalBaja.addEventListener('click', (e) => {
	if (e.target === modalBaja) cerrarModalBaja();
})

document.getElementById('btn-confirmar-baja').addEventListener('click', async () => {
	if (!residenteBajaId) return;

	try {
		const formData = new FormData();
		formData.set('id', residenteBajaId);
		document.querySelectorAll('#baja-deptos input[type=checkbox]:checked')
			.forEach(chk => formData.append('liberar[]', chk.value));

		const response = await fetch('/api/api_residente_baja.php', { method: 'POST', body: formData });
		const result = await response.json();

		if (!result.success) {
			document.getElementById('modal-baja-mensaje').innerHTML =
				`<p class="error">❌ ${esc(result.message || 'No se pudo dar de baja')}</p>`;
			return;
		}

		cerrarModalBaja();
		cargarResidentes(paginaActual);

		let resumen = `Baja registrada para: ${result.dados_de_baja.join(', ')}.`;
		if (result.siguen_en_otro_departamento.length) {
			resumen += `\n\nSiguen activos porque viven en otro departamento: ${result.siguen_en_otro_departamento.join(', ')}.`;
		}
		alert(resumen);
	} catch (error) {
		console.error(error);
		document.getElementById('modal-baja-mensaje').innerHTML = '<p class="error">❌ Error al dar de baja</p>';
	}
})
