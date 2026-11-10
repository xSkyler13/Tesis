let usuariosCache = [];
let usuarioActualId = null;

const modalUsuario = document.getElementById('modal-usuario');
const formUsuario = document.getElementById('form-usuario');
const ROL_ADMINISTRADOR = 1;

// Qué puede hacer cada rol (la matriz real está en el servidor)
const AYUDA_ROL = {
	1: 'Acceso total al sistema.',
	2: 'Panel, visitas e incidencias; consulta residentes y departamentos.',
	3: 'Sin acceso al sistema web.',
};

function valorDe(id) {
	const el = document.getElementById(id);
	return el ? el.value : '';
}

function formatFechaHora(fechaStr) {
	if (!fechaStr) return 'Nunca';
	const d = new Date(fechaStr.replace(' ', 'T'));
	return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function cargarRoles() {
	try {
		const response = await fetch('/api/api_register.php');
		const roles = await response.json();
		const filtro = document.getElementById('f-rol');
		const select = document.getElementById('usuario-rol');
		roles.forEach(r => {
			[filtro, select].forEach(el => {
				const option = document.createElement('option');
				option.value = r.id;
				option.textContent = r.nombre;
				el.appendChild(option);
			})
		})
	} catch (error) {
		console.error(error);
	}
}

function renderTabla(filas) {
	const tbody = document.getElementById('tabla-usuarios');
	if (filas.length === 0) {
		tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No se encontraron usuarios con esos filtros</td></tr>';
		return;
	}
	tbody.innerHTML = filas.map(u => {
		const esYo = String(u.id) === String(usuarioActualId);
		// Uno mismo no puede desactivarse (también lo impide el servidor)
		const accionEstado = esYo ? ''
			: u.activo == 1
				? `<button type="button" class="btn-icon-edit btn-eliminar btn-estado" data-id="${esc(u.id)}" data-activo="0" title="Desactivar"><i class='bx bx-user-x'></i></button>`
				: `<button type="button" class="btn-icon-edit btn-estado" data-id="${esc(u.id)}" data-activo="1" title="Reactivar"><i class='bx bx-user-check'></i></button>`;
		return `
			<tr>
				<td>${esc(u.usuario)}${esYo ? ' <span class="badge-status info">Tú</span>' : ''}</td>
				<td>${esc(u.correo)}</td>
				<td><span class="badge-status ${u.rol_id == ROL_ADMINISTRADOR ? 'success' : 'info'}">${esc(u.rol_nombre)}</span></td>
				<td>${u.activo == 1 ? '<span class="badge-status success">Activo</span>' : '<span class="badge-status warning">Inactivo</span>'}</td>
				<td>${formatFechaHora(u.ultimo_ingreso)}</td>
				<td class="acciones-cell">
					<button type="button" class="btn-icon-edit btn-editar" data-id="${esc(u.id)}" title="Editar"><i class='bx bx-edit'></i></button>
					${accionEstado}
				</td>
			</tr>
		`;
	}).join('');
}

async function cargarUsuarios() {
	const tbody = document.getElementById('tabla-usuarios');
	tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Cargando...</td></tr>';
	const params = new URLSearchParams();
	if (valorDe('f-buscar')) params.set('buscar', valorDe('f-buscar'));
	if (valorDe('f-rol')) params.set('rol_id', valorDe('f-rol'));
	if (valorDe('f-estado')) params.set('estado', valorDe('f-estado'));
	try {
		const response = await fetch(`/api/api_usuarios_lista.php?${params.toString()}`);
		const result = await response.json();
		usuariosCache = result.data;
		usuarioActualId = result.usuario_actual;
		renderTabla(result.data);
	} catch (error) {
		console.error(error);
		tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Error al cargar los usuarios</td></tr>';
	}
}

document.getElementById('btn-buscar').addEventListener('click', cargarUsuarios);
document.getElementById('f-buscar').addEventListener('keyup', (e) => {
	if (e.key === 'Enter') cargarUsuarios();
})
document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
	['f-buscar', 'f-rol', 'f-estado'].forEach(id => document.getElementById(id).value = '');
	cargarUsuarios();
})

// ===== MODAL CREAR / EDITAR =====

function mostrarMensajeModal(texto, tipo) {
	document.getElementById('modal-usuario-mensaje').innerHTML =
		`<p class="${tipo}">${tipo === 'error' ? '❌' : '✅'} ${esc(texto)}</p>`;
}

function actualizarAyudaRol() {
	const bloqueado = document.getElementById('usuario-rol').disabled;
	document.getElementById('usuario-rol-ayuda').textContent = bloqueado
		? '🔒 No puedes cambiar tu propio rol: pídeselo a otro administrador.'
		: AYUDA_ROL[valorDe('usuario-rol')] || '';
}
document.getElementById('usuario-rol').addEventListener('change', actualizarAyudaRol);

function abrirModalUsuario(u) {
	formUsuario.reset();
	document.getElementById('modal-usuario-mensaje').innerHTML = '';
	const editando = !!u;
	document.getElementById('modal-usuario-titulo').textContent = editando ? `Editar: ${u.usuario}` : 'Nuevo Usuario';
	document.getElementById('usuario-id').value = editando ? u.id : '';
	document.getElementById('usuario-usuario').value = editando ? u.usuario : '';
	document.getElementById('usuario-correo').value = editando ? u.correo : '';
	document.getElementById('usuario-rol').value = editando ? u.rol_id : 2;

	// Un administrador no puede quitarse su propio rol (también lo impide el servidor)
	const esYo = editando && String(u.id) === String(usuarioActualId);
	document.getElementById('usuario-rol').disabled = esYo;

	const password = document.getElementById('usuario-password');
	password.required = !editando;
	document.getElementById('usuario-password-label').textContent = editando
		? 'Nueva contraseña (vacío = no cambiar)'
		: 'Contraseña *';

	actualizarAyudaRol();
	modalUsuario.classList.add('activo');
}

function cerrarModalUsuario() {
	modalUsuario.classList.remove('activo');
}

document.getElementById('btn-nuevo-usuario').addEventListener('click', () => abrirModalUsuario(null));
document.getElementById('btn-cancelar-usuario').addEventListener('click', cerrarModalUsuario);
modalUsuario.addEventListener('click', (e) => {
	if (e.target === modalUsuario) cerrarModalUsuario();
})

formUsuario.addEventListener('submit', async (e) => {
	e.preventDefault();
	const id = valorDe('usuario-id');
	const password = valorDe('usuario-password');

	if (password !== valorDe('usuario-password2')) {
		mostrarMensajeModal('Las contraseñas no coinciden', 'error');
		return;
	}

	const formData = new FormData(formUsuario);
	// El select deshabilitado (uno mismo) no viaja en el formulario
	formData.set('rol_id', valorDe('usuario-rol'));
	if (id) {
		formData.set('password_nueva', password);
	} else {
		formData.set('password', password);
	}

	try {
		const url = id ? '/api/api_usuario_admin_editar.php' : '/api/api_register_user.php';
		const response = await fetch(url, { method: 'POST', body: formData });
		const result = await response.json();
		if (result.success) {
			cerrarModalUsuario();
			cargarUsuarios();
		} else {
			mostrarMensajeModal(result.message || 'No se pudo guardar el usuario', 'error');
		}
	} catch (error) {
		console.error(error);
		mostrarMensajeModal('Error al guardar el usuario', 'error');
	}
})

// ===== ACTIVAR / DESACTIVAR =====

document.getElementById('tabla-usuarios').addEventListener('click', async (e) => {
	const btnEditar = e.target.closest('.btn-editar');
	if (btnEditar) {
		const u = usuariosCache.find(x => String(x.id) === btnEditar.dataset.id);
		if (u) abrirModalUsuario(u);
		return;
	}

	const btnEstado = e.target.closest('.btn-estado');
	if (!btnEstado) return;
	const u = usuariosCache.find(x => String(x.id) === btnEstado.dataset.id);
	const activar = btnEstado.dataset.activo === '1';
	const pregunta = activar
		? `¿Reactivar a ${u.usuario}? Podrá volver a iniciar sesión.`
		: `¿Desactivar a ${u.usuario}? No podrá iniciar sesión y, si está conectado, se le cerrará la sesión.`;
	if (!confirm(pregunta)) return;

	try {
		const formData = new FormData();
		formData.set('id', u.id);
		formData.set('activo', btnEstado.dataset.activo);
		const response = await fetch('/api/api_usuario_estado.php', { method: 'POST', body: formData });
		const result = await response.json();
		if (result.success) {
			cargarUsuarios();
		} else {
			alert(result.message || 'No se pudo cambiar el estado');
		}
	} catch (error) {
		console.error(error);
		alert('Error al cambiar el estado del usuario');
	}
})

async function iniciar() {
	await cargarRoles();
	await cargarUsuarios();
}
iniciar();
