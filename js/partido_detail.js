// Logic for Partido Detail Page
async function renderMatchDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('id');
    
    if (!matchId) {
        window.location.href = 'partidos.html';
        return;
    }

    // Ensure data is loaded
    if (allMatches.length === 0) {
        await loadMatches();
    }

    const match = allMatches.find(m => m.ID === matchId);
    if (!match) {
        document.body.innerHTML = '<div style="color:white; text-align:center; padding:5rem;">Partido no encontrado. <a href="partidos.html" style="color:var(--accent-primary)">Volver</a></div>';
        return;
    }

    // Fill UI
    document.getElementById('m-tourney').innerText = match.torneo || 'AMISTOSO';
    document.getElementById('score-home').innerText = match.GF || '0';
    document.getElementById('score-away').innerText = match.GC || '0';
    document.getElementById('team-away').innerText = match.VS || 'Rival';
    document.getElementById('m-date').innerText = match.FECHA || '--/--/----';
    document.getElementById('m-venue').innerText = match.LUGAR || 'No especificado';

    // Goleadores (Home)
    const homeEvents = document.getElementById('home-events');
    if (match.GOLES) {
        const goals = match.GOLES.split(',').map(g => g.trim());
        homeEvents.innerHTML = goals.map(g => `
            <div class="event-item">
                <span>${g}</span>
                <i class="ph-fill ph-soccer-ball event-icon goal"></i>
            </div>
        `).join('');
    } else {
        homeEvents.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Sin goles registrados.</div>';
    }

    // Rival events (Away) - Just a placeholder or simple logic
    const awayEvents = document.getElementById('away-events');
    awayEvents.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Sin incidencias registradas.</div>';
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the detail page
    if (document.getElementById('m-tourney')) {
        renderMatchDetail();
    }
});
