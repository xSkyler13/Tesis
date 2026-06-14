const MAX_INTENTOS = 3;
    let intentosUsados = 0;

    const modal        = document.getElementById('modal-camara');
    const video        = document.getElementById('video-cam');
    const canvas       = document.getElementById('canvas-cam');
    const previewImg   = document.getElementById('preview-img');
    const statusLabel  = document.getElementById('foto-label-status');
    const base64Input  = document.getElementById('foto_base64');
    const btnAbrir     = document.getElementById('btn-abrir-camara');
    const btnCapturar  = document.getElementById('btn-capturar');
    const intentosNum  = document.getElementById('intentos-num');
    let stream         = null;

    function actualizarContador() {
        const restantes = MAX_INTENTOS - intentosUsados;
        intentosNum.textContent = restantes;
        intentosNum.style.color = restantes === 1 ? 'red' : '#333';
    }
    btnAbrir.addEventListener('click', () => {
        if (intentosUsados >= MAX_INTENTOS) return;
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(s => {
                stream = s;
                video.srcObject = s;
                actualizarContador();
                modal.classList.add('activo');
            })
            .catch(() => alert('❌ No se pudo acceder a la cámara'));
    });
    function cerrarModal() {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
        }
        modal.classList.remove('activo');
    }
    btnCapturar.addEventListener('click', () => {
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

        base64Input.value        = dataUrl;
        previewImg.src           = dataUrl;
        previewImg.style.display = 'block';
        intentosUsados++;

        const restantes = MAX_INTENTOS - intentosUsados;
        if (restantes === 0) {
            statusLabel.innerHTML  = '✅ Foto capturada — <span style="color:red">sin más intentos</span>';
            btnAbrir.disabled      = true;
            btnAbrir.style.opacity = '0.5';
            btnAbrir.title         = 'Límite de intentos alcanzado';
        } else {
            statusLabel.textContent = `✅ Foto capturada (${restantes} intento${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''})`;
        }
        cerrarModal();
    });
    document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModal);

    // Limpiar solo resetea foto, NO los intentos
    document.getElementById('btn-limpiar').addEventListener('click', () => {
        base64Input.value        = '';
        previewImg.src           = '';
        previewImg.style.display = 'none';
        const restantes = MAX_INTENTOS - intentosUsados;
        statusLabel.textContent  = restantes > 0
            ? `Sin foto capturada (${restantes} intento${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''})`
            : 'Sin foto — límite de intentos alcanzado';
    });

    // Advertencia si registra sin foto
    document.getElementById('form-registro').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (base64Input.value === '') {
            const confirmar = confirm(
                '⚠️ No capturaste una foto.\n' +
                'Sin foto, este usuario NO podrá usar el login facial.\n\n' +
                '¿Deseas continuar?'
            );
            if (!confirmar) {
                return;
            }
        }

        const formData = new FormData();

        formData.append(
            'usuario',
            document.getElementById('usuario').value
        );
        formData.append(
            'correo',
            document.getElementById('correo').value
        );
        formData.append(
            'password',
            document.getElementById('password').value
        );
        formData.append(
            'rol_id',
            document.getElementById('rol_id').value
        );
        formData.append(
            'foto_base64',
            base64Input.value
        );
        try {

            const response = await fetch(
                'http://localhost:8000/templates/api_register_user.php',
                {
                    method: 'POST',
                    body: formData
                }
            );

            const data = await response.json();

            const mensaje = document.getElementById('mensaje');

            if (data.success) {
                // Llamar a Flask directamente para guardar encoding facial
                const fotoVal = base64Input.value;
                const usuarioVal = document.getElementById('usuario').value;
                if (fotoVal) {
                    const flaskForm = new FormData();
                    flaskForm.append('name', usuarioVal);
                    flaskForm.append('image', fotoVal);
                    fetch('http://localhost:5001/save_face', { method: 'POST', body: flaskForm })
                        .catch(() => {});
                }

                mensaje.innerHTML =
                    '<p class="success">✅ Usuario registrado correctamente.</p>';
                document.getElementById('form-registro').reset();
                previewImg.style.display = 'none';
                base64Input.value = '';
            } else {
                mensaje.innerHTML =
                    `<p class="error">❌ ${data.message}</p>`;
            }
        } catch(error) {
            console.error(error);
            document.getElementById('mensaje').innerHTML = '<p class="error">❌ Error de conexión con la API.</p>';
        }

    });

    async function cargarRoles() {

        try {
            const response = await fetch(
                "http://localhost:8000/templates/api_register.php"
            );
            const result = await response.json();

            const select = document.getElementById("rol_id");
            select.innerHTML = '<option value="">-- Seleccione un rol --</option>';

            result.forEach(rol => {
                const option = document.createElement("option");
                option.value = rol.id;
                option.textContent = rol.nombre;
                select.appendChild(option);
            });
        } catch(error) {
            console.error(error);
            document.getElementById("rol_id").innerHTML = '<option value="">Error al cargar roles</option>';
        }
    }
    cargarRoles();