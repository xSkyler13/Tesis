function skeletonFilasTabla(numColumnas, numFilas = 5) {
	let html = '';
	for (let f = 0; f < numFilas; f++) {
		let celdas = '';
		for (let c = 0; c < numColumnas; c++) {
			celdas += `<td><div class="skeleton skeleton-text"></div></td>`;
		}
		html += `<tr>${celdas}</tr>`;
	}
	return html;
}

function skeletonListaItems(claseItem, numItems = 4) {
	let html = '';
	for (let i = 0; i < numItems; i++) {
		html += `
			<li class="${claseItem}">
				<div class="skeleton-row-item">
					<span class="skeleton skeleton-circle"></span>
					<div class="skeleton-lines">
						<div class="skeleton skeleton-text w-60"></div>
						<div class="skeleton skeleton-text w-40"></div>
					</div>
				</div>
			</li>
		`;
	}
	return html;
}
