function formatHoraEvento(fechaStr) {
	const d = new Date(fechaStr.replace(' ', 'T'));
	return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function badgeEvento(tipoEvento) {
	switch (tipoEvento) {
		case 'entrada': return { icono: 'success', check: 'bx-check', badge: 'success', texto: 'Ingresó' };
		case 'salida': return { icono: 'info', check: 'bx-log-out', badge: 'info', texto: 'Salió' };
		default: return { icono: 'warning', check: 'bx-error', badge: 'warning', texto: 'Alerta' };
	}
}

function renderListaAccesos(eventos) {
	const lista = document.getElementById('lista-accesos-tiempo-real');

	if (!eventos || eventos.length === 0) {
		lista.innerHTML = '<li class="access-item"><p class="table-empty">Sin accesos registrados todavía</p></li>';
		return;
	}

	lista.innerHTML = eventos.map(ev => {
		const b = badgeEvento(ev.tipo_evento);
		const avatar = ev.foto
			? `<img class="avatar" src="/${ev.foto}" alt="">`
			: `<span class="avatar avatar-placeholder"><i class='bx bx-user'></i></span>`;

		return `
			<li class="access-item">
				<div class="access-row">
					<span class="status-icon ${b.icono}"><i class='bx ${b.check}'></i></span>
					<span class="access-time">${formatHoraEvento(ev.fecha_hora)}</span>
					${avatar}
					<div class="access-info">
						<p class="access-name">${ev.nombre}</p>
						<span class="access-sub">${ev.detalle}</span>
					</div>
					<span class="badge-status ${b.badge}">${b.texto}</span>
				</div>
			</li>
		`;
	}).join('');
}

let primeraCargaDashboard = true;

async function cargarDashboardHome() {
	if (primeraCargaDashboard) {
		document.getElementById('lista-accesos-tiempo-real').innerHTML = skeletonListaItems('access-item');
	}
	try {
		const response = await fetch('http://localhost:8000/templates/api_home_dashboard.php');
		const result = await response.json();

		document.getElementById('stat-accesos-hoy').textContent = result.accesos_hoy;
		document.getElementById('stat-residentes-dentro').textContent = result.residentes_dentro;
		document.getElementById('stat-visitas-activas').textContent = result.visitas_activas_hoy;
		document.getElementById('stat-alertas-hoy').textContent = result.alertas_hoy;

		renderListaAccesos(result.eventos);
	} catch (error) {
		console.error(error);
	} finally {
		primeraCargaDashboard = false;
	}
}

cargarDashboardHome();
setInterval(cargarDashboardHome, 20000);

// ===== VISITAS PENDIENTES =====

function formatDiaVisita(fecha) {
	const d = new Date(fecha + 'T00:00:00');
	return d.toDateString() === new Date().toDateString() ? 'Hoy' : d.toLocaleDateString('es-ES');
}

function renderVisitasPendientes(visitas) {
	const lista = document.getElementById('lista-visitas-pendientes');
	if (!lista) return;

	if (!visitas || visitas.length === 0) {
		lista.innerHTML = '<li class="visitor-item"><p class="table-empty">Sin visitas pendientes</p></li>';
		return;
	}

	lista.innerHTML = visitas.map(v => `
		<li class="visitor-item" data-id="${v.id}">
			<span class="avatar avatar-placeholder"><i class='bx bx-user'></i></span>
			<div class="visitor-info">
				<p class="visitor-name">${v.nombres_visitante}</p>
				<span class="visitor-detail">Visita a: ${v.residente_nombre} - ${v.torre_nombre} Dep ${v.depto_numero}</span>
			</div>
			<div class="visitor-meta">
				<span class="visitor-time">${v.hora_ingreso ? v.hora_ingreso.slice(0, 5) : ''}</span>
				<span class="visitor-day">${formatDiaVisita(v.fecha_visita)}</span>
			</div>
			<div class="visitor-actions">
				<button type="button" class="btn-authorize" data-decision="Permitido"><i class='bx bx-check'></i> Autorizar</button>
				<button type="button" class="btn-reject" data-decision="Denegado"><i class='bx bx-x'></i> Denegar</button>
			</div>
		</li>
	`).join('');
}

let primeraCargaVisitas = true;

async function cargarVisitasPendientes() {
	if (primeraCargaVisitas) {
		document.getElementById('lista-visitas-pendientes').innerHTML = skeletonListaItems('visitor-item');
	}
	try {
		const response = await fetch('http://localhost:8000/templates/api_visitas_pendientes.php');
		const visitas = await response.json();
		renderVisitasPendientes(visitas);
	} catch (error) {
		console.error(error);
	} finally {
		primeraCargaVisitas = false;
	}
}
cargarVisitasPendientes();
setInterval(cargarVisitasPendientes, 20000);

const listaVisitasPendientes = document.getElementById('lista-visitas-pendientes');
if (listaVisitasPendientes) {
	listaVisitasPendientes.addEventListener('click', async (e) => {
		const btn = e.target.closest('button[data-decision]');
		if (!btn) return;

		const item = btn.closest('.visitor-item');
		const id = item.dataset.id;
		const decision = btn.dataset.decision;

		btn.parentElement.querySelectorAll('button').forEach(b => b.disabled = true);

		try {
			const formData = new FormData();
			formData.set('id', id);
			formData.set('decision', decision);
			const response = await fetch('http://localhost:8000/templates/api_visita_decidir.php', {
				method: 'POST',
				body: formData
			});
			const result = await response.json();

			if (result.success) {
				cargarVisitasPendientes();
				cargarDashboardHome();
			} else {
				alert(result.message || 'No se pudo procesar la visita');
				btn.parentElement.querySelectorAll('button').forEach(b => b.disabled = false);
			}
		} catch (error) {
			console.error(error);
			alert('Error al procesar la visita');
			btn.parentElement.querySelectorAll('button').forEach(b => b.disabled = false);
		}
	})
}
