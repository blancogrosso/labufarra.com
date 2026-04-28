let currentSort = { column: 'PJ', direction: 'desc' };
// Capture filter from URL
const urlParams = new URLSearchParams(window.location.search);
const filterQuery = urlParams.get('filter');
if (filterQuery) {
    const colMap = { 'goles': 'GOLES', 'asistencias': 'ASISTENCIAS', 'tarjetas': 'tarjetas' };
    if (colMap[filterQuery]) {
        currentSort = { column: colMap[filterQuery], direction: 'desc' };
    }
}
let filteredPlayers = [];
let selectedYears = ['ALL']; // Holds selected years e.g. ['2021', '2023']

// Asegurar que al cargar la página se ejecute el renderizado inicial
document.addEventListener('DOMContentLoaded', () => {
    // Si la DB ya cargó (caso raro de cache), renderizar. 
    // Si no, db.js llamará a window.renderAll al terminar.
    if (window.allPlayers && Object.keys(window.allPlayers).length > 0) {
        applyYearFilters();
    }
});

const PLAYER_MAP = {
    'Alvez': { fullName: 'Lautaro Alvez', aliases: ['Pekeno'] },
    'Anzuatte': { fullName: 'Agustin Anzuatte', aliases: ['Anzu'] },
    'Blanco': { fullName: 'Tomas Blanco', aliases: ['Oso'] },
    'Brito': { fullName: 'Emiliano Brito', aliases: ['Emi'] },
    'Bonilla': { fullName: 'Felipe Bonilla', aliases: ['Feli', 'Boni'] },
    'Cravino': { fullName: 'Agustin Cravino', aliases: ['Cravi'] },
    'Colombo': { fullName: 'Mateo Colombo', aliases: ['Pepo'] },
    'Da Silveira': { fullName: 'Guzman da Silveira', aliases: ['Guz'] },
    'De Leon': { fullName: 'Enzo de Leon', aliases: ['Enzo'] },
    'Dobal': { fullName: 'Federico Dobal', aliases: ['Feche'] },
    'Fernandez': { fullName: 'Geronimo Fernandez', aliases: ['Gero'] },
    'Flores': { fullName: 'Antonio Flores', aliases: ['Antony'] },
    'Iza': { fullName: 'Federico Iza', aliases: ['Fede', 'Iza'] },
    'Lorenzo': { fullName: 'Martin Lorenzo', aliases: ['Tincho'] },
    'Luzardo': { fullName: 'Valentin Luzardo', aliases: ['Luza'] },
    'Martinez': { fullName: 'Miqueas Martinez', aliases: ['Mique', 'Quique'] },
    'Mari': { fullName: 'Pablo Mari', aliases: ['Pablito'] },
    'Mateo': { fullName: 'Santiago Mateo', aliases: ['Santi'] },
    'Menchaca': { fullName: 'Mateo Menchaca', aliases: ['Mencha'] },
    'Molina': { fullName: 'Justiniano Molina', aliases: ['Justi'] },
    'Olarte': { fullName: 'Juan Miguel Olarte', aliases: ['Juan'] },
    'Pedemonte': { fullName: 'Sebastian Pedemonte', aliases: ['Seba', 'Sebita'] },
    'Diego Rocca': { fullName: 'Diego Rocca', aliases: ['Harry', 'Rocca'] },
    'Rocca': { fullName: 'Diego Rocca', aliases: ['Harry', 'Rocca'] },
    'Rodriguez': { fullName: 'Guillermo Rodriguez', aliases: ['Guille'] },
    'Bruno Silva': { fullName: 'Bruno Silva', aliases: ['Bruno', 'Silva'] },
    'Gaston Silva': { fullName: 'Gaston Silva', aliases: ['Junior', 'G. Silva'] },
    'Sparkov': { fullName: 'Santiago Sparkov', aliases: ['Spark', 'Sparky'] },
    'Valle': { fullName: 'Joaquin Valle', aliases: ['Joaco'] },
    'Vigil': { fullName: 'Sebastian Vigil', aliases: ['Seba'] },
    'Balestie': { fullName: 'Kevin Balestie', aliases: ['Kevin'] }
};

function normalizePlayerName(name) {
    if (!name) return "";
    let n = name.trim();
    
    // Hardcoded visual mappings to ensure only Surnames / Short names are rendered
    const visualMap = {
        'Alvez': 'Alvez', 'Lautaro Alvez': 'Alvez',
        'Anzuatte': 'Anzuatte', 'Agustin Anzuatte': 'Anzuatte',
        'Blanco': 'Blanco', 'Tomas Blanco': 'Blanco',
        'Brito': 'Brito', 'Emiliano Brito': 'Brito',
        'Bonilla': 'Bonilla', 'Felipe Bonilla': 'Bonilla',
        'Cravino': 'Cravino', 'Agustin Cravino': 'Cravino',
        'Colombo': 'Colombo', 'Mateo Colombo': 'Colombo',
        'Da Silveira': 'Da Silveira', 'da Silveira': 'Da Silveira', 'Guzman Da Silveira': 'Da Silveira',
        'De Leon': 'De Leon', 'De León': 'De Leon', 'Enzo De Leon': 'De Leon',
        'Dobal': 'Dobal', 'Federico Dobal': 'Dobal',
        'Fernandez': 'Fernandez', 'Geronimo Fernandez': 'Fernandez',
        'Flores': 'Flores', 'Antonio Flores': 'Flores',
        'Iza': 'Iza', 'Federico Iza': 'Iza',
        'Lorenzo': 'Lorenzo', 'Martin Lorenzo': 'Lorenzo',
        'Luzardo': 'Luzardo', 'Valentin Luzardo': 'Luzardo',
        'Martinez': 'Martinez', 'Miqueas Martinez': 'Martinez', 'Martínez': 'Martinez',
        'Mari': 'Mari', 'Pablo Mari': 'Mari',
        'Mateo': 'Mateo', 'Santiago Mateo': 'Mateo',
        'Menchaca': 'Menchaca', 'Mateo Menchaca': 'Menchaca',
        'Molina': 'Molina', 'Justiniano Molina': 'Molina',
        'Olarte': 'Olarte', 'Juan Miguel Olarte': 'Olarte',
        'Pedemonte': 'Pedemonte', 'Sebastian Pedemonte': 'Pedemonte',
        'Diego Rocca': 'Rocca', 'Rocca': 'Rocca',
        'Rodriguez': 'Rodriguez', 'Guillermo Rodriguez': 'Rodriguez',
        'Silva': 'Silva', 'Bruno Silva': 'Silva',
        'Gaston Silva': 'G. Silva', 'G. Silva': 'G. Silva',
        'Sparkov': 'Sparkov', 'Santiago Sparkov': 'Sparkov',
        'Valle': 'Valle', 'Joaquin Valle': 'Valle',
        'Vigil': 'Vigil', 'Sebastian Vigil': 'Vigil',
        'Balestie': 'Balestie', 'Kevin Balestie': 'Balestie'
    };

    if (visualMap[n]) return visualMap[n];
    return n;
}

function normalize_p(p) {
    if (!p) return {};
    return {
        PLAYER: p.PLAYER || p.nombre || p.player_name || '',
        PJ: parseInt(p.PJ ?? p.pj ?? 0),
        PG: parseInt(p.PG ?? p.pg ?? 0),
        PE: parseInt(p.PE ?? p.pe ?? 0),
        PP: parseInt(p.PP ?? p.pp ?? 0),
        GOLES: parseInt(p.GOLES ?? p.goles ?? 0),
        ASISTENCIAS: parseInt(p.ASISTENCIAS ?? p.asistencias ?? 0),
        AMARILLAS: parseInt(p.AMARILLAS ?? p.amarillas ?? 0),
        ROJAS: parseInt(p.ROJAS ?? p.rojas ?? 0),
        MVP: parseInt(p.MVP ?? p.mvp ?? 0)
    };
}

// Initialized directly by db.js when data is ready via applyYearFilters()

function applyYearFilters() {
    if (!window.allPlayers || Object.keys(window.allPlayers).length === 0) return;
    
    let basePlayers = [];
    
    // If 'ALL' is selected, we just use the pre-calculated 'ALL' table
    if (selectedYears.includes('ALL')) {
        const sourceData = window.allPlayers['ALL'] || [];
        basePlayers = sourceData.map(p => {
            const norm = normalize_p(p);
            
            // Búsqueda inteligente por nombre o apellido
            let mapping = null;
            const upperName = norm.PLAYER.toUpperCase();
            for (const [key, info] of Object.entries(PLAYER_MAP)) {
                if (key.toUpperCase() === upperName || info.fullName.toUpperCase() === upperName) {
                    mapping = info;
                    break;
                }
            }
            
            // Calculate win percentage
            let wins = parseInt(norm.PG || 0);
            let total = parseInt(norm.PJ || 0);
            let percent = total > 0 ? Math.round((wins / total) * 100) : 0;
            
            return {
                ...norm,
                DISPLAY_PLAYER: mapping ? mapping.fullName : norm.PLAYER,
                '% PG': `${percent}%`
            };
        });
    } else {
        // Aggregate stats from selected years
        let aggregated = {};
        
        selectedYears.forEach(year => {
            if (year === 'ALL') return;
            const content = window.allPlayers[year];
            if (!content) return;

            let playersArray = [];
            if (Array.isArray(content)) {
                playersArray = content;
            } else {
                // Caso: Objeto con Torneos (Estructura histórica local)
                Object.values(content).forEach(t => {
                    if (Array.isArray(t)) {
                        playersArray.push(...t);
                    } else if (t.jugadores && Array.isArray(t.jugadores)) {
                        playersArray.push(...t.jugadores);
                    }
                });
            }

            playersArray.forEach(p => {
                const norm = normalize_p(p);
                const name = norm.PLAYER;
                if (!name) return;
                
                if (!aggregated[name]) {
                    aggregated[name] = {
                        PLAYER: name,
                        PJ: 0, PG: 0, PE: 0, PP: 0,
                        GOLES: 0, ASISTENCIAS: 0, AMARILLAS: 0, ROJAS: 0
                    };
                }
                aggregated[name].PJ += norm.PJ;
                aggregated[name].PG += norm.PG;
                aggregated[name].PE += norm.PE;
                aggregated[name].PP += norm.PP;
                aggregated[name].GOLES += norm.GOLES;
                aggregated[name].ASISTENCIAS += norm.ASISTENCIAS;
                aggregated[name].AMARILLAS += norm.AMARILLAS;
                aggregated[name].ROJAS += norm.ROJAS;
            });
        });

        // Convert aggregated object back to array, compute percentages
        basePlayers = Object.values(aggregated).map(p => {
            let pgPercent = p.PJ > 0 ? Math.round((p.PG / p.PJ) * 100) : 0;
            p['% PG'] = `${pgPercent}%`;
            
            const normalizedName = normalizePlayerName(p.PLAYER);
            const mapping = PLAYER_MAP[normalizedName];
            p.DISPLAY_PLAYER = mapping ? mapping.fullName : normalizedName;
            
            return p;
        });
    }

    // Apply text search on top of year filtering (covers name, full name and aliases)
    const term = (document.getElementById('searchInput')?.value || '').toLowerCase();
    if (term) {
        filteredPlayers = basePlayers.filter(p => {
            const csvName = (p.PLAYER || '').trim();
            const mapping = PLAYER_MAP[csvName];
            const searchTargets = [csvName.toLowerCase()];
            
            if (mapping) {
                searchTargets.push(mapping.fullName.toLowerCase());
                mapping.aliases.forEach(a => searchTargets.push(a.toLowerCase()));
            }
            
            return searchTargets.some(target => target.includes(term));
        });
    } else {
        filteredPlayers = basePlayers;
    }
    
    // Clear grid and show loading state if needed
    if (filteredPlayers.length === 0) {
        // Only render if we have no players
    }
    renderPlayersGrid();
}

function renderPlayersGrid() {
    const grid = document.getElementById('playersGrid');
    if (!grid) return;
    
    const largeCounter = document.getElementById('playerCountLarge');
    if (largeCounter && !window.playerCounterAnimated) {
        window.animateCounter('playerCountLarge', filteredPlayers.length);
        window.playerCounterAnimated = true;
    } else if (largeCounter) {
        largeCounter.innerText = filteredPlayers.length;
    }

    // Apply Sorting
    filteredPlayers.sort((a, b) => {
        let valA = a[currentSort.column] || '0';
        let valB = b[currentSort.column] || '0';

        if (typeof valA === 'string' && valA.includes('%')) valA = valA.replace('%','');
        if (typeof valB === 'string' && valB.includes('%')) valB = valB.replace('%','');

        if (!isNaN(valA) && !isNaN(valB)) {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
        } else {
            valA = valA.toString().toLowerCase();
            valB = valB.toString().toLowerCase();
        }

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Generate Cards
    grid.innerHTML = '';
    filteredPlayers.forEach(p => {
        const csvName = p.PLAYER;
        const displayName = p.DISPLAY_PLAYER || csvName;
        
        let initial = displayName.charAt(0).toUpperCase();
        let imgPath = `img/jugadores/${csvName}.jpg`;
        
        // Compute dynamic subtitle and stars based on active filter
        let subtitleText = '';
        let statsBlock = '';
        
        const formatDecimal = (num) => parseFloat(num).toFixed(2);
        const goles = parseInt(p.GOLES || 0);
        const pj = parseInt(p.PJ || 0);
        const wins = parseInt(p.PG || 0);
        const draws = parseInt(p.PE || 0);
        const losses = parseInt(p.PP || 0);
        const effective = p['% PG'] || '0%';
        
        // El bloque de V-E-D ahora es constante para todas las vistas
        const vedBlock = `
            <div style="display: flex; gap: 0.8rem; margin-top: 0.5rem; font-size: 0.85rem; font-weight: bold; justify-content: center; width: 100%; color: var(--text-muted);">
                <span style="color: #27ae60">V: ${wins}</span>
                <span style="color: #f39c12">E: ${draws}</span>
                <span style="color: #e74c3c">D: ${losses}</span>
            </div>
        `;

        if (currentSort.column === 'PJ' || currentSort.column === 'PLAYER') {
            subtitleText = `Efectividad: ${effective}`;
            statsBlock = `
                <div class="stat-box" style="flex: 1; justify-content: center; flex-direction: column;">
                    <span class="stat-value" style="font-size: 2.3rem; line-height: 1;">${pj}</span>
                    <span class="stat-label">Partidos Jugados</span>
                    ${vedBlock}
                </div>
            `;
        } else if (currentSort.column === 'GOLES') {
            const prom = pj > 0 ? (goles / pj).toFixed(2) : '0.00';
            subtitleText = `Promedio: ${prom} G/P`;
            statsBlock = `
                <div class="stat-box" style="flex: 1; justify-content: center; flex-direction: column;">
                    <span class="stat-value" style="font-size: 2.8rem; line-height: 1;">${goles}</span>
                    <span class="stat-label">Goles Totales</span>
                    ${vedBlock}
                </div>
            `;
        } else if (currentSort.column === 'ASISTENCIAS') {
            subtitleText = `Efectividad: ${effective}`;
            statsBlock = `
                <div class="stat-box" style="flex: 1; justify-content: center; flex-direction: column;">
                    <span class="stat-value" style="font-size: 2.8rem; line-height: 1;">${p.ASISTENCIAS || 0}</span>
                    <span class="stat-label">Asistencias</span>
                    ${vedBlock}
                </div>
            `;
        } else if (currentSort.column === 'AMARILLAS' || currentSort.column === 'ROJAS' || currentSort.column === 'tarjetas') {
            subtitleText = `Efectividad: ${effective}`;
            statsBlock = `
                <div class="stat-box" style="flex: 1; display: flex; flex-direction: column; align-items: center; width: 100%;">
                    <div style="display: flex; gap: 2rem; margin-bottom: 0.5rem;">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span class="stat-value" style="font-size: 2.2rem; color:#f1c40f;">${p.AMARILLAS || 0}</span>
                            <span class="stat-label">Amarillas</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span class="stat-value" style="font-size: 2.2rem; color:#e74c3c;">${p.ROJAS || 0}</span>
                            <span class="stat-label">Rojas</span>
                        </div>
                    </div>
                    ${vedBlock}
                </div>
            `;
        }

        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <div class="player-image-wrapper">
                <img src="${imgPath}" alt="${displayName}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; z-index: 3;" onerror="this.style.display='none'">
                <span class="player-placeholder">${initial}</span>
                <div class="player-silhouette"></div>
            </div>
            <div class="player-info">
                <div class="player-name">${displayName}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">
                    ${subtitleText}
                </div>
                <div class="player-stats-mini" style="gap: 0.5rem; justify-content: center;">
                    ${statsBlock}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Search Logic
document.getElementById('searchInput')?.addEventListener('input', () => {
    applyYearFilters();
});

// Year Logic via Filter Buttons (Multi-Select)
document.querySelectorAll('#yearFiltersJugadores .filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const year = e.target.getAttribute('data-year');
        
        // Single select logic
        selectedYears = [year];
        document.querySelectorAll('#yearFiltersJugadores .filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        applyYearFilters();
    });
});

// Sort Logic via Filter Buttons
document.querySelectorAll('#sortFilters .filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Update active class
        document.querySelectorAll('#sortFilters .filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const col = e.target.getAttribute('data-sort');
        
        // Most numerical stats are best viewed descending, except names which are ascending
        if (col === 'PLAYER') {
            currentSort = { column: col, direction: 'asc' };
        } else {
            currentSort = { column: col, direction: 'desc' };
        }
        
        renderPlayersGrid();
    });
});

// Initialized directly by db.js when data is ready or via local listener
// Initialized directly by db.js when data is ready or via local listener
document.addEventListener('dataLoaded', () => {
    applyYearFilters();
    initCounter();
});
window.renderAll = applyYearFilters;

// Triple-check for late loading
if (window.dataLoaded || (window.allPlayers && Object.keys(window.allPlayers).length > 0)) {
    applyYearFilters();
    initCounter();
    
    // Sync UI with URL filter
    if (filterQuery) {
        document.querySelectorAll('#sortFilters .filter-btn').forEach(b => {
             if (b.innerText.toLowerCase().includes(filterQuery.replace('tarjetas', 'disciplina'))) {
                 b.classList.add('active');
             } else {
                 b.classList.remove('active');
             }
        });
    }
}

function initCounter() {
    const total = window.allPlayers['ALL'] ? window.allPlayers['ALL'].length : 0;
    const counterEl = document.getElementById('playerCountLarge');
    if(!counterEl || total === 0) return;
    
    let count = 0;
    const duration = 1500; // 1.5 seconds
    const start = performance.now();
    
    function update(now) {
        const progress = Math.min((now - start) / duration, 1);
        counterEl.innerText = Math.floor(progress * total);
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            counterEl.innerText = total;
        }
    }
    requestAnimationFrame(update);
}
