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
    console.log("%c DB: Iniciando carga de datos... ", "background: #e91e63; color: #white; font-weight: bold;");
    const cacheBuster = `?t=${Date.now()}`;
    
    // ─── PASO 1: Intentar API Local (server.py) ───
    try {
        console.log("DB: Probando API Local...");
        const res = await fetch('/api/matches' + cacheBuster).catch(() => ({ok:false}));
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                window.allMatches = mapMatches(data);
                console.log("DB: ✅ Cargado desde API Local.");
                // Si cargó partidos, intentamos otros datos de la misma fuente
                const pRes = await fetch('/api/players' + cacheBuster).catch(() => null);
                if (pRes && pRes.ok) {
                    const pData = await pRes.json();
                    window.allPlayers = mapPlayers(pData);
                }
                const uRes = await fetch('/api/upcoming' + cacheBuster).catch(() => null);
                if (uRes && uRes.ok) window.allUpcoming = await uRes.json();
                
                finishLoad("API Local");
                return;
            }
        }
    } catch(e) { console.warn("DB: Falló API Local."); }

    // ─── PASO 2: Intentar Supabase (Nube) ───
    if (window.allMatches.length === 0) {
        try {
            console.log("DB: Probando Supabase...");
            const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=*&order=fecha.desc`, { headers: SP_HEADERS });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    window.allMatches = mapMatches(data);
                    console.log("DB: ✅ Cargado desde Supabase.");
                    
                    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/players_stats?select=*`, { headers: SP_HEADERS });
                    if (pRes.ok) {
                        const pData = await pRes.json();
                        window.allPlayers = mapPlayers(pData);
                    }
                    
                    finishLoad("Supabase Cloud");
                    return;
                }
            }
        } catch(e) { console.warn("DB: Falló Supabase."); }
    }

    // ─── PASO 3: Intentar JSON Estático ───
    if (window.allMatches.length === 0) {
        try {
            console.log("DB: Probando JSON Estático...");
            const res = await fetch('data/matches.json' + cacheBuster).catch(() => ({ok:false}));
            if (res.ok) {
                const data = await res.json();
                window.allMatches = mapMatches(data);
                if (window.allMatches.length > 0) {
                    console.log("DB: ✅ Cargado desde JSON Estático.");
                    finishLoad("Static JSON");
                    return;
                }
            }
        } catch(e) { console.warn("DB: Falló JSON Estático."); }
    }

    // ─── PASO 4: Intentar CSV (Excel Original) ───
    if (window.allMatches.length === 0) {
        try {
            console.log("DB: Probando CSV (Excel)...");
            const res = await fetch('DATOS%20EXCEL/BUFARRA%20ESTADISTICAS%20-%20PARTIDOS.csv' + cacheBuster);
            if (res.ok) {
                const text = await res.text();
                window.allMatches = parseCSV(text);
                console.log("DB: ✅ Cargado desde Excel CSV.");
                finishLoad("CSV Excel");
                return;
            }
        } catch(e) { console.warn("DB: Falló CSV."); }
    }

    // Si llegamos acá y no hay nada...
    console.error("DB: No se encontró información en ninguna fuente.");
    showFallbackWarning();
    finishLoad("FAILED");
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
            GF: String(gf),
            GC: String(gc),
            RESULTADO: (gf !== '' && gc !== '') ? `${gf}x${gc}` : ''
        };
    });
}

function mapPlayers(data) {
    let playersByYear = {};
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
    const upcoming = window.allUpcoming || [];
    
    if (upcoming.length === 0) {
        html = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No hay fixture cargado para este torneo aún.</div>';
    } else {
        upcoming.forEach(u => {
            const shield = getRivalShield(u.rival);
            html += `
                <div class="glass-panel" style="padding:1rem; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.8rem; font-weight:bold;">${u.fecha}</div>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        ${shield ? `<img src="${shield}" style="width:20px;">` : ''}
                        <span style="font-size:0.9rem;">${u.rival}</span>
                    </div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
    modal.style.display = 'flex';
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

