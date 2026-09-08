// Roles permitidos por página: null = cualquier rol autenticado
const PAGE_ROLES = {
    '/home':        [1],
    '/asistencia':  [3],
    '/inicio':      [2],
    '/register':    [1],
    '/users':       [1],
};

function getSession() {
    const usuario = localStorage.getItem('usuario');
    const rol_id  = parseInt(localStorage.getItem('rol_id'));
    if (!usuario || !rol_id) return null;
    return { usuario, rol_id };
}

function logout() {
    localStorage.removeItem('usuario_id');
    localStorage.removeItem('usuario');
    localStorage.removeItem('rol_id');
    window.location.href = '/login';
}

function checkSession() {
    const session = getSession();
    if (!session) {
        window.location.href = '/login';
        return;
    }

    const path    = window.location.pathname;
    const allowed = PAGE_ROLES[path];
    if (allowed && !allowed.includes(session.rol_id)) {
        window.location.href = '/login';
        return;
    }

    // Mostrar nombre de usuario si existe el elemento
    const el = document.getElementById('session-usuario');
    if (el) el.textContent = session.usuario;

    const welcomeEl = document.getElementById('welcome-usuario');
    if (welcomeEl) welcomeEl.textContent = session.usuario;
}

document.addEventListener('DOMContentLoaded', checkSession);

// ===== FOTO DE PERFIL EN EL NAVBAR =====

function mostrarFotoNav(fotoPerfil) {
	const navImg = document.getElementById('nav-profile-img');
	if (navImg && fotoPerfil) {
		navImg.src = '/' + fotoPerfil;
	}
}

document.addEventListener('DOMContentLoaded', async () => {
	const usuarioId = localStorage.getItem('usuario_id');
	if (!usuarioId) return;

	try {
		const response = await fetch(`http://localhost:8000/templates/api_usuario_detalle.php?id=${usuarioId}`);
		const result = await response.json();
		if (result.success) mostrarFotoNav(result.usuario.foto_perfil);
	} catch (error) {
		console.error(error);
	}
})

// ===== MODAL EDITAR CUENTA =====

document.addEventListener('DOMContentLoaded', () => {
	const btnAbrirCuenta = document.getElementById('btn-abrir-cuenta');
	const modalCuenta = document.getElementById('modal-cuenta');
	if (!btnAbrirCuenta || !modalCuenta) return;

	const formCuenta = document.getElementById('form-editar-cuenta');
	const mensajeCuenta = document.getElementById('modal-cuenta-mensaje');
	const fotoPreview = document.getElementById('cuenta-foto-preview');
	const fotoPlaceholder = document.getElementById('cuenta-foto-placeholder');
	const fotoInput = document.getElementById('cuenta-foto-input');
	const fotoBase64Input = document.getElementById('cuenta-foto-base64');

	function mostrarMensajeCuenta(texto, tipo) {
		mensajeCuenta.innerHTML = `<p class="${tipo}">${tipo === 'error' ? '❌' : '✅'} ${texto}</p>`;
	}

	function setFotoPreview(src) {
		if (src) {
			fotoPreview.src = src;
			fotoPreview.style.display = 'block';
			fotoPlaceholder.style.display = 'none';
		} else {
			fotoPreview.style.display = 'none';
			fotoPlaceholder.style.display = 'flex';
		}
	}

	function cerrarModalCuenta() {
		modalCuenta.classList.remove('activo');
		formCuenta.reset();
		fotoBase64Input.value = '';
		setFotoPreview(null);
		mensajeCuenta.innerHTML = '';
	}

	btnAbrirCuenta.addEventListener('click', async (e) => {
		e.preventDefault();

		const usuarioId = localStorage.getItem('usuario_id');
		if (!usuarioId) {
			alert('Tu sesión es antigua y no tiene el id de usuario guardado. Cerrá sesión y volvé a entrar para poder editar tu cuenta.');
			return;
		}

		try {
			const response = await fetch(`http://localhost:8000/templates/api_usuario_detalle.php?id=${usuarioId}`);
			const result = await response.json();

			if (!result.success) {
				alert(result.message || 'No se pudo cargar la cuenta');
				return;
			}

			document.getElementById('cuenta-id').value = result.usuario.id;
			document.getElementById('cuenta-usuario').value = result.usuario.usuario;
			document.getElementById('cuenta-correo').value = result.usuario.correo || '';
			setFotoPreview(result.usuario.foto_perfil ? '/' + result.usuario.foto_perfil : null);

			modalCuenta.classList.add('activo');
		} catch (error) {
			console.error(error);
			alert('Error al cargar los datos de la cuenta');
		}
	})

	document.getElementById('btn-cambiar-foto').addEventListener('click', () => fotoInput.click());

	fotoInput.addEventListener('change', () => {
		const file = fotoInput.files[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) {
			alert('La imagen supera los 2MB permitidos');
			fotoInput.value = '';
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			fotoBase64Input.value = reader.result;
			setFotoPreview(reader.result);
		};
		reader.readAsDataURL(file);
	})

	document.getElementById('btn-cancelar-cuenta').addEventListener('click', cerrarModalCuenta);
	modalCuenta.addEventListener('click', (e) => {
		if (e.target === modalCuenta) cerrarModalCuenta();
	})

	formCuenta.addEventListener('submit', async (e) => {
		e.preventDefault();

		try {
			const formData = new FormData(formCuenta);
			const response = await fetch('http://localhost:8000/templates/api_usuario_editar.php', {
				method: 'POST',
				body: formData
			});
			const result = await response.json();

			if (result.success) {
				localStorage.setItem('usuario', result.usuario);
				const sessionEl = document.getElementById('session-usuario');
				if (sessionEl) sessionEl.textContent = result.usuario;
				const welcomeEl = document.getElementById('welcome-usuario');
				if (welcomeEl) welcomeEl.textContent = result.usuario;
				mostrarFotoNav(result.foto_perfil);

				mostrarMensajeCuenta('Cuenta actualizada correctamente', 'success');
				setTimeout(cerrarModalCuenta, 1200);
			} else {
				mostrarMensajeCuenta(result.message || 'No se pudo actualizar la cuenta', 'error');
			}
		} catch (error) {
			console.error(error);
			mostrarMensajeCuenta('Error al actualizar la cuenta', 'error');
		}
	})
})
