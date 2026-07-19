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
