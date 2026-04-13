// Simple CSV Parser for La Bufarra Statistics
const csvFiles = [
    'DATOS EXCEL/COPIA PARA WEB - PARTIDOS 21\'.csv',
    'DATOS EXCEL/COPIA PARA WEB - PARTIDOS 22\'.csv'
    // Añadiremos más cuando veamos su estructura
];

// Helper to parse CSV text into objects
function parseCSV(text) {
    const lines = text.split('\n');
    let data = [];
    let headers = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        let cells = line.split(',');
        let lineUpper = line.toUpperCase();

        // 1. Detect Headers (look for them anywhere in the line)
        if (lineUpper.includes('AÑO,FECHA,TORNEO') || line.includes('Año,Fecha,Torneo') || line.includes('A\u00f1o,Fecha,Torneo')) {
            // Find where the header starts
            let startIdx = cells.findIndex(c => c.toUpperCase().includes('AÑO') || c.includes('Año') || c.includes('A\u00f1o'));
            headers = cells.slice(startIdx, startIdx + 8).map(h => h.trim());
            continue;
        }

        // 2. Process Data Row
        if (headers.length > 0) {
            // New matches might be at index 0 or shifted (e.g. index 14)
            // We search for a cell that looks like a 4-digit year (2021-2026)
            let startIdx = cells.findIndex(c => /^(20[2-3][0-9])$/.test(c.trim()));
            
            if (startIdx !== -1) {
                let rowData = cells.slice(startIdx);
                let matchObj = {};
                
                // Map the 8 standard columns
                const fields = ['AÑO', 'FECHA', 'TORNEO', 'INSTANCIA', 'RIVAL', 'GF', 'GC', 'LUGAR'];
                fields.forEach((f, idx) => {
                    matchObj[f] = rowData[idx] ? rowData[idx].trim() : '';
                });

                matchObj.ID = `m${i}`;
                
                const gf = matchObj['GF'];
                const gc = matchObj['GC'];
                const inst = matchObj['INSTANCIA'];
                const tor = matchObj['TORNEO'];
                
                let fullTorneo = tor;
                if(inst && inst !== '-' && inst !== '') {
                    fullTorneo += ' - ' + inst;
                }

                let mappedObj = {
                    ID: matchObj.ID,
                    FECHA: matchObj['FECHA'],
                    VS: matchObj['RIVAL'],
                    LUGAR: matchObj['LUGAR'],
                    torneo: fullTorneo,
                    torneo_base: tor,
                    INSTANCIA: inst,
                    AÑO: matchObj['AÑO'],
                    GF: gf,
                    GC: gc,
                    RESULTADO: (gf !== '' && gc !== '') ? `${gf}x${gc}` : ''
                };

                if (mappedObj['VS'] && mappedObj['RESULTADO'] !== '') {
                    data.push(mappedObj);
                }
            }
        }
    }
    return data;
}

// Global Data Store
let allMatches = [];
let allPlayers = {}; 
let allUpcoming = []; // Added for Supabase sync

async function loadMatches() {
    console.log("DB: Starting data load...");
    const cacheBuster = `?t=${Date.now()}`;
    
    try {
        // ═══ Try Supabase (Cloud Database) ═══
        let apiSuccess = false;
        const SUPABASE_URL = "https://hmaqdzkpjkxamggaiypo.supabase.co";
        const SUPABASE_KEY = "sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y";
        const SP_HEADERS = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };

        try {
            const [matchRes, playerRes, upcomingRes] = await Promise.all([
                fetch(`${SUPABASE_URL}/rest/v1/matches?select=*&order=fecha.desc`, { headers: SP_HEADERS }),
                fetch(`${SUPABASE_URL}/rest/v1/players_stats?select=*`, { headers: SP_HEADERS }),
                fetch(`${SUPABASE_URL}/rest/v1/upcoming?select=*&order=fecha.asc`, { headers: SP_HEADERS })
            ]);
            
            if (matchRes.ok) {
                const matchesJson = await matchRes.json();
                allMatches = matchesJson.map((m, i) => ({
                    ID: m.id || `m${i}`,
                    FECHA: formatDate(m.fecha),
                    VS: m.rival || '',
                    LUGAR: m.lugar || '',
                    torneo: m.instancia ? `${m.torneo} - ${m.instancia}` : (m.torneo || ''),
                    torneo_base: m.torneo || '',
                    INSTANCIA: m.instancia || '',
                    AÑO: m.fecha ? m.fecha.split('-')[0] : '',
                    GF: String(m.gf ?? ''),
                    GC: String(m.gc ?? ''),
                    RESULTADO: (m.gf !== null && m.gc !== null) ? `${m.gf}x${m.gc}` : '',
                    jugadores: m.jugadores || {}
                }));
                console.log(`DB: Loaded ${allMatches.length} matches from Supabase.`);
                apiSuccess = true;
            }
            
            if (playerRes.ok) {
                const playersJson = await playerRes.json();
                allPlayers = {};
                playersJson.forEach(p => {
                    if (!allPlayers[p.year]) allPlayers[p.year] = [];
                    allPlayers[p.year].push({
                        PLAYER: p.player_name || '',
                        PJ: String(p.pj ?? 0),
                        PG: String(p.pg ?? 0),
                        PE: String(p.pe ?? 0),
                        PP: String(p.pp ?? 0),
                        GOLES: String(p.goles ?? 0),
                        ASISTENCIAS: String(p.asistencias ?? 0),
                        AMARILLAS: String(p.amarillas ?? 0),
                        ROJAS: String(p.rojas ?? 0),
                        MVP: String(p.mvp ?? 0)
                    });
                });
                console.log("DB: Loaded players from Supabase.");
            }

            if (upcomingRes.ok) {
                const upcomingJson = await upcomingRes.json();
                allUpcoming = upcomingJson.map(u => ({
                    fecha: formatDate(u.fecha),
                    hora: u.hora || '',
                    rival: u.rival || '',
                    torneo: u.torneo || '',
                    instancia: u.instancia || '',
                    lugar: u.lugar || ''
                }));
                console.log("DB: Loaded upcomings from Supabase.");
            }
        } catch(apiErr) {
            console.warn("DB: Supabase not available, trying local files...", apiErr);
        }

        function formatDate(isoDate) {
            if (!isoDate) return '';
            const [y, m, d] = isoDate.split('-');
            return `${parseInt(d)}/${parseInt(m)}/${y}`;
        }

        // ═══ Fallback: Load JSON directly (for static hosts like Netlify) ═══
        if (!apiSuccess) {
            console.log("DB: API not available (possibly static host), trying direct JSON files...");
            try {
                const [matchRes, playerRes] = await Promise.all([
                    fetch('data/matches.json' + cacheBuster),
                    fetch('data/players.json' + cacheBuster)
                ]);

                if (matchRes.ok) {
                    const matchesJson = await matchRes.json();
                    allMatches = matchesJson.map((m, i) => ({
                        ID: m.id || `m${i}`,
                        FECHA: m.fecha || '',
                        VS: m.rival || '',
                        LUGAR: m.lugar || '',
                        torneo: m.instancia ? `${m.torneo} - ${m.instancia}` : (m.torneo || ''),
                        torneo_base: m.torneo || '',
                        INSTANCIA: m.instancia || '',
                        AÑO: m.año || '',
                        GF: String(m.gf ?? ''),
                        GC: String(m.gc ?? ''),
                        RESULTADO: (m.gf !== undefined && m.gc !== undefined) ? `${m.gf}x${m.gc}` : ''
                    }));
                    console.log(`DB: Loaded ${allMatches.length} matches from static JSON.`);
                    apiSuccess = true;
                }

                if (playerRes.ok) {
                    const playersJson = await playerRes.json();
                    allPlayers = {};
                    for (const [year, playersObj] of Object.entries(playersJson)) {
                        allPlayers[year] = Object.values(playersObj).map(p => ({
                            PLAYER: p.nombre || p.PLAYER || '',
                            PJ: String(p.pj ?? p.PJ ?? 0),
                            PG: String(p.pg ?? p.PG ?? 0),
                            PE: String(p.pe ?? p.PE ?? 0),
                            PP: String(p.pp ?? p.PP ?? 0),
                            GOLES: String(p.goles ?? p.GOLES ?? 0),
                            ASISTENCIAS: String(p.asistencias ?? p.ASISTENCIAS ?? 0),
                            AMARILLAS: String(p.amarillas ?? p.AMARILLAS ?? 0),
                            ROJAS: String(p.rojas ?? p.ROJAS ?? 0),
                            MVP: String(p.mvp ?? p.MVP ?? 0)
                        }));
                    }
                }
            } catch(jsonErr) {
                console.warn("DB: Direct JSON load failed.", jsonErr);
            }
        }

        // ═══ Fallback: CSV parsing (legacy support) ═══
        if (!apiSuccess) {
            const responseMatches = await fetch('DATOS%20EXCEL/BUFARRA%20ESTADISTICAS%20-%20PARTIDOS.csv' + cacheBuster);
            if(!responseMatches.ok) throw new Error(`Matches CSV status: ${responseMatches.status}`);
            const textMatches = await responseMatches.text();
            allMatches = parseCSV(textMatches);
            console.log(`DB: Parsed ${allMatches.length} matches from CSV.`);
            
            const histPaths = [
                'DATOS%20EXCEL/COPIA%20PARA%20WEB%20-%20HIST%C3%93RICO.csv',
                'DATOS%20EXCEL/COPIA%20PARA%20WEB%20-%20HISTO%CC%81RICO.csv'
            ];
            
            let histResponse = null;
            for (const path of histPaths) {
                try {
                    const r = await fetch(path + cacheBuster);
                    if (r.ok) { histResponse = r; break; }
                } catch(e) {}
            }

            if (histResponse && histResponse.ok) {
                const histText = await histResponse.text();
                allPlayers = parseHistoricalPlayers(histText);
                console.log("DB: Finished parsing historical players.");
            }
        }

        // Sort globally
        allMatches.sort((a, b) => parseDateForSort(b.FECHA) - parseDateForSort(a.FECHA));

        // Trigger UI Renders
        if (typeof renderLastMatches === 'function') renderLastMatches();
        if (typeof renderAllMatches === 'function') renderAllMatches();
        if (typeof renderEfeméride === 'function') renderEfeméride();
        
        if (typeof applyYearFilters === 'function') {
            console.log("DB: Initializing Players Page...");
            applyYearFilters();
            if (typeof initCounter === 'function') initCounter();
        }
    } catch (err) {
        console.error("DB: Global data load error:", err);
    }
}

function parseDateForSort(dateStr) {
    if(!dateStr || typeof dateStr !== 'string') return 0;
    // Common CSV format: D/M/YYYY or DD/MM/YYYY
    const parts = dateStr.trim().split('/');
    if(parts.length < 2) return 0;
    
    let d = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    let yStr = parts[2] ? parts[2].trim() : "20";
    
    if (yStr.length === 2) yStr = '20' + yStr;
    const y = parseInt(yStr, 10);
    
    // Fallback to year 2020 if invalid
    if (isNaN(d) || isNaN(m) || isNaN(y)) return 0;
    
    const dateObj = new Date(y, m - 1, d);
    return isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
}

function showFallbackWarning() {
    // Show a warning in grids if data failed
    const listContainer = document.querySelector('.matches-list');
    const playersGrid = document.getElementById('playersGrid');
    const warningHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: var(--accent-primary);">
            <i class="ph-bold ph-warning" style="font-size: 2rem;"></i>
            <p style="margin-top: 1rem;">No se pudieron cargar los datos del Excel.</p>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Cerrá la ventana negra. Abri el archivo Iniciar_Web.command de nuevo.</p>
        </div>
    `;
    if(listContainer) listContainer.innerHTML = warningHTML;
    if(playersGrid) playersGrid.innerHTML = warningHTML;
}

function getResultClass(resultado) {
    if(!resultado) return { class: 'res-D', letter: '?' };
    
    // Parse result string like "3x1" or "4x0"
    const scoreParts = resultado.toLowerCase().split('x');
    if(scoreParts.length === 2) {
        const golesFavor = parseInt(scoreParts[0]);
        const golesContra = parseInt(scoreParts[1]);
        
        if (golesFavor > golesContra) return { class: 'res-W', letter: 'V' };
        if (golesFavor === golesContra) return { class: 'res-D', letter: 'E' };
        if (golesFavor < golesContra) return { class: 'res-L', letter: 'D' };
    }
    // Default or unparsed formats
    return { class: 'res-D', letter: '-' };
}

function renderLastMatches() {
    const listContainer = document.getElementById('homeLatestMatches');
    if (!listContainer) return;
    if (allMatches.length === 0) return;

    listContainer.innerHTML = '';

    // Limit to 3 matches for Home page compactness
    const recentMatches = allMatches.filter(m => m.VS && m.RESULTADO).slice(0, 3);
    console.log("Dashboard: Rendering " + recentMatches.length + " recent matches.");

    recentMatches.forEach(match => {
        const resultInfo = getResultClass(match.RESULTADO);
        const scoreFormatted = match.RESULTADO ? match.RESULTADO.replace('x', ' - ') : 'N/A';
        
        const row = document.createElement('a');
        row.className = 'match-row';
        row.href = `partido.html?id=${match.ID}`;
        row.style.textDecoration = 'none';
        
        const rivalShield = getRivalShield(match.VS);
        
        row.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; width: 100%;">
                <div style="flex-grow: 1;">
                    <div class="match-competencia">${match.torneo || 'Amistoso'}</div>
                    <div class="match-scoreline" style="color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                        LA BUFARRA <span class="score">${scoreFormatted}</span> 
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <img src="${rivalShield}" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.style.display='none'">
                            ${match.VS}
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; color: #666; margin-top: 0.2rem;">📅 ${match.FECHA || 'S/D'} | 🏟️ ${match.LUGAR || 'S/D'}</div>
                </div>
                <div class="result-indicator ${resultInfo.class}">${resultInfo.letter}</div>
            </div>
        `;
        listContainer.appendChild(row);
    });
    
    const viewAllBtn = document.createElement('a');
    viewAllBtn.href = "partidos.html";
    viewAllBtn.className = "btn-link";
    viewAllBtn.style.cssText = "justify-content: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-light); text-decoration: none;";
    viewAllBtn.innerHTML = `Historial de Partidos <i class="ph-bold ph-caret-right"></i>`;
    listContainer.appendChild(viewAllBtn);
}

// Parse Historical Player Stats with multiple tables inside
function parseHistoricalPlayers(text) {
    const lines = text.split('\n');
    let playersByYear = { 'ALL': [] };
    let currentYearBlock = null;
    let globalStarted = false;

    // The columns are: PLAYER, PJ, PG, PE, PP, GOLES, ASISTENCIAS, AMARILLAS, ROJAS, MVP, % PG, % PE, %PP
    const histHeaders = ['PLAYER', 'PJ', 'PG', 'PE', 'PP', 'GOLES', 'ASISTENCIAS', 'AMARILLAS', 'ROJAS', 'MVP', '% PG', '% PE', '% PP'];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].replace('\r', '').trim();
        if (!line) continue;

        // Smart split for CSV that ignores commas inside quotes
        let cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
        
        // 1. Process Global Table (Right Side, Col 11+)
        // Look for the header line which has 'PLAYER' at index 11
        if (cells[11] === 'PLAYER' || (cells[11] && cells[11].includes('PLAYER'))) {
            globalStarted = true;
            continue;
        } 
        
        if (globalStarted && cells[11] && !cells[11].includes('HISTÓRICO')) {
            let p = {};
            histHeaders.forEach((h, idx) => {
                p[h] = cells[11 + idx] || '0';
            });
            p['% PG'] = p['% PG'] || '0%';
            // Validate it's a real player row (has a name and some games)
            if (p['PLAYER'] && p['PLAYER'] !== 'PLAYER' && p['PJ'] !== '0') {
                playersByYear['ALL'].push(p);
            }
        }

        // 2. Process Yearly Tables (Left Side, Col 0-10)
        if (cells[0] && cells[0].startsWith('ESTADÍSTICAS ')) {
            currentYearBlock = cells[0].replace('ESTADÍSTICAS ', '').trim();
            if (!playersByYear[currentYearBlock]) playersByYear[currentYearBlock] = [];
        } else if (currentYearBlock && cells[0] && cells[0] !== 'PLAYER') {
            let p = {};
            histHeaders.slice(0, 10).forEach((h, idx) => { // Yearly doesn't have %
                p[h] = cells[idx] || '0';
            });
            if (p['PLAYER']) {
                playersByYear[currentYearBlock].push(p);
            }
        }
    }
    return playersByYear;
}

// Render "Un día como hoy" finding a matching day/month in history
function renderEfeméride() {
    const historySection = document.getElementById('efemerideText');
    if (!historySection || allMatches.length === 0) return;
    
    // We base the efeméride strictly on the current date, to find past matches on this day
    const today = new Date();
    const tDay = today.getDate();
    const tMonth = today.getMonth() + 1; // 1-12
    const currentYear = today.getFullYear();
    
    // Find a match with same day and month but different year
    const matched = allMatches.filter(m => {
        if (!m.FECHA) return false;
        const parts = m.FECHA.split('/');
        if (parts.length < 2) return false;
        // The format is assumed to be D/M or M/D. Most common is D/M
        let d = parseInt(parts[0]);
        let mth = parseInt(parts[1]);
        if (mth > 12) {
            d = parseInt(parts[1]);
            mth = parseInt(parts[0]);
        }
        
        const yStr = parts[2] || '';
        const y = yStr.length === 2 ? parseInt('20'+yStr) : parseInt(yStr);
        return (d === tDay && mth === tMonth && y < currentYear);
    });

    const getMonthName = (m) => ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][m-1];

    if (matched.length > 0) {
        // pick a random match from the matches on this date
        const m = matched[Math.floor(Math.random() * matched.length)];
        const parts = m.FECHA.split('/');
        let yearStr = parts[2] || '';
        if(yearStr.length === 2) yearStr = '20'+yearStr;
        
        const resultInfo = getResultClass(m.RESULTADO);
        let action = "disputó un gran encuentro frente a";
        if (resultInfo.class === 'res-W') action = "logró una espectacular victoria ante";
        if (resultInfo.class === 'res-L') action = "cayó en un duro partido contra";
        if (resultInfo.class === 'res-D') action = "empató el marcador con";

        let scoreStr = m.RESULTADO ? m.RESULTADO.replace('x', ' a ') : '';

        historySection.innerHTML = `El ${tDay} de ${getMonthName(tMonth)} de <strong>${yearStr}</strong>, LA BUFARRA ${action} <strong>${m.VS}</strong> por ${scoreStr} correspondiente al torneo ${m.torneo || 'Amistoso'}.`;
        
        // Update the link
        const link = document.getElementById('efemerideLink');
        if (link && m.ID) {
            link.href = `partido.html?id=${m.ID}`;
        }
    } else {
        // Fallback random fact
        const sabiasQue = [
            "LA BUFARRA se fundó con la ambición de dominar el fútbol amateur, y rápidamente el nombre se convirtió en sinónimo de respeto.",
            "De acuerdo con nuestros registros históricos, el equipo ha mantenido una base de plantel que forjó su ADN ganador de forma inquebrantable.",
            "En el año 2023 se logró un hito histórico: el equipo conquistó el Torneo de Verano y el Torneo de Invierno, un bicampeonato absoluto.",
            "Nuestra icónica camiseta negra impone presencia desde el primer minuto en la cancha.",
            "La gran remontada en la Copa de Oro 2025 consolidó a esta generación de jugadores como verdaderas leyendas de LA BUFARRA."
        ];
        const randomFact = sabiasQue[Math.floor(Math.random() * sabiasQue.length)];
        historySection.innerHTML = `<span style="font-size: 0.95rem;">${randomFact}</span>`;
    }
}

// Helper to get rival shield based on name
// Normalization map for team names (Synonyms)
const TEAM_SYNONYMS = {
    'RETIRO': 'EL RETIRO',
    'BOURBON': 'BOURBON ST.',
    'VAGONETA': 'LA VAGONETA',
    'RESAKA': 'LA RESAKA',
    'VEGANO': 'FULL VEGANO',
    'ATAHUALPA': 'PLAZA ATAHUALPA',
    'REYES': 'REYES DE LAS ROJAS',
    'VENTOLIN': 'VENTOLIN JRS.',
    'EDU SKOL': 'EDU SKOL'
};

function normalizeTeamName(name) {
    if (!name) return "";
    let n = name.toString().trim().toUpperCase();
    
    // Remove unnecessary prefixes for matching if they cause issues
    // But here we rely on the map for explicit synonyms
    if (TEAM_SYNONYMS[n]) return TEAM_SYNONYMS[n];
    
    // Check if parts of the name match (e.g., "EL RETIRO" contains "RETIRO")
    for (const [key, value] of Object.entries(TEAM_SYNONYMS)) {
        if (n === key || n === value) return value;
    }
    
    return n;
}

const RIVAL_SHIELDS_MAP = {
    'EL RETIRO': 'img/escudos/ESCUDO_EL_RETIRO.png',
    'BOURBON ST.': 'img/escudos/ESCUDO_BOURBON_ST.png',
    'LA VAGONETA': 'img/escudos/ESCUDO_LA_VAGONETA.png',
    'LA RESAKA': 'img/escudos/ESCUDO_LA_RESAKA.png',
    'FULL VEGANO': 'img/escudos/ESCUDO_FULL_VEGANO.png',
    'PLAZA ATAHUALPA': 'img/escudos/ESCUDO_PLAZA_ATAHUALPA.png',
    'REYES DE LAS ROJAS': 'img/escudos/ESCUDO_REYES_DE_LAS_ROJAS.png',
    'VENTOLIN JRS.': 'img/escudos/ESCUDO_VENTOLIN_JRS.png',
    'DALE TITO': 'img/escudos/ESCUDO_DALE_TITO.png',
    'INSTITUTO JP': 'img/escudos/ESCUDO_INSTITUTO_JP.png',
    'KRAKEN': 'img/escudos/ESCUDO_KRAKEN.png',
    'PEPPERS': 'img/escudos/ESCUDO_PEPPERS.png',
    'PLATENXE': 'img/escudos/ESCUDO_PLATENXE.png',
    'SALUS': 'img/escudos/ESCUDO_SALUS.png',
    'SIN CENSURA': 'img/escudos/ESCUDO_SIN_CENSURA.png',
    'TANKENCH': 'img/escudos/ESCUDO_TANKENCH.png',
    'EDU SKOL': 'img/escudos/ESCUDO_EDU_SKOL.png'
};

function getRivalShield(rivalName) {
    const normalized = normalizeTeamName(rivalName);
    return RIVAL_SHIELDS_MAP[normalized] || "";
}

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    loadMatches();
    renderNextMatch();
});

// Render dynamic next match from API
async function renderNextMatch() {
    const card = document.getElementById('nextMatchCard');
    if (!card) return;
    
    // We already have allUpcoming loaded by loadMatches()
    if (!allUpcoming || allUpcoming.length === 0) {
        card.innerHTML = `
            <div style="text-align:center;color:var(--text-muted);padding:2rem;">
                <i class="ph-bold ph-calendar-x" style="font-size:2rem;display:block;margin-bottom:1rem;"></i>
                No hay próximos partidos programados
            </div>
        `;
        return;
    }
    
    // Find the first upcoming match that is NOT today/past if we wanted to filter, 
    // but the API order is already fecha.asc.
    const next = allUpcoming[0];
    const torneo = next.instancia ? `${next.torneo} - ${next.instancia}` : (next.torneo || 'Amistoso');
    const rivalShield = getRivalShield(next.rival);
    
    card.innerHTML = `
        <div>
            <div style="display: flex; justify-content: center; width: 100%;">
                <a href="#" class="torneo-tag">${torneo}</a>
            </div>
            
            <div class="teams-display" style="margin: 1.5rem 0;">
                <div class="team">
                    <div class="team-shield" style="display:flex; align-items:center; justify-content:center;">
                        <img src="img/logo/ESCUDO_BUFARRA.png" style="width: 28px; height: auto;" alt="LA BUFARRA">
                    </div>
                    <span class="team-name">LA BUFARRA</span>
                </div>
                
                <div class="vs-badge">VS</div>
                
                <div class="team">
                    <div class="team-shield" style="color: #666;">
                        ${rivalShield ? `<img src="${rivalShield}" style="width:28px;height:auto;" onerror="this.outerHTML='<i class=\\'ph-fill ph-shield\\'></i>'">` : '<i class="ph-fill ph-shield"></i>'}
                    </div>
                    <span class="team-name">${next.rival || 'A confirmar'}</span>
                </div>
            </div>
            
            <div class="match-details" style="margin-top: 1.5rem; border-top: 1px solid var(--border-light); padding-top: 1.5rem; gap: 1.5rem;">
                <div class="detail-item">
                    <i class="ph-fill ph-calendar-blank detail-icon"></i>
                    <span>${next.fecha || ''}${next.hora ? ', ' + next.hora + ' hs' : ''}</span>
                </div>
                <div class="detail-item">
                    <i class="ph-fill ph-map-pin detail-icon"></i>
                    <span>${next.lugar || 'A confirmar'}</span>
                </div>
            </div>
        </div>
        
        <a href="campeonatos.html" class="btn-link" style="justify-content: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-light); font-size: 0.8rem; letter-spacing: 1px;">
            Ver Fixture Completo <i class="ph-bold ph-calendar-check"></i>
        </a>
    `;
}
