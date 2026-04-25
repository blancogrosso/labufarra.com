let currentFilter = 'ALL';
// allMatches is inherited globally from db.js
let currentYearFilter = 'ALL';
let currentTournamentFilter = 'ALL';
let currentResultFilter = 'ALL';
let currentRivalFilter = '';

// En caso de que cargue súper rápido o desde cache
if (window.dataLoaded || (window.allMatches && window.allMatches.length > 0)) {
    renderAllMatches();
    initCounter();
} else {
    document.addEventListener('dataLoaded', () => {
        renderAllMatches();
        initCounter();
    });
}
window.renderAll = renderAllMatches;

function renderAllMatches() {
    const container = document.getElementById('allMatchesContainer');
    if (!container) return;

    if (!window.allMatches || window.allMatches.length === 0) {
        if (window.dataLoaded) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 3rem;">No hay partidos cargados.</div>';
        }
        return;
    }

    // Filter matches that have a result
    const validMatches = allMatches.filter(m => m.VS && m.RESULTADO);
    
    // Apply Year and Tournament Filters
    const filteredMatches = validMatches.filter(m => {
        // Extract year from FECHA using the same logic as db.js and efemerides
        let matchYear = "";
        if (m.FECHA && m.FECHA.includes('/')) {
            const parts = String(m.FECHA).split('/');
            if (parts.length >= 3) {
                let yrPiece = parts[2].split(' ')[0].trim(); // Remove any time strings "00:00"
                matchYear = yrPiece.length === 2 ? "20" + yrPiece : yrPiece;
            }
        }

        const torneo = (m.torneo || "").toLowerCase();
        const torneoBase = (m.torneo_base || "").toLowerCase();

        // Apply Year Filter
        let passesYearFilter = true;
        if (currentYearFilter === 'AMISTOSOS') {
            passesYearFilter = torneo.includes('amistoso');
        } else if (currentYearFilter !== 'ALL') {
            passesYearFilter = (matchYear === currentYearFilter);
        }
        if (!passesYearFilter) return false;

        // Apply Tournament Filter
        let passesTournamentFilter = true;
        if (currentYearFilter !== 'ALL' && currentYearFilter !== 'AMISTOSOS' && currentTournamentFilter !== 'ALL') {
            const filterTerm = currentTournamentFilter.toLowerCase();
            if (!torneoBase.includes(filterTerm) && !torneo.includes(filterTerm)) {
                passesTournamentFilter = false;
            }
        }
        if (!passesTournamentFilter) return false;

        // Apply Rival Filter
        if (currentRivalFilter) {
            const rival = (m.VS || '').toLowerCase();
            if (!rival.includes(currentRivalFilter)) return false;
        }

        // Apply Result Filter
        if (currentResultFilter !== 'ALL') {
            const resInfo = getResultClass(m.RESULTADO);
            if (resInfo.class !== `res-${currentResultFilter}`) return false;
        }

        return true;
    });

    if (filteredMatches.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-muted);">No se encontraron partidos para este filtro.</div>`;
        return;
    }

    container.innerHTML = '';
    
    // Sort matches
    const displayMatches = [...filteredMatches];
    if (currentSortOrder === 'newest') {
        displayMatches.sort((a, b) => parseDateForSort(b.FECHA) - parseDateForSort(a.FECHA));
    } else {
        displayMatches.sort((a, b) => parseDateForSort(a.FECHA) - parseDateForSort(b.FECHA));
    }

    displayMatches.forEach(match => {
        const resultInfo = getResultClass(match.RESULTADO);
        const scoreFormatted = match.RESULTADO.replace('x', ' - ');
        
        // Try parsing date for the badge
        let day = '--';
        let monthStr = 'S/D';
        if (match.FECHA && match.FECHA.includes('/')) {
            const parts = match.FECHA.split('/');
            // Strictly D/M/YYYY
            day = parts[0] || '--';
            const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const mIdx = parts[1] ? parseInt(parts[1]) - 1 : -1;
            monthStr = monthNames[mIdx] || 'S/D';
            if (parts[2]) {
                const yrP = parts[2].trim();
                const yrF = yrP.length === 2 ? `20${yrP}` : yrP;
                monthStr += ` ${yrF.substring(0,4)}`;
            }
        }

        const card = document.createElement('a');
        card.className = 'match-card-full';
        card.href = `partido.html?id=${match.ID}`;
        card.style.textDecoration = 'none';
        card.style.color = 'inherit';
        
        const rivalShield = getRivalShield(match.VS);
        let goalsStr = match.GOLES ? `<div class="goalscorers" style="font-size:0.8rem; opacity:0.7; margin-bottom:1rem;"><i class="ph-bold ph-soccer-ball"></i> ${match.GOLES}</div>` : '';

        card.innerHTML = `
            <div class="match-date-badge">
                <span class="day">${day.padStart(2, '0')}</span>
                <span class="month">${monthStr}</span>
            </div>
            
            <div class="match-content">
                <div class="match-header">
                    <span class="match-tournament">${match.torneo || 'Torneo'}</span>
                    <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Click para detalles</span>
                </div>
                
                <div class="match-teams">
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <span class="team-home">LA BUFARRA</span>
                            <img src="img/logo/ESCUDO_BUFARRA.png" style="width:30px; height:30px; object-fit:contain;">
                        </div>
                    </div>

                    <div class="match-score" style="background: ${getBgScore(resultInfo.class)}">
                        ${scoreFormatted}
                    </div>

                    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:0.5rem;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            ${rivalShield ? `<img src="${rivalShield}" style="width:30px; height:30px; object-fit:contain;">` : '<i class="ph ph-shield" style="font-size:30px; opacity:0.1;"></i>'}
                            <span class="team-away">${match.VS}</span>
                        </div>
                    </div>
                </div>
                
                ${goalsStr}
                
                <div class="match-footer">
                    <span class="match-detail"><i class="ph-bold ph-map-pin"></i> ${match.LUGAR || 'TBD'}</span>
                    ${match.HORA ? `<span class="match-detail"><i class="ph-bold ph-clock"></i> ${match.HORA} HS</span>` : ''}
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Sort filter logic
let currentSortOrder = 'newest';
const sortSelect = document.createElement('div');
sortSelect.className = 'filters-bar';
sortSelect.style.marginBottom = '1rem';
sortSelect.innerHTML = `
    <button class="filter-btn active" data-sort="newest">Más recientes</button>
    <button class="filter-btn" data-sort="oldest">Más antiguos</button>
`;
document.querySelector('.filters-container').prepend(sortSelect);

const sortBtns = sortSelect.querySelectorAll('.filter-btn');
sortBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        sortBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentSortOrder = e.target.getAttribute('data-sort');
        renderAllMatches();
    });
});

function getBgScore(className) {
    if(className === 'res-W') return 'rgba(39, 174, 96, 0.2)';
    if(className === 'res-D') return 'rgba(243, 156, 18, 0.2)';
    if(className === 'res-L') return 'rgba(192, 57, 43, 0.2)';
    return 'rgba(255,255,255,0.1)';
}

function getResultClass(resultado) {
    if(!resultado) return { class: 'res-D', letter: '?' };
    const scoreParts = resultado.toLowerCase().split('x');
    if(scoreParts.length === 2) {
        const gf = parseInt(scoreParts[0]);
        const gc = parseInt(scoreParts[1]);
        if (gf > gc) return { class: 'res-W', letter: 'V' };
        if (gf === gc) return { class: 'res-D', letter: 'E' };
        if (gf < gc) return { class: 'res-L', letter: 'D' };
    }
    return { class: 'res-D', letter: '-' };
}

// Filters logic
// Year filter events
const yearBtns = document.querySelectorAll('#yearFilters .filter-btn');
const subFiltersDiv = document.getElementById('tournamentFilters');
const tourneyBtns = document.querySelectorAll('#tournamentFilters .filter-btn');

yearBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        yearBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const year = e.target.getAttribute('data-year');
        currentYearFilter = year;
        
        // Si es un año puntual, mostramos subfiltros
        if (year !== 'ALL' && year !== 'AMISTOSOS') {
            updateTournamentPills(year);
            subFiltersDiv.style.display = 'flex';
            currentTournamentFilter = 'ALL';
        } else {
            subFiltersDiv.style.display = 'none';
            currentTournamentFilter = 'ALL';
        }

        renderAllMatches();
    });
});

function updateTournamentPills(year) {
    const tourneyContainer = document.getElementById('tournamentFilters');
    if (!tourneyContainer) return;

    // Find all tournaments for this year
    const yearMatches = allMatches.filter(m => {
        if (!m.FECHA || !m.FECHA.includes('/')) return false;
        const parts = m.FECHA.split('/');
        if (parts.length < 3) return false;
        let yr = parts[2].split(' ')[0].trim();
        yr = yr.length === 2 ? "20" + yr : yr;
        return yr === year;
    });

    // Get unique tournaments and their latest match date for sorting
    const tourneyMap = {};
    yearMatches.forEach(m => {
        const name = m.torneo_base || m.torneo || 'Amistoso';
        if (name.toLowerCase().includes('amistoso')) return; // Skip Amistosos from here
        
        const dateScore = parseDateForSort(m.FECHA);
        if (!tourneyMap[name] || dateScore > tourneyMap[name]) {
            tourneyMap[name] = dateScore;
        }
    });

    const sortedTourneys = Object.keys(tourneyMap).sort((a, b) => tourneyMap[b] - tourneyMap[a]);

    let html = `<button class="filter-btn active" data-tournament="ALL">Todos</button>`;
    sortedTourneys.forEach(t => {
        html += `<button class="filter-btn" data-tournament="${t}">${t}</button>`;
    });
    
    // Always add Amistosos at the end
    html += `<button class="filter-btn" data-tournament="Amistoso">Amistosos</button>`;
    
    tourneyContainer.innerHTML = html;

    // Re-attach events
    const newBtns = tourneyContainer.querySelectorAll('.filter-btn');
    newBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            newBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTournamentFilter = e.target.getAttribute('data-tournament');
            renderAllMatches();
        });
    });
}

// Rival search event
document.getElementById('rivalSearchInput')?.addEventListener('input', (e) => {
    currentRivalFilter = e.target.value.toLowerCase();
    renderAllMatches();
});

// Tournament filter events
tourneyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        tourneyBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTournamentFilter = e.target.getAttribute('data-tournament');
        renderAllMatches();
    });
});

// Result circle filter events
const resultCircles = document.querySelectorAll('.res-circle-btn');
resultCircles.forEach(btn => {
    btn.addEventListener('click', (e) => {
        resultCircles.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentResultFilter = e.target.getAttribute('data-result');
        renderAllMatches();
    });
});

function initCounter() {
    const validMatches = allMatches.filter(m => m.VS && m.RESULTADO);
    const total = validMatches.length;
    if (total === 0) return;
    
    // Usar la función central de animación de db.js
    window.animateCounter('totalMatchesCounter', total);
}
