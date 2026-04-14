let currentSort = { column: 'PJ', direction: 'desc' };
let filteredPlayers = [];
let selectedYears = ['ALL']; // Holds selected years e.g. ['2021', '2023']

const PLAYER_MAP = {
    'Alvez': { fullName: 'Lautaro Alvez', aliases: ['Pekeno'] },
    'Anzuatte': { fullName: 'Agustin Anzuatte', aliases: ['Anzu'] },
    'Blanco': { fullName: 'Tomas Blanco', aliases: ['Oso'] },
    'Brito': { fullName: 'Emiliano Brito', aliases: ['Emi'] },
    'Bonilla': { fullName: 'Felipe Bonilla', aliases: ['Feli', 'Boni'] },
    'Cravino': { fullName: 'Agustin Cravino', aliases: ['Cravi'] },
    'Colombo': { fullName: 'Mateo Colombo', aliases: ['Pepo'] },
    'Da Silveira': { fullName: 'Guzman da Silveira', aliases: ['Guz'] },
    'da Silveira': { fullName: 'Guzman da Silveira', aliases: ['Guz'] },
    'De Leon': { fullName: 'Enzo de Leon', aliases: ['Enzo'] },
    'De León': { fullName: 'Enzo de Leon', aliases: ['Enzo'] },
    'de León': { fullName: 'Enzo de Leon', aliases: ['Enzo'] },
    'Dobal': { fullName: 'Federico Dobal', aliases: ['Feche'] },
    'Fernandez': { fullName: 'Geronimo Fernandez', aliases: ['Gero'] },
    'Flores': { fullName: 'Antonio Flores', aliases: ['Antony'] },
    'Iza': { fullName: 'Federico Iza', aliases: ['Fede', 'Iza'] },
    'Lorenzo': { fullName: 'Martin Lorenzo', aliases: ['Tincho'] },
    'Luzardo': { fullName: 'Valentin Luzardo', aliases: ['Luza'] },
    'Martinez': { fullName: 'Miqueas Martinez', aliases: ['Mique', 'Quique'] },
    'Martínez': { fullName: 'Miqueas Martinez', aliases: ['Mique', 'Quique'] },
    'Mari': { fullName: 'Pablo Mari', aliases: ['Pablito'] },
    'Mateo': { fullName: 'Santiago Mateo', aliases: ['Santi'] },
    'Menchaca': { fullName: 'Mateo Menchaca', aliases: ['Mencha'] },
    'Molina': { fullName: 'Justiniano Molina', aliases: ['Justi'] },
    'Olarte': { fullName: 'Juan Miguel Olarte', aliases: ['Juan'] },
    'Pedemonte': { fullName: 'Sebastian Pedemonte', aliases: ['Seba', 'Sebita'] },
    'Rocca': { fullName: 'Diego Rocca', aliases: ['Harry'] },
    'Rodríguez': { fullName: 'Guillermo Rodriguez', aliases: ['Guille'] },
    'Rodriguez': { fullName: 'Guillermo Rodriguez', aliases: ['Guille'] },
    'Guillermo Rodriguez': { fullName: 'Guillermo Rodriguez', aliases: ['Guille'] },
    'Silva': { fullName: 'Bruno Silva', aliases: ['Bruno', 'Silva'] },
    'Silva, Gaston': { fullName: 'Gaston Silva', aliases: ['Junior'] },
    'Silva, Gastón': { fullName: 'Gaston Silva', aliases: ['Junior'] },
    'Gaston Silva': { fullName: 'Gaston Silva', aliases: ['Junior'] },
    'Sparkov': { fullName: 'Santiago Sparkov', aliases: ['Spark', 'Sparky'] },
    'Valle': { fullName: 'Joaquin Valle', aliases: ['Joaco'] },
    'Joaquin Valle': { fullName: 'Joaquin Valle', aliases: ['Joaco'] },
    'Vigil': { fullName: 'Sebastian Vigil', aliases: ['Seba'] },
    'Sebastian Vigil': { fullName: 'Sebastian Vigil', aliases: ['Seba'] },
    'Balestie': { fullName: 'Kevin Balestie', aliases: ['Kevin'] },
    'Kevin Balestie': { fullName: 'Kevin Balestie', aliases: ['Kevin'] }
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
        'Da Silveira': 'Da Silveira', 'da Silveira': 'Da Silveira', 'Guzman Da Silveira': 'Da Silveira', 'Guzman da Silveira': 'Da Silveira',
        'De Leon': 'De Leon', 'De León': 'De Leon', 'Enzo De Leon': 'De Leon', 'Enzo de Leon': 'De Leon',
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
        'Rocca': 'Rocca', 'Diego Rocca': 'Rocca',
        'Rodriguez': 'Rodriguez', 'Guillermo Rodriguez': 'Rodriguez', 'Rodríguez': 'Rodriguez',
        'Silva': 'Silva', 'Bruno Silva': 'Silva',
        'Gaston Silva': 'G. Silva', 'Silva, Gaston': 'G. Silva',
        'Sparkov': 'Sparkov', 'Santiago Sparkov': 'Sparkov',
        'Valle': 'Valle', 'Joaquin Valle': 'Valle',
        'Vigil': 'Vigil', 'Sebastian Vigil': 'Vigil',
        'Balestie': 'Balestie', 'Kevin Balestie': 'Balestie'
    };

    if (visualMap[n]) return visualMap[n];
    
    // Capitalize first letter of each word as default if not mapped
    return n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Initialized directly by db.js when data is ready via applyYearFilters()

function applyYearFilters() {
    let basePlayers = [];
    
    // If 'ALL' is selected, we just use the pre-calculated 'ALL' table
    if (selectedYears.includes('ALL')) {
        basePlayers = [...(allPlayers['ALL'] || [])].map(p => {
            const normalizedName = normalizePlayerName(p.PLAYER);
            const mapping = PLAYER_MAP[normalizedName];
            return { ...p, PLAYER: normalizedName, DISPLAY_PLAYER: mapping ? mapping.fullName : normalizedName };
        });
    } else {
        // Aggregate stats from selected years
        let aggregated = {};
        
        selectedYears.forEach(year => {
            const yearData = allPlayers[year] || [];
            yearData.forEach(p => {
                const name = p.PLAYER.trim(); // Trim name to avoid key mismatches
                if (!aggregated[name]) {
                    aggregated[name] = {
                        PLAYER: name,
                        PJ: 0, PG: 0, PE: 0, PP: 0,
                        GOLES: 0, ASISTENCIAS: 0, AMARILLAS: 0, ROJAS: 0
                    };
                }
                aggregated[name].PJ += parseInt(p.PJ || 0);
                aggregated[name].PG += parseInt(p.PG || 0);
                aggregated[name].PE += parseInt(p.PE || 0);
                aggregated[name].PP += parseInt(p.PP || 0);
                aggregated[name].GOLES += parseInt(p.GOLES || 0);
                aggregated[name].ASISTENCIAS += parseInt(p.ASISTENCIAS || 0);
                aggregated[name].AMARILLAS += parseInt(p.AMARILLAS || 0);
                aggregated[name].ROJAS += parseInt(p.ROJAS || 0);
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
    const countSpan = document.getElementById('playerCount');
    if (!grid) return;
    if (countSpan) countSpan.innerText = filteredPlayers.length;
    
    const largeCounter = document.getElementById('playerCountLarge');
    if (largeCounter) {
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
        
        if (currentSort.column === 'PJ' || currentSort.column === 'PLAYER') {
            subtitleText = `Efectividad de Victorias: ${p['% PG'] || '0%'}`;
            statsBlock = `
                <div class="stat-box"><span class="stat-value">${pj}</span><span class="stat-label">PJ</span></div>
                <div class="stat-box"><span class="stat-value">${goles}</span><span class="stat-label">Goles</span></div>
                <div class="stat-box"><span class="stat-value">${p.ASISTENCIAS || 0}</span><span class="stat-label">Asist.</span></div>
                <div class="stat-box"><span class="stat-value"><i class="ph-fill ph-trophy" style="color:var(--accent-primary)"></i></span><span class="stat-label">Títulos: ?</span></div>
            `;
        } else if (currentSort.column === 'GOLES') {
            const prom = pj > 0 ? formatDecimal(goles / pj) : '0.00';
            subtitleText = `Promedio de gol: ${prom}`;
            statsBlock = `
                <div class="stat-box" style="flex: 1; justify-content: center;"><span class="stat-value" style="font-size: 2rem;">${goles}</span><span class="stat-label">Goles Totales</span></div>
            `;
        } else if (currentSort.column === 'ASISTENCIAS') {
            subtitleText = ``; // Blank
            statsBlock = `
                <div class="stat-box" style="flex: 1; justify-content: center;"><span class="stat-value" style="font-size: 2rem;">${p.ASISTENCIAS || 0}</span><span class="stat-label">Asistencias</span></div>
            `;
        } else if (currentSort.column === 'AMARILLAS') {
            subtitleText = ``; // Blank
            statsBlock = `
                <div class="stat-box" style="flex: 1; justify-content: center;"><span class="stat-value" style="color:#f1c40f; font-size: 2rem;">${p.AMARILLAS || 0}</span><span class="stat-label">Tarjetas Amarillas</span></div>
            `;
        } else if (currentSort.column === 'ROJAS') {
            subtitleText = ``; // Blank
            statsBlock = `
                <div class="stat-box" style="flex: 1; justify-content: center;"><span class="stat-value" style="color:#e74c3c; font-size: 2rem;">${p.ROJAS || 0}</span><span class="stat-label">Tarjetas Rojas</span></div>
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

// Triple-check for late loading
if (window.dataLoaded || (window.allPlayers && Object.keys(window.allPlayers).length > 0)) {
    applyYearFilters();
    initCounter();
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
