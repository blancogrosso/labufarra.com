// Lógica para la página de Historial vs Rival
document.addEventListener('DOMContentLoaded', () => {
    // Solo ejecutar si existe el elemento de visualización del rival
    if (!document.getElementById('rivalMatchesContainer')) return;

    const params = new URLSearchParams(window.location.search);
    const rivalName = params.get('nombre');

    if (!rivalName) {
        window.location.href = 'index.html';
        return;
    }

    // Esperar a que db.js cargue los datos
    const checkData = setInterval(() => {
        if (window.dataLoaded) {
            clearInterval(checkData);
            renderRivalStats(rivalName);
        }
    }, 100);
});

function renderRivalStats(name) {
    const rivalMatches = window.allMatches.filter(m => 
        (m.VS || m.rival || '').toUpperCase() === name.toUpperCase()
    );

    document.getElementById('rivalNameDisplay').innerText = name;
    const shield = getRivalShield(name);
    if (shield) document.getElementById('rivalShield').src = shield;

    let pj = rivalMatches.length;
    let v = 0, e = 0, d = 0;
    
    rivalMatches.forEach(m => {
        const res = m.resultado || m.RESULTADO || '';
        const resType = res.toString().toLowerCase().startsWith('v') ? 'V' : 
                      (res.toString().toLowerCase().startsWith('e') ? 'E' : 'D');
        if (resType === 'V') v++;
        else if (resType === 'E') e++;
        else d++;
    });

    document.getElementById('statPJ').innerText = pj;
    document.getElementById('statV').innerText = v;
    document.getElementById('statE').innerText = e;
    document.getElementById('statD').innerText = d;

    const container = document.getElementById('rivalMatchesContainer');
    if (rivalMatches.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:3rem; color:#888;">No hay registros históricos contra este rival.</div>';
        return;
    }

    container.innerHTML = rivalMatches.map(m => {
        const res = m.resultado || m.RESULTADO || '';
        const resType = res.toString().toLowerCase().startsWith('v') ? 'V' : 
                      (res.toString().toLowerCase().startsWith('e') ? 'E' : 'D');
        const badgeClass = `res-${resType.toLowerCase()}`;
        
        let scoreDisplay = "";
        if (m.GF !== undefined && m.GC !== undefined && m.GF !== "" && m.GC !== "") {
            scoreDisplay = `${m.GF} - ${m.GC}`;
            const extra = res.toString().match(/\((.*)\)/);
            if (extra) scoreDisplay += ` (${extra[1]})`;
        } else {
            scoreDisplay = res || '?-?';
        }

        return `
            <div class="match-row">
                <div style="flex: 1;">
                    <div style="font-size: 0.75rem; color: #888; font-weight: 700;">${m.FECHA}</div>
                    <div style="font-weight: 800; font-family: var(--font-display);">${m.torneo || 'Torneo'}</div>
                </div>
                <div style="flex: 1; text-align: center; font-size: 1.2rem; font-weight: 900; font-family: var(--font-display);">
                    ${scoreDisplay}
                </div>
                <div style="flex: 1; text-align: right;">
                    <span class="res-badge ${badgeClass}">${resType}</span>
                    <div style="font-size: 0.7rem; color: #aaa; margin-top: 4px;">${m.LUGAR || ''}</div>
                </div>
            </div>
        `;
    }).join('');
}

function getResultType(score) {
    if (!score || !score.includes('x')) return 'D';
    const [gf, gc] = score.split('x').map(Number);
    if (gf > gc) return 'V';
    if (gf === gc) return 'E';
    return 'D';
}
