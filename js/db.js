// ═══════════════════════════════════════
// DB.JS — LA BUFARRA (Versión Ultra-Resiliente 5.0)
// ═══════════════════════════════════════

// Variables Globales — Visibles para todos los scripts
window.allMatches = [];
window.allPlayers = {};
window.allUpcoming = [];
window.dataLoaded = false;

// Configuración de fuentes
const SUPABASE_URL = "https://hmaqdzkpjkxamggaiypo.supabase.co";
const SUPABASE_KEY = "sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y";
const SP_HEADERS = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };

async function loadMatches() {
    console.log("%c DB: Iniciando carga de datos... ", "background: #e91e63; color: white; font-weight: bold;");
    const cacheBuster = `?t=${Date.now()}`;
    let matchesLoaded = [];
    let playersLoaded = {};
    let sourcesChecked = [];

    // Siempre intentamos cargar partidos próximos (upcoming) al inicio
    const fetchUpcoming = async (baseUrl, isApi = false) => {
        try {
            const url = isApi ? `${baseUrl}/api/upcoming` : `${baseUrl}/rest/v1/upcoming?select=*`;
            const headers = isApi ? {} : SP_HEADERS;
            const res = await fetch(url + (isApi ? cacheBuster : ''), { headers }).catch(() => null);
            if (res && res.ok) window.allUpcoming = await res.json();
        } catch(e) {}
    };

    // ─── PASO 1: Intentar API Local (server.py) ───
    try {
        const res = await fetch('/api/matches' + cacheBuster).catch(() => ({ok:false}));
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                matchesLoaded = mapMatches(data);
                sourcesChecked.push("API Local");
                
                const pRes = await fetch('/api/players' + cacheBuster).catch(() => null);
                if (pRes && pRes.ok) playersLoaded = mapPlayers(await pRes.json());
                
                await fetchUpcoming('', true);
            }
        }
    } catch(e) { console.warn("DB: Falló API Local."); }

    // ─── PASO 2: Intentar Supabase (Nube) ───
    if (matchesLoaded.length === 0) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=*&order=fecha.desc`, { headers: SP_HEADERS });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    matchesLoaded = mapMatches(data);
                    sourcesChecked.push("Supabase Cloud");
                    
                    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/players_stats?select=*`, { headers: SP_HEADERS });
                    if (pRes.ok) playersLoaded = mapPlayers(await pRes.json());
                    
                    await fetchUpcoming(SUPABASE_URL, false);
                }
            }
        } catch(e) { console.warn("DB: Falló Supabase."); }
    }

    // ─── PASO 3: Intentar JSON Estático (Archivo Histórico) ───
    if (matchesLoaded.length < 50) {
        try {
            console.log("DB: Complementando con JSON Estático...");
            const res = await fetch('data/matches.json' + cacheBuster).catch(() => ({ok:false}));
            if (res.ok) {
                const staticData = mapMatches(await res.json());
                const existingIds = new Set(matchesLoaded.map(m => m.ID));
                staticData.forEach(m => {
                    if (!existingIds.has(m.ID)) {
                        matchesLoaded.push(m);
                    }
                });
                sourcesChecked.push("Static JSON");
                
                if (Object.keys(playersLoaded).length === 0) {
                    const pRes = await fetch('data/players.json' + cacheBuster).catch(() => null);
                    if (pRes && pRes.ok) playersLoaded = mapPlayers(await pRes.json());
                }
                
                // Si aún no hay upcoming, intentar de un archivo local si existe
                if (!window.allUpcoming || window.allUpcoming.length === 0) {
                    const uRes = await fetch('data/upcoming.json' + cacheBuster).catch(() => null);
                    if (uRes && uRes.ok) window.allUpcoming = await uRes.json();
                }
            }
        } catch(e) { console.warn("DB: Falló JSON Estático."); }
    }

    // ─── FINALIZAR ───
    if (matchesLoaded.length > 0) {
        window.allMatches = matchesLoaded;
        window.allPlayers = playersLoaded;
        finishLoad(sourcesChecked.join(" + "));
    } else {
        try {
            const res = await fetch('DATOS%20EXCEL/BUFARRA%20ESTADISTICAS%20-%20PARTIDOS.csv' + cacheBuster);
            if (res.ok) {
                window.allMatches = parseCSV(await res.text());
                finishLoad("CSV Excel");
            } else {
                showFallbackWarning();
                finishLoad("FAILED");
            }
        } catch(e) { 
            showFallbackWarning();
            finishLoad("FAILED");
        }
    }
}



function mapMatches(data) {
    return data.map((m, i) => {
        // Normalización de campos entre diferentes fuentes
        const gf = m.gf ?? m.GF ?? '';
        const gc = m.gc ?? m.GC ?? '';
        const vs = m.rival ?? m.VS ?? m.rival_name ?? '';
        const fecha = m.fecha ?? m.FECHA ?? '';
        const torneo = m.torneo ?? m.TORNEO ?? '';
        const instancia = m.instancia ?? m.INSTANCIA ?? '';
        const año = m.año ?? m.AÑO ?? (fecha.includes('-') ? fecha.split('-')[0] : '');

        return {
            ...m,
            ID: m.id || m.ID || `m${i}`,
            FECHA: fecha.includes('-') ? formatDateISO(fecha) : fecha,
            VS: vs,
            torneo: instancia ? `${torneo} - ${instancia}` : torneo,
            torneo_base: torneo,
            AÑO: año,
            LUGAR: m.lugar || m.LUGAR || '',
            GF: String(gf),
            GC: String(gc),
            RESULTADO: (gf !== '' && gc !== '') ? `${gf}x${gc}` : ''
        };
    });
}

function mapPlayers(data) {
    // Si data es un objeto (ej. del JSON local que está agrupado por años)
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        let mapped = {};
        for (const [year, players] of Object.entries(data)) {
            mapped[year] = players.map(p => ({
                PLAYER: p.player_name || p.nombre || p.PLAYER || '',
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
        return mapped;
    }

    // Si data es un array (ej. de Supabase o API local)
    let playersByYear = {};
    if (Array.isArray(data)) {
        data.forEach(p => {
            const year = p.year || 'ALL';
            if (!playersByYear[year]) playersByYear[year] = [];
            playersByYear[year].push({
                PLAYER: p.player_name || p.nombre || p.PLAYER || '',
                PJ: String(p.pj ?? p.PJ ?? 0),
                PG: String(p.pg ?? p.PG ?? 0),
                PE: String(p.pe ?? p.PE ?? 0),
                PP: String(p.pp ?? p.PP ?? 0),
                GOLES: String(p.goles ?? p.GOLES ?? 0),
                ASISTENCIAS: String(p.asistencias ?? p.ASISTENCIAS ?? 0),
                AMARILLAS: String(p.amarillas ?? p.AMARILLAS ?? 0),
                ROJAS: String(p.rojas ?? p.ROJAS ?? 0),
                MVP: String(p.mvp ?? p.MVP ?? 0)
            });
        });
    }
    return playersByYear;
}

function finishLoad(source) {
    console.log(`DB: Proceso de carga finalizado. Fuente: ${source}. Total: ${window.allMatches.length}`);
    window.dataLoaded = true;
    
    // Sort
    window.allMatches.sort((a,b) => parseDateForSort(b.FECHA) - parseDateForSort(a.FECHA));

    // Despachar evento para otros scripts
    document.dispatchEvent(new Event('dataLoaded'));

    // Ejecutar renders si están presentes
    try { if (typeof renderLastMatches === 'function') renderLastMatches(); } catch(e){}
    try { if (typeof renderEfeméride === 'function') renderEfeméride(); } catch(e){}
    try { if (typeof renderNextMatch === 'function') renderNextMatch(); } catch(e){}
    try { if (typeof renderAllMatches === 'function') renderAllMatches(); } catch(e){}
    try { if (typeof applyYearFilters === 'function') applyYearFilters(); } catch(e){}
    try { if (typeof initCounter === 'function') initCounter(); } catch(e){}
}

function formatDateISO(iso) {
    if(!iso) return '';
    const parts = iso.split('-');
    if(parts.length < 3) return iso;
    return `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
}

function parseDateForSort(dateStr) {
    if(!dateStr || typeof dateStr !== 'string') return 0;
    const parts = dateStr.trim().split('/');
    if(parts.length < 2) return 0;
    let d = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    let yStr = parts[2] ? parts[2].trim() : "2026";
    if (yStr.length === 2) yStr = '20' + yStr;
    const y = parseInt(yStr, 10);
    return new Date(y, m - 1, d).getTime() || 0;
}

// ─── CSV PARSER ORIGINAL (Mantenido por seguridad) ───
function parseCSV(text) {
    const lines = text.split('\n');
    let data = [];
    let headers = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        let cells = line.split(',');
        if (line.toUpperCase().includes('AÑO,FECHA,TORNEO')) {
            headers = cells.map(h => h.trim().toUpperCase());
            continue;
        }
        if (headers.length > 0) {
            let startIdx = cells.findIndex(c => /^(20[2-3][0-9])$/.test(c.trim()));
            if (startIdx !== -1) {
                let row = cells.slice(startIdx);
                let obj = {
                    AÑO: row[0], FECHA: row[1], torneo: row[2], VS: row[4],
                    GF: row[5], GC: row[6], LUGAR: row[7], torneo_base: row[2]
                };
                obj.RESULTADO = (obj.GF !== '' && obj.GC !== '') ? `${obj.GF}x${obj.GC}` : '';
                if (obj.VS && obj.RESULTADO) data.push(obj);
            }
        }
    }
    return data;
}

function showFallbackWarning() {
    const list = document.querySelector('.matches-list');
    if(list) list.innerHTML = '<div style="color:var(--accent-primary);padding:2rem;text-align:center;">⚠️ Problema al cargar datos. Recargá la página.</div>';
}

// ─── AUTO-START ───
document.addEventListener('DOMContentLoaded', loadMatches);
// Si por alguna razón el evento no dispara, reintentamos a los 2 segundos
setTimeout(() => { if(!window.dataLoaded) loadMatches(); }, 2000);

// ─── COMPONENTES DE RENDERIZADO (RESTAURADOS) ───

function getRivalShield(name) {
    if (!name) return null;
    const n = name.toString().trim().toUpperCase();
    
    const SHIELDS = {
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
        'TANKENCH': 'img/escudos/ESCUDO_TANKENCH.png'
    };

    // Synonyms
    if (n.includes('RETIRO')) return SHIELDS['EL RETIRO'];
    if (n.includes('BOURBON')) return SHIELDS['BOURBON ST.'];
    if (n.includes('VAGONETA')) return SHIELDS['LA VAGONETA'];
    if (n.includes('RESAKA')) return SHIELDS['LA RESAKA'];
    if (n.includes('VEGANO')) return SHIELDS['FULL VEGANO'];
    
    return SHIELDS[n] || null;
}

function renderNextMatch() {
    const container = document.getElementById('nextMatchCard');
    if (!container) return;
    
    const next = window.allUpcoming && window.allUpcoming.length > 0 ? window.allUpcoming[0] : null;
    
    if (!next) {
        container.innerHTML = '<div style="color:var(--text-muted);">Próximo partido a confirmar</div>';
        return;
    }
    
    const shield = getRivalShield(next.rival);
    const torneo = next.instancia ? `${next.torneo} - ${next.instancia}` : (next.torneo || 'Próximo Partido');

    container.innerHTML = `
        <div>
            <div style="display: flex; justify-content: center; width: 100%;">
                <span class="torneo-tag" style="background:#000; padding: 2px 10px; border-radius:4px;">${torneo}</span>
            </div>
            
            <div class="teams-display" style="margin: 1.5rem 0;">
                <div class="team">
                    <img src="img/logo/ESCUDO_BUFARRA.png" style="width: 28px; height: auto;">
                    <span class="team-name">BUFARRA</span>
                </div>
                <div class="vs-badge" style="font-size: 0.9rem; color: var(--text-muted); border: none;">VS</div>
                <div class="team">
                    ${shield ? `<img src="${shield}" style="width:28px;height:auto;">` : '<i class="ph ph-shield" style="font-size:28px;"></i>'}
                    <span class="team-name">${next.rival || 'A confirmar'}</span>
                </div>
            </div>
            
            <div class="match-details" style="border-top: 1px solid var(--border-light); padding-top: 1rem;">
                <div class="detail-item"><i class="ph ph-calendar-blank"></i> ${next.fecha || 'TBD'}</div>
                <div class="detail-item"><i class="ph ph-clock"></i> ${next.hora || 'TBD'}</div>
                <div class="detail-item"><i class="ph ph-map-pin"></i> ${next.lugar || next.LUGAR || 'TBD'}</div>
            </div>
        </div>
    `;
}

function renderEfeméride() {
    const textEl = document.getElementById('efemerideText');
    if (!textEl) return;
    
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    
    const match = window.allMatches.find(m => {
        if (!m.FECHA) return false;
        const [d, mon] = m.FECHA.split('/');
        return parseInt(d) === day && parseInt(mon) === month;
    });

    if (match) {
        textEl.innerHTML = `Un ${match.FECHA}, La Bufarra jugó contra ${match.VS}. Resultado: ${match.RESULTADO}.`;
    } else {
        textEl.innerHTML = "Hoy no hay partidos históricos en el archivo. ¡A seguir haciendo historia!";
    }
}

function openFixtureModal() {
    const modal = document.getElementById('fixtureModal');
    const container = document.getElementById('fixtureListContainer');
    if (!modal || !container) return;
    
    let html = '';
    
    // TORNEO AUTORITATIVO: Apertura 2026
    const CURRENT_TORNEO = "Apertura 2026";
    
    // 1. Get played matches for this tournament
    const played = (window.allMatches || []).filter(m => 
        (m.torneo || "").toLowerCase().includes("apertura 2026") || 
        (m.torneo || "").toLowerCase().includes("apertura") && String(m.fecha).includes("2026")
    );
    
    // 2. Get upcoming matches
    const upcoming = (window.allUpcoming || []).filter(u => 
        (u.torneo || "").toLowerCase().includes("apertura 2026") || 
        (u.torneo || "").toLowerCase().includes("apertura")
    );
    
    // Helper to parse dates D/M/YYYY
    const parseDate = (s) => {
        if (!s) return 0;
        const [d, m, y] = s.split('/');
        return new Date(y, m - 1, d).getTime();
    };

    // 3. Combine and Sort
    const fullFixture = [
        ...played.map(m => ({ ...m, type: 'played', displayDate: m.FECHA || m.fecha })),
        ...upcoming.map(u => ({ ...u, type: 'upcoming', displayDate: u.fecha }))
    ];
    
    fullFixture.sort((a, b) => parseDate(a.displayDate) - parseDate(b.displayDate));

    if (fullFixture.length === 0) {
        html = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No hay fixture cargado para este torneo aún.</div>';
    } else {
        fullFixture.forEach(m => {
            const rival = m.rival || m.VS || "Rival";
            const shield = getRivalShield(rival);
            const score = m.type === 'played' ? `<span style="font-weight:bold; color:var(--accent-primary); margin-left:10px;">${m.RESULTADO || ''}</span>` : `<span style="font-size:0.7rem; color:var(--text-muted); opacity:0.8;">PRÓXIMO</span>`;
            
            html += `
                <div class="glass-panel" style="padding:1rem; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center; border-left: 3px solid ${m.type === 'played' ? 'var(--accent-primary)' : 'transparent'}">
                    <div style="font-size:0.8rem; font-weight:bold;">${m.displayDate}</div>
                    <div style="display:flex; align-items:center; gap:0.5rem; flex:1; justify-content:center;">
                        ${shield ? `<img src="${shield}" style="width:20px; height:20px; object-fit:contain;">` : ''}
                        <span style="font-size:0.9rem; text-transform:uppercase; font-weight:600;">${rival}</span>
                    </div>
                    <div>${score}</div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
    modal.style.display = 'flex';
}

function closeFixtureModal(e) {
    // If called with an event (click on overlay), only close if clicking the overlay itself
    if (e && e.target && e.target.id !== 'fixtureModal') return;
    const modal = document.getElementById('fixtureModal');
    if (modal) modal.style.display = 'none';
}

function renderLastMatches() {
    const listContainer = document.getElementById('homeLatestMatches');
    if (!listContainer) return;
    if (window.allMatches.length === 0) return;

    listContainer.innerHTML = '';
    const recentMatches = window.allMatches.filter(m => m.VS && m.RESULTADO).slice(0, 1);
    
    if(recentMatches.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">No hay partidos previos</div>';
        return;
    }
    
    const match = recentMatches[0];
    const scoreFormatted = match.RESULTADO ? match.RESULTADO.replace('x', ' - ') : 'N/A';
    const rivalShield = getRivalShield(match.VS);
    const torneo = match.torneo || 'Torneo Actual';

    listContainer.innerHTML = `
        <div>
            <div style="display: flex; justify-content: center; width: 100%;">
                <span class="torneo-tag" style="background:#000; padding: 2px 10px; border-radius:4px;">${torneo}</span>
            </div>
            
            <div class="teams-display" style="margin: 1.5rem 0;">
                <div class="team">
                    <img src="img/logo/ESCUDO_BUFARRA.png" style="width: 28px; height: auto;">
                    <span class="team-name">BUFARRA</span>
                </div>
                <div class="vs-badge">${scoreFormatted}</div>
                <div class="team">
                    ${rivalShield ? `<img src="${rivalShield}" style="width:28px;height:auto;">` : '<i class="ph ph-shield" style="font-size:28px;"></i>'}
                    <span class="team-name">${match.VS || '?'}</span>
                </div>
            </div>
            
            <div class="match-details" style="border-top: 1px solid var(--border-light); padding-top: 1rem;">
                <div class="detail-item"><i class="ph ph-calendar-blank"></i> ${match.FECHA || 'S/D'}</div>
                <div class="detail-item"><i class="ph ph-map-pin"></i> ${match.LUGAR || 'S/D'}</div>
            </div>
        </div>
    `;
}

