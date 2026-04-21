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
            if (res && res.ok) {
                const data = await res.json();
                // Sort by raw ISO date if possible before mapping
                data.sort((a, b) => {
                    const dA = a.fecha ? new Date(a.fecha).getTime() : 0;
                    const dB = b.fecha ? new Date(b.fecha).getTime() : 0;
                    return dA - dB;
                });
                window.allUpcoming = data.map(u => ({
                    ...u,
                    fecha: u.fecha && u.fecha.includes('-') ? formatDateISO(u.fecha) : (u.fecha || '')
                }));
            }
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
            FECHA: formatDateProperly(fecha),
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

function formatDateProperly(s) {
    if (!s) return "TBD";
    const str = String(s).trim();
    if (str === "TBD" || str === "") return "TBD";
    
    // 1. Check for YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

    // 2. Check for DD/MM/YYYY (stay as is)
    const slashesMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashesMatch) return str;

    // 3. Last resort Date object
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return str;
    }
    return str;
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
    
    // Standardize all dates in allMatches immediately
    window.allMatches.forEach(m => {
        if(m.FECHA) m.FECHA = formatDateProperly(m.FECHA);
    });

    // Sort matches by date (descending)
    window.allMatches.sort((a,b) => parseDateForSort(b.FECHA) - parseDateForSort(a.FECHA));

    // Execute renders
    renderEfeméride();
    renderLastMatches();
    renderNextMatch();
    renderLeagueTable();
    renderPlantel2026('general');
    renderLogros();

    // Initial reveal for alert
    setTimeout(() => {
        document.getElementById('efemerideAlert')?.classList.add('show');
    }, 1000);

    // Intersection Observer for scroll highlighting
    initScrollObserver();
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
    
    // Robust date parser for fixture sorting (handles D/M/YYYY)
    const parseDateForFixture = (s) => {
        if (!s) return 0;
        if (s.includes('/')) {
            const parts = s.split('/');
            let d = parseInt(parts[0], 10);
            let m = parseInt(parts[1], 10);
            let y = parseInt(parts[2], 10);
            if (isNaN(y)) y = 2026;
            if (y < 100) y += 2000;
            return new Date(y, m - 1, d).getTime();
        }
        // Fallback for ISO if somehow it missed normalization
        return new Date(s).getTime() || 0;
    };

    // 3. Combine and Sort
    const fullFixture = [
        ...played.map(m => ({ ...m, type: 'played', displayDate: m.FECHA || m.fecha })),
        ...upcoming.map(u => ({ ...u, type: 'upcoming', displayDate: u.fecha }))
    ];
    
    fullFixture.sort((a, b) => parseDateForFixture(a.displayDate) - parseDateForFixture(b.displayDate));

    if (fullFixture.length === 0) {
        html = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No hay fixture cargado para este torneo aún.</div>';
    } else {
        fullFixture.forEach(m => {
            const rival = m.rival || m.VS || "Rival";
            const shield = getRivalShield(rival);
            const score = m.type === 'played' ? `<span style="font-weight:800; color:var(--accent-primary); font-family:var(--font-display);">${m.RESULTADO || ''}</span>` : `<span style="font-size:0.65rem; color:var(--text-muted); font-weight:700; letter-spacing:1px;">PRÓXIMO</span>`;
            
            html += `
                <div class="glass-panel" style="padding:1rem 1.25rem; display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--border-light); border-radius:12px;">
                    <div style="font-size:0.75rem; font-weight:bold; color:var(--text-muted); flex:0.8;">${m.displayDate}</div>
                    <div style="display:flex; align-items:center; gap:0.75rem; flex:2; justify-content:center;">
                        ${shield ? `<img src="${shield}" style="width:22px; height:22px; object-fit:contain;">` : '<i class="ph-bold ph-shield" style="font-size:22px; opacity:0.1;"></i>'}
                        <span style="font-size:0.9rem; text-transform:uppercase; font-weight:700; font-family:var(--font-display);">${rival}</span>
                    </div>
                    <div style="flex:0.8; text-align:right;">${score}</div>
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
    const container = document.getElementById('homeLatestMatches');
    if (!container || !window.allMatches.length) return;

    // Get last matches from 2026
    const matches2026 = window.allMatches.filter(m => m.AÑO == '2026' && m.RESULTADO);
    const lastMatch = matches2026[0];

    if (lastMatch) {
        container.innerHTML = generateMatchCard(lastMatch, 'ÚLTIMO PARTIDO');
    }
}

function renderNextMatch() {
    const container = document.getElementById('nextMatchCard');
    if (!container || !window.allUpcoming) return;

    const nextMatch = window.allUpcoming[0];
    if (nextMatch) {
         container.innerHTML = generateMatchCard(nextMatch, 'PRÓXIMO PARTIDO');
    }
}

function generateMatchCard(m, label) {
    const isUpcoming = label.includes('PRÓXIMO');
    const rivalName = m.VS || m.rival || 'Rival';
    const shield = getRivalShield(rivalName);
    
    // Extract "Fecha X" if available
    let fechaLabel = '';
    const torneoFull = (m.torneo || m.TORNEO || '').toUpperCase();
    const fechaMatch = torneoFull.match(/FECHA\s?(\d+)/i);
    if (fechaMatch) {
        fechaLabel = `FECHA ${fechaMatch[1]}`;
    } else {
        // Fallback or specific default for 2026
        fechaLabel = "APERTURA 2026";
    }

    const rawFecha = m.fecha || m.FECHA || 'TBD';
    const formattedFecha = formatDateProperly(rawFecha);
    
    // Time handling
    const hora = m.hora || m.HORA || '';
    const timeDisplay = (hora && !hora.includes('TBD') && hora.trim() !== '') ? `<div style="font-size:0.9rem; margin-top:0.3rem;"><i class="ph-bold ph-clock"></i> ${hora} HS</div>` : '';

    return `
        <div class="glass-panel match-card-unified" style="height: 100%; display: flex; flex-direction: column; justify-content: center; padding: 2.5rem; text-align: center; position: relative; border: 1px solid var(--border-light); ${isUpcoming ? 'border-left: 4px solid var(--accent-primary);' : ''} min-height: 420px;">
            <div style="font-family:var(--font-display); font-size:0.8rem; color:var(--accent-primary); letter-spacing:3px; font-weight:800; text-transform:uppercase; margin-bottom: 2rem;">${label}</div>
            
            <div style="font-family:var(--font-display); font-size:1.1rem; font-weight:900; margin-bottom: 2rem; color:var(--text-muted); opacity: 0.8;">${fechaLabel}</div>

            <div style="display:grid; grid-template-columns: 1fr 60px 1fr; align-items:center; gap: 1.5rem; margin-bottom: 2.5rem;">
                <!-- La Bufarra -->
                <div style="display:flex; flex-direction:column; align-items:center;">
                    <img src="img/logo/ESCUDO_BUFARRA.png" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 1rem;">
                    <div style="font-family:var(--font-display); font-size:1.1rem; font-weight:800; text-transform:uppercase;">La Bufarra</div>
                </div>

                <!-- Resultado o VS -->
                <div style="font-family:var(--font-display); font-size: 2.5rem; font-weight:900; color:var(--accent-primary);">
                    ${isUpcoming ? 'VS' : m.RESULTADO.replace('x', '-')}
                </div>

                <!-- Rival -->
                <div style="display:flex; flex-direction:column; align-items:center;">
                    <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.05); border-radius: 50%; display:flex; align-items:center; justify-content:center; margin-bottom: 1rem; border: 1px solid var(--border-light);">
                        ${shield ? `<img src="${shield}" style="width: 50px; height: 50px; object-fit: contain;">` : `<i class="ph-bold ph-shield" style="font-size: 2rem; opacity: 0.3;"></i>`}
                    </div>
                    <div style="font-family:var(--font-display); font-size:1.1rem; font-weight:800; text-transform:uppercase;">${rivalName}</div>
                </div>
            </div>

            <div style="font-family:var(--font-display); font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.5rem;">
                <div><i class="ph-bold ph-calendar"></i> ${formattedFecha}</div>
                ${timeDisplay}
                <div style="font-size:0.8rem; margin-top:0.5rem; opacity:0.6;"><i class="ph-bold ph-map-pin"></i> ${m.LUGAR || 'Lugar a confirmar'}</div>
            </div>
        </div>
    `;
}

function renderStatsLeaders2026() {
    const players2026 = window.allPlayers['2026'] || [];
    if (players2026.length === 0) return;

    const topGoleador = [...players2026].sort((a,b) => b.GOLES - a.GOLES)[0];
    const topAsistidor = [...players2026].sort((a,b) => b.ASISTENCIAS - a.ASISTENCIAS)[0];
    const topPJ = [...players2026].sort((a,b) => b.PJ - a.PJ)[0];

    if(topGoleador) {
        document.getElementById('topGoleadorValue').innerText = topGoleador.GOLES;
        document.getElementById('topGoleadorName').innerText = topGoleador.PLAYER;
    }
    if(topAsistidor) {
        document.getElementById('topAsistidorValue').innerText = topAsistidor.ASISTENCIAS;
        document.getElementById('topAsistidorName').innerText = topAsistidor.PLAYER;
    }
    if(topPJ) {
        document.getElementById('topPJValue').innerText = topPJ.PJ;
        document.getElementById('topPJName').innerText = topPJ.PLAYER;
    }
}

function renderLeagueTable(expanded = false) {
    const container = document.getElementById('leagueTableContainer');
    if (!container) return;

    const teams = [
        { pos: 1, name: "La Costa FC", pj: 1, pts: 3 },
        { pos: 2, name: "Berges FC (Dom)", pj: 1, pts: 3 },
        { pos: 3, name: "FC Fernetbache", pj: 1, pts: 3 },
        { pos: 4, name: "Porte FC (Domingo)", pj: 1, pts: 3 },
        { pos: 5, name: "Parque Guarani", pj: 1, pts: 3 },
        { pos: 6, name: "LA BUFARRA", pj: 1, pts: 1, highlighted: true },
        { pos: 7, name: "Safaera FC", pj: 1, pts: 0 },
        { pos: 8, name: "C. A. Magna", pj: 1, pts: 0 },
        { pos: 9, name: "Alta Gama F.C", pj: 1, pts: 0 },
        { pos: 10, name: "C. A. Parenaese", pj: 1, pts: 0 },
        { pos: 11, name: "Prestcold FC", pj: 1, pts: 0 },
        { pos: 12, name: "ENFUGEIRA FC", pj: 1, pts: 0 }
    ];

    let displayTeams = expanded ? teams : teams.filter(t => t.highlighted);

    let html = `
        <div class="glass-panel" id="tableWidget" style="cursor:pointer; padding: 2.5rem; transition: all 0.5s ease; border: ${expanded ? '2px solid var(--accent-primary)' : '1px solid var(--border-light)'}; box-shadow: ${expanded ? '0 0 50px var(--accent-glow)' : 'none'}; overflow: hidden;">
            <div style="text-align:center; margin-bottom: 2.5rem;">
                <div style="font-family:var(--font-display); font-size:0.8rem; color:var(--accent-primary); letter-spacing:4px; font-weight:800; text-transform:uppercase;">Campaña Apertura 2026</div>
                <h2 style="font-family:var(--font-display); font-size:2.2rem; font-weight:900; margin: 0.5rem 0;">TABLA DE POSICIONES</h2>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${displayTeams.map(t => {
                    const isBufarra = t.highlighted;
                    return `
                        <div style="display:grid; grid-template-columns: 60px 1fr 80px 80px; align-items:center; transition: all 0.3s ease; padding: 1.2rem; background: ${isBufarra ? 'rgba(255,107,129,0.1)' : 'transparent'}; border-radius: 12px; border: ${isBufarra ? '1px solid var(--accent-primary)' : '1px solid transparent'};">
                            <div style="font-family:var(--font-display); font-size:1.5rem; font-weight:900; color:${isBufarra ? 'var(--accent-primary)' : '#fff'};">${t.pos}º</div>
                            <div style="font-family:var(--font-display); font-size: 1.1rem; font-weight:800; color:#fff; text-transform:uppercase;">${t.name}</div>
                            <div style="text-align:center; font-weight:700; color:var(--text-muted); font-size:1rem;">${t.pj} <small style="display:block; font-size:0.6rem; opacity:0.6; text-transform:uppercase;">PJ</small></div>
                            <div style="text-align:center; font-weight:900; color:var(--accent-primary); font-size:1.2rem;">${t.pts} <small style="display:block; font-size:0.6rem; opacity:0.6; text-transform:uppercase; color:var(--text-muted);">PTS</small></div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div style="text-align:center; margin-top: 2rem; color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:3px; font-weight:800; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.5rem;">
                <i class="ph-bold ${expanded ? 'ph-caret-up' : 'ph-caret-down'}" style="margin-right: 8px; font-size: 1.2rem;"></i> ${expanded ? 'Cerrar tabla' : 'Ver tabla completa'}
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    // FORCE CLICK HANDLER
    const widgetElement = document.getElementById('tableWidget');
    if (widgetElement) {
        widgetElement.onclick = function() {
            renderLeagueTable(!expanded);
        };
    }
}

function filterPlantel(type, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderPlantel2026(type);
}
window.filterPlantel = filterPlantel; 

function renderPlantel2026(statType = 'general') {
    const container = document.getElementById('playersGrid');
    if (!container) return;
    container.innerHTML = '';

    // Get 2026 Players
    let allPlayers2026 = [...(window.allPlayers['2026'] || [])];
    
    // Split Players and Staff
    const staffKeywords = ["DT", "Cpo", "Cuerpo", "Asistente", "Delegado", "Delegada"];
    let players = allPlayers2026.filter(p => !staffKeywords.some(kw => p.PLAYER.includes(kw)));
    let staff = allPlayers2026.filter(p => staffKeywords.some(kw => p.PLAYER.includes(kw)));

    // Filtering & Sorting
    if (statType !== 'general') {
        const statMap = { 'goles': 'GOLES', 'asistencias': 'ASISTENCIAS', 'tarjetas': 'tarjetas' }; // tarjetas will be handled below
        
        players = players.filter(p => {
            if (statType === 'tarjetas') return (parseInt(p.AMARILLAS || 0) + parseInt(p.ROJAS || 0)) > 0;
            const val = parseInt(p[statMap[statType]] || 0);
            return val > 0;
        });

        players.sort((a, b) => {
            if (statType === 'tarjetas') {
                const totalA = parseInt(a.AMARILLAS || 0) + parseInt(a.ROJAS || 0);
                const totalB = parseInt(b.AMARILLAS || 0) + parseInt(b.ROJAS || 0);
                return totalB - totalA;
            }
            return parseInt(b[statMap[statType]] || 0) - parseInt(a[statMap[statType]] || 0);
        });
        
        // No staff in filtered views
        staff = [];
    } else {
        // Alphabetical sort by Surname for General
        players.sort((a, b) => {
            const getLastName = (full) => {
                const parts = full.trim().toUpperCase().split(' ');
                if (parts.length > 1 && ["DE", "DEL", "DI"].includes(parts[parts.length - 2])) {
                    return parts.slice(-2).join(' ');
                }
                return parts[parts.length - 1];
            };
            return getLastName(a.PLAYER).localeCompare(getLastName(b.PLAYER));
        });
    }

    const drawCard = (p) => {
        const isStaff = staffKeywords.some(kw => p.PLAYER.includes(kw));
        const img = getPlayerImage(p.PLAYER);
        
        let statDisplay = '';
        if (statType === 'general' || isStaff) {
            statDisplay = `
                <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap: 5px; width: 100%; border-top:1px solid rgba(255,255,255,0.05); padding-top: 1rem; margin-top: 1rem;">
                    <div style="text-align:center;"><small style="display:block; font-size:0.55rem; color:var(--text-muted);">PJ</small><span style="font-weight:700;">${p.PJ}</span></div>
                    <div style="text-align:center;"><small style="display:block; font-size:0.55rem; color:var(--text-muted);">G</small><span style="font-weight:700; color:var(--accent-primary);">${p.GOLES}</span></div>
                    <div style="text-align:center;"><small style="display:block; font-size:0.55rem; color:var(--text-muted);">A</small><span style="font-weight:700;">${p.ASISTENCIAS}</span></div>
                    <div style="text-align:center;"><small style="display:block; font-size:0.55rem; color:var(--text-muted);">AM</small><span style="font-weight:700; color:#ffd700;">${p.AMARILLAS}</span></div>
                    <div style="text-align:center;"><small style="display:block; font-size:0.55rem; color:var(--text-muted);">RO</small><span style="font-weight:700; color:#ff4d4d;">${p.ROJAS}</span></div>
                </div>
            `;
        } else if (statType === 'goles') {
            statDisplay = `<div style="font-family:var(--font-display); font-size: 1.5rem; font-weight:900; color:var(--accent-primary); margin-top:1rem;">${p.GOLES} <small style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">GOLES</small></div>`;
        } else if (statType === 'asistencias') {
            statDisplay = `<div style="font-family:var(--font-display); font-size: 1.5rem; font-weight:900; color:var(--accent-primary); margin-top:1rem;">${p.ASISTENCIAS} <small style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">ASIST</small></div>`;
        } else if (statType === 'tarjetas') {
            const total = parseInt(p.AMARILLAS || 0) + parseInt(p.ROJAS || 0);
            statDisplay = `
                <div style="display:flex; gap:1.5rem; margin-top:1rem;">
                    <div style="display:flex; align-items:center; gap:5px;"><div style="width:12px; height:18px; background:#ffd700; border-radius:2px;"></div> <span style="font-weight:800;">${p.AMARILLAS}</span></div>
                    <div style="display:flex; align-items:center; gap:5px;"><div style="width:12px; height:18px; background:#ff4d4d; border-radius:2px;"></div> <span style="font-weight:800;">${p.ROJAS}</span></div>
                </div>
            `;
        }

        return `
            <div class="glass-panel" style="display:flex; flex-direction:column; align-items:center; padding: 2rem; border-radius: 20px; transition: all 0.3s ease;">
                <div style="width: 120px; height: 120px; border-radius: 50%; overflow: hidden; margin-bottom: 1.5rem; border: 2px solid ${isStaff ? 'var(--text-muted)' : 'var(--accent-primary)'};">
                    <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="font-family:var(--font-display); font-weight: 800; font-size: 1rem; text-transform: uppercase; color: #fff; text-align:center;">${p.PLAYER}</div>
                ${isStaff ? `<div style="font-size:0.7rem; color:var(--accent-primary); text-transform:uppercase; font-weight:700; margin-top:0.3rem;">Staff Técnico</div>` : ''}
                ${statDisplay}
            </div>
        `;
    };

    players.forEach(p => container.innerHTML += drawCard(p));
    staff.forEach(s => container.innerHTML += drawCard(s));

    // Custom "Ver más" Card
    const links = {
        'general': { text: 'Ver todos los planteles', url: 'jugadores.html' },
        'goles': { text: 'Goleadores históricos', url: 'jugadores.html?filter=goles' },
        'asistencias': { text: 'Asistidores históricos', url: 'jugadores.html?filter=asistencias' },
        'tarjetas': { text: 'Disciplina histórica', url: 'jugadores.html?filter=tarjetas' }
    };
    
    container.innerHTML += `
        <a href="${links[statType].url}" class="glass-panel" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:2rem; text-decoration:none; border:1px dashed var(--accent-primary); min-height: 250px;">
            <i class="ph-bold ph-arrow-right" style="font-size:2.5rem; color:var(--accent-primary); margin-bottom:1rem;"></i>
            <span style="color:#fff; font-weight:800; text-transform:uppercase; font-size:0.9rem; text-align:center;">${links[statType].text}</span>
        </a>
    `;
}

function renderPartidos2026() {
    const container = document.getElementById('allMatchesContainer');
    if (!container) return;

    const matches2026 = window.allMatches.filter(m => String(m.AÑO) === '2026' || String(m.FECHA).includes('2026'));
    if (matches2026.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:2rem;">Aún no hay partidos registrados en 2026.</div>';
        return;
    }

    container.innerHTML = '';
    matches2026.forEach(m => {
        const score = m.RESULTADO || '-x-';
        const rivalShield = getRivalShield(m.VS);
        
        container.innerHTML += `
            <div class="glass-panel" style="padding:1rem 1.5rem; display:flex; align-items:center; justify-content:space-between; gap:1rem;">
                <div style="flex:0.8; font-size:0.85rem; color:var(--text-muted); font-weight:600;">${m.FECHA}</div>
                <div style="flex:2; display:flex; align-items:center; gap:0.75rem; justify-content:center;">
                    ${rivalShield ? `<img src="${rivalShield}" style="width:24px; height:24px; object-fit:contain;">` : '<i class="ph-bold ph-shield" style="font-size:24px; opacity:0.1;"></i>'}
                    <span style="font-family:var(--font-display); font-weight:700; font-size:1rem; text-transform:uppercase;">${m.VS}</span>
                </div>
                <div style="flex:0.8; text-align:right;">
                    <span style="background:rgba(255,107,129,0.1); color:var(--accent-primary); padding:0.25rem 0.75rem; border-radius:6px; font-weight:800; font-family:var(--font-display);">${score}</span>
                </div>
            </div>
        `;
    });
}

function renderLogros() {
    const container = document.getElementById('trophiesContainer');
    if (!container) return;

    const trophies = [
        { year: '2021', name: 'CLAUSURA', id: '2021-clausura' },
        { year: '2023', name: 'APERTURA', id: '2023-apertura' },
        { year: '2023', name: 'C. CAMPEONES', id: '2023-copa-de-campeones' },
        { year: '2025', name: 'CLAUSURA', id: '2025-clausura' }
    ];

    container.innerHTML = '';
    trophies.forEach(t => {
        container.innerHTML += `
            <a href="campeonatos.html#trofeo-${t.id}" class="glass-panel" style="padding:2rem 1.5rem; text-align:center; flex:1; min-width:200px; display:flex; flex-direction:column; align-items:center; gap:0.5rem; border:1px solid var(--border-light); text-decoration:none; transition: transform 0.3s ease;">
                <i class="ph-fill ph-trophy" style="font-size:3rem; color:var(--accent-primary); filter: drop-shadow(0 0 15px var(--accent-glow)); margin-bottom:1rem;"></i>
                <div style="font-family:var(--font-display); font-size:0.85rem; font-weight:800; color:var(--text-muted); letter-spacing:2px;">${t.year}</div>
                <div style="font-family:var(--font-display); font-size:1.1rem; font-weight:800; color:#fff; text-transform:uppercase;">${t.name}</div>
                <div style="font-size:0.65rem; color:var(--accent-primary); font-weight:700; text-transform:uppercase; letter-spacing:1px;">Título Oficial</div>
            </a>
        `;
    });
}

function handleGlobalSearch(q) {
    const dropdown = document.getElementById('searchResultsDropdown');
    if (!dropdown) return;
    if (!q || q.trim().length < 2) {
        dropdown.style.display = 'none';
        return;
    }

    const query = q.toLowerCase().trim();
    let results = [];

    // Search Players
    Object.values(window.allPlayers).flat().forEach(p => {
        if (p.PLAYER && p.PLAYER.toLowerCase().includes(query)) {
            results.push({ type: 'player', label: p.PLAYER, sub: 'Jugador Histórico', icon: 'ph-user' });
        }
    });

    // Search Matches & Rivals
    window.allMatches.forEach(m => {
        const rival = m.VS || m.rival || '';
        if (rival.toLowerCase().includes(query)) {
            results.push({ type: 'rival', label: rival, sub: `Rival - ${m.AÑO}`, icon: 'ph-shield' });
        }
        const torneo = m.torneo || '';
        if (torneo.toLowerCase().includes(query)) {
            results.push({ type: 'tournament', label: torneo, sub: `Torneo - ${m.AÑO}`, icon: 'ph-trophy' });
        }
        const fecha = m.FECHA || m.fecha || '';
        if (fecha.includes(query)) {
            results.push({ type: 'date', label: fecha, sub: `Partido vs ${rival}`, icon: 'ph-calendar' });
        }
    });

    // De-duplicate results
    const seen = new Set();
    const finalResults = results.filter(r => {
        const key = `${r.type}-${r.label.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 10);

    if (finalResults.length > 0) {
        dropdown.innerHTML = finalResults.map(r => `
            <div onclick="handleSearchClick('${r.type}', '${r.label}')" class="search-item-suggestion" style="display:flex; align-items:center; gap:1rem; padding:0.75rem 1rem; cursor:pointer; border-radius:10px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <i class="ph-bold ${r.icon}" style="color:var(--accent-primary); font-size:1.2rem;"></i>
                <div style="flex:1;">
                    <div style="font-weight:800; color:#fff; font-size:0.9rem; text-transform:uppercase;">${r.label}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">${r.sub}</div>
                </div>
            </div>
        `).join('');
        dropdown.style.display = 'block';
    } else {
        dropdown.innerHTML = '<div style="padding:1rem; color:var(--text-muted); text-align:center; font-size:0.8rem;">No se encontraron resultados.</div>';
        dropdown.style.display = 'block';
    }
}

function handleSearchClick(type, label) {
    if (type === 'player') window.location.href = `jugadores.html?search=${encodeURIComponent(label)}`;
    else if (type === 'rival') window.location.href = `partidos.html?rival=${encodeURIComponent(label)}`;
    else if (type === 'tournament') window.location.href = `campeonatos.html?tournament=${encodeURIComponent(label)}`;
    else if (type === 'date') window.location.href = `partidos.html?date=${encodeURIComponent(label)}`;
}

window.handleGlobalSearch = handleGlobalSearch;
window.handleSearchClick = handleSearchClick;

function initScrollObserver() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links a');

    const observerOptions = {
        root: null,
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
}

