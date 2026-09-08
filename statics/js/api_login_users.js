document.querySelector('.form_login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('usuario', document.getElementById('usuario').value);
    formData.append('password', document.getElementById('password').value);

    try {
        const response = await fetch(
            'http://localhost:8000/templates/api_login_user.php',
            { method: 'POST', body: formData }
        );

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('usuario_id', data.data.id);
            localStorage.setItem('usuario', data.data.usuario);
            localStorage.setItem('rol_id', data.data.rol_id);

            const rutas = {
                1: '/home',
                2: '/inicio',
                3: '/asistencia'
            };
            const rol = data.data.rol_id;
            window.location.href = rutas[rol] ?? '/home';
        } else {
            alert('❌ ' + data.message);
        }

    } catch (error) {
        console.error(error);
        alert('❌ Error de conexión con la API.');
    }
});
