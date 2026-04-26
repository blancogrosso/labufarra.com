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

// Mapeo Maestro de Jugadores (Nombres Reales y Apodos)
window.PLAYER_MAP = {
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
    'Rodriguez': { fullName: 'Guillermo Rodriguez', aliases: ['Guille'] },
    'Bruno Silva': { fullName: 'Bruno Silva', aliases: ['Bruno', 'Silva'] },
    'Gaston Silva': { fullName: 'Gaston Silva', aliases: ['Silva Gaston'] },
    'Diego Rocca': { fullName: 'Diego Rocca', aliases: ['Rocca'] },
    'Sparkov': { fullName: 'Santiago Sparkov', aliases: ['Spark', 'Sparky'] },
    'Valle': { fullName: 'Joaquin Valle', aliases: ['Joaco'] },
    'Vigil': { fullName: 'Sebastian Vigil', aliases: ['Seba'] },
    'Balestie': { fullName: 'Kevin Balestie', aliases: ['Kevin'] }
};

async function loadMatches() {
    console.log("%c DB: Iniciando carga de datos híbrida... ", "background: #e91e63; color: white; font-weight: bold;");
    const cacheBuster = `?t=${Date.now()}`;
    
    const tryLocal = async () => {
        try {
            // PRIORIDAD 1: Datos inyectados desde el Excel directamente
            if (window.PLAYERS_EXCEL_DATA) {
                window.allPlayers = mapPlayers(window.PLAYERS_EXCEL_DATA);
            }

            const mRes = await fetch('data/matches.json' + cacheBuster).catch(() => null);
            if (!mRes || !mRes.ok) return false;
            window.allMatches = mapMatches(await mRes.json());
            
            // Si no hay datos inyectados, probar el JSON de siempre
            if (!window.allPlayers) {
                const pRes = await fetch('data/players.json' + cacheBuster).catch(() => null);
                if (pRes && pRes.ok) window.allPlayers = mapPlayers(await pRes.json());
            }
            
            const uRes = await fetch('data/upcoming.json' + cacheBuster).catch(() => null);
            if (uRes && uRes.ok) window.allUpcoming = await uRes.json();
            return true;
        } catch (e) { return false; }
    };

    const trySupabase = async () => {
        try {
            // No sobrescribir si ya tenemos los datos del Excel
            if (window.allPlayers && window.PLAYERS_EXCEL_DATA) {
                console.log("DB: Usando Excel inyectado, omitiendo carga de Supabase para Jugadores.");
            } else {
                const pRes = await fetch(`${SUPABASE_URL}/rest/v1/players_stats?select=*`, { headers: SP_HEADERS }).catch(() => null);
                if (pRes && pRes.ok) window.allPlayers = mapPlayers(await pRes.json());
            }

            const mRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=*&order=fecha.desc`, { headers: SP_HEADERS }).catch(() => null);
            if (!mRes || !mRes.ok) return false;
            window.allMatches = mapMatches(await mRes.json());
            
            const uRes = await fetch(`${SUPABASE_URL}/rest/v1/upcoming?select=*&order=fecha.asc`, { headers: SP_HEADERS }).catch(() => null);
            if (uRes && uRes.ok) window.allUpcoming = await uRes.json();
            return true;
        } catch (e) { return false; }
    };

    const tryCSV = async () => {
        try {
            const res = await fetch('DATOS%20EXCEL/BUFARRA%20ESTADISTICAS%20-%20PARTIDOS.csv' + cacheBuster).catch(() => null);
            if (!res || !res.ok) return false;
            window.allMatches = parseCSV(await res.text());
            return true;
        } catch (e) { return false; }
    };

    let source = "NONE";
    if (await tryLocal()) source = "Local JSON";
    else if (await trySupabase()) source = "Supabase Cloud";
    else if (await tryCSV()) source = "CSV Fallback";
    else source = "FAILED";

    finishLoad(source);
}



function mapMatches(data) {
    if (!Array.isArray(data)) return [];
    return data.map((m, i) => {
        // Normalización maestra de campos (Soporta múltiples fuentes)
        const gf = (m.gf !== undefined && m.gf !== null) ? m.gf : (m.GF !== undefined ? m.GF : '');
        const gc = (m.gc !== undefined && m.gc !== null) ? m.gc : (m.GC !== undefined ? m.GC : '');
        const vs = m.rival || m.VS || m.rival_name || '';
        const fecha = m.fecha || m.FECHA || '';
        const torneo = m.torneo || m.TORNEO || '';
        const instancia = m.instancia || m.INSTANCIA || '';
        const año = m.año || m.AÑO || (fecha.includes('-') ? fecha.split('-')[0] : (fecha.includes('/') ? fecha.split('/').pop() : ''));
        const res = m.resultado || m.RESULTADO || (gf !== '' && gc !== '' ? (parseInt(gf) > parseInt(gc) ? 'V' : parseInt(gf) < parseInt(gc) ? 'D' : 'E') : '');

        return {
            ...m,
            ID: m.id || m.ID || `m${i}`,
            FECHA: formatDateProperly(fecha),
            VS: vs,
            RESULTADO: res,
            GF: gf,
            GC: gc,
            torneo: instancia ? `${torneo} - ${instancia}` : torneo,
            torneo_base: torneo,
            AÑO: año,
            LUGAR: m.lugar || m.LUGAR || ''
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

function getPlayerImage(name) {
    if (!name) return "img/jugadores/default.jpg";
    // Mapeo básico para asegurar que usamos el nombre del archivo correcto
    const filename = name.trim();
    return `img/jugadores/${filename}.jpg`;
}

function mapPlayers(data) {
    if (!data) return {};
    window.rawPlayersData = data;
    let mapped = {};

    const normalize = (p) => {
        let name = p.player_name || p.nombre || p.PLAYER || '';
        name = name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (name.toLowerCase().includes('rocca')) name = 'Diego Rocca';
        if (name.toLowerCase().includes('gaston silva')) name = 'Gaston Silva';
        if (name.toLowerCase() === 'de leon') name = 'De Leon';
        
        return {
            PLAYER: name,
            PJ: parseInt(p.pj ?? p.PJ ?? 0),
            PG: parseInt(p.pg ?? p.PG ?? 0),
            PE: parseInt(p.pe ?? p.PE ?? 0),
            PP: parseInt(p.pp ?? p.PP ?? 0),
            GOLES: parseInt(p.goles ?? p.GOLES ?? 0),
            ASISTENCIAS: parseInt(p.asistencias ?? p.ASISTENCIAS ?? 0),
            AMARILLAS: parseInt(p.amarillas ?? p.AMARILLAS ?? 0),
            ROJAS: parseInt(p.rojas ?? p.ROJAS ?? 0),
            MVP: parseInt(p.mvp ?? p.MVP ?? 0)
        };
    };

    // SI VIENE EL EXCEL DIRECTAMENTE (OBJETO CON ALL)
    if (data.ALL && !Array.isArray(data)) {
        for (const [key, content] of Object.entries(data)) {
            if (Array.isArray(content)) {
                mapped[key] = content.map(p => normalize(p));
            } else if (typeof content === 'object') {
                let yearPlayers = [];
                for (const tData of Object.values(content)) {
                    const nodes = tData.jugadores || tData;
                    if (Array.isArray(nodes)) nodes.forEach(p => yearPlayers.push(normalize(p)));
                }
                mapped[key] = yearPlayers;
            }
        }
        return mapped;
    }

    // SI ES UN ARRAY PLANO (Supabase)
    if (Array.isArray(data)) {
        mapped.ALL = [];
        data.forEach(p => {
            const yr = String(p.year || p.YEAR || 'ALL');
            if (!mapped[yr]) mapped[yr] = [];
            const norm = normalize(p);
            mapped[yr].push(norm);
            
            if (yr !== 'ALL') {
                const existing = mapped.ALL.find(e => e.PLAYER.toUpperCase() === norm.PLAYER.toUpperCase());
                if (existing) {
                    existing.PJ += norm.PJ;
                    existing.PG += norm.PG;
                    existing.PE += norm.PE;
                    existing.PP += norm.PP;
                    existing.GOLES += norm.GOLES;
                    existing.ASISTENCIAS += norm.ASISTENCIAS;
                    existing.AMARILLAS += norm.AMARILLAS;
                    existing.ROJAS += norm.ROJAS;
                    existing.MVP += norm.MVP;
                } else {
                    mapped.ALL.push(JSON.parse(jsonStringifySafe(norm))); // Deep copy manual
                }
            }
        });
        return mapped;
    }

    return mapped;
}

// Helper para evitar problemas de referencia en el merge de ALL
function jsonStringifySafe(obj) {
    return JSON.stringify(obj);
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

    // Execute renders safely
    const safeRender = (fn, name) => {
        try {
            fn();
            console.log(`DB: Renderizado OK -> ${name}`);
        } catch (e) {
            console.error(`DB: Error en renderizado ${name}:`, e);
        }
    };

    safeRender(renderEfeméride, "Efeméride");
    safeRender(renderLastMatches, "Ultimo Partido");
    safeRender(renderNextMatch, "Proximo Partido");
    safeRender(renderLeagueTable, "Tabla");
    safeRender(() => renderPlantel2026('general'), "Plantel");
    safeRender(renderLogros, "Palmarés");

    // Detectar cambios en el próximo partido para notificar al usuario
    const nextMatch = window.allUpcoming && window.allUpcoming.length > 0 ? window.allUpcoming[0] : null;
    if (nextMatch) {
        const matchID = nextMatch.id || nextMatch.ID || 'next';
        const currentMatchStr = JSON.stringify({ 
            id: matchID, 
            fecha: nextMatch.fecha || nextMatch.FECHA, 
            hora: nextMatch.hora || nextMatch.HORA,
            lugar: nextMatch.lugar || nextMatch.LUGAR
        });
        const lastMatchStr = localStorage.getItem('bufarra_last_next_match');
        if (lastMatchStr && lastMatchStr !== currentMatchStr) {
            if (localStorage.getItem('bufarra_notifications') === 'true' && Notification.permission === "granted") {
                new Notification("¡Actualización de Partido!", {
                    body: `Hay cambios en el partido contra ${nextMatch.rival || nextMatch.VS}. ¡Revisá el fixture!`,
                    icon: "img/logo/ESCUDO_BUFARRA.png"
                });
            }
        }
        localStorage.setItem('bufarra_last_next_match', currentMatchStr);
    }

    // Restore UI components
    setTimeout(() => {
        document.getElementById('efemerideAlert')?.classList.add('show');
    }, 1000);

    initScrollObserver();
    
    document.dispatchEvent(new CustomEvent('dataLoaded'));
}

/**
 * Función de animación para contadores numéricos de alto impacto
 */
function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el || isNaN(target) || target === 0) {
        if (el) el.innerText = target;
        return;
    }
    
    let current = 0;
    const duration = 1500; // ms de animación fluida (1.5s)
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (outQuart) para suavizado premium
        const ease = 1 - Math.pow(1 - progress, 4);
        current = Math.floor(ease * target);
        
        el.innerText = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.innerText = target;
        }
    }
    
    requestAnimationFrame(update);
}
window.animateCounter = animateCounter;

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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMatches);
} else {
    loadMatches();
}

// ─── COMPONENTES DE RENDERIZADO (RESTAURADOS) ───

function getRivalShield(name) {
    if (!name) return null;
    const n = name.toString().trim().toUpperCase();
    
    // Normalizar nombre de forma agresiva para encontrar el escudo
    let fileName = n.toLowerCase()
        .replace(/\./g, '')
        .replace(/\b(fc|f\.c|ca|c\.a|deportiva|club|atletico|asociacion)\b/gi, '')
        .replace(/\(.*\)/g, '') // Quitar (Dom), (Domingo), etc.
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
        .trim();

    // Casos especiales históricos persistentes
    const SPECIAL_SHIELDS = {
        'EL RETIRO': 'img/escudos/el-retiro.png',
        'BOURBON ST': 'img/escudos/bourbon-st.png',
        'PARQUE GUARANI': 'img/escudos/parque-guarani.png',
        'ALTA GAMA': null 
    };

    if (SPECIAL_SHIELDS[n]) return SPECIAL_SHIELDS[n];
    
    const finalClean = fileName.replace(/\s+/g, '-');
    return `img/escudos/${finalClean}.png`;
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
            
            // Formatear Fecha para mostrar
            const rawDate = m.displayDate || "";
            let fechaStr = rawDate;
            if (rawDate.includes('-')) {
                const parts = rawDate.split('-');
                if (parts.length === 3) fechaStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }

            // Lógica de Score y Colores
            let scoreHTML = '';
            if (m.type === 'played') {
                const gf = m.gf ?? m.GF ?? 0;
                const gc = m.gc ?? m.GC ?? 0;
                
                let resultColor = '#f1c40f'; // Empate (Amarillo)
                if (gf > gc) resultColor = '#2ecc71'; // Ganado (Verde)
                if (gf < gc) resultColor = '#ff4757'; // Perdido (Rojo)

                scoreHTML = `<span style="font-weight:900; color:${resultColor}; font-family:var(--font-display); font-size:1.1rem; text-shadow: 0 0 10px ${resultColor}44;">${gf} - ${gc}</span>`;
            } else {
                scoreHTML = `<span style="font-size:0.6rem; color:var(--text-muted); font-weight:800; letter-spacing:1.2px; opacity:0.7;">PRÓXIMO</span>`;
            }
            
            html += `
                <div class="glass-panel" style="padding:1rem 1.25rem; display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--border-light); border-radius:12px;">
                    <div style="font-size:0.75rem; font-weight:bold; color:var(--text-muted); flex:0.8;">${fechaStr}</div>
                    <div style="display:flex; align-items:center; gap:0.75rem; flex:2; justify-content:center;">
                        ${shield ? `<img src="${shield}" style="width:22px; height:22px; object-fit:contain;">` : '<i class="ph-bold ph-shield" style="font-size:22px; opacity:0.1;"></i>'}
                        <span style="font-size:0.85rem; text-transform:uppercase; font-weight:700; font-family:var(--font-display); letter-spacing:0.5px;">${rival}</span>
                    </div>
                    <div style="flex:0.8; text-align:right;">${scoreHTML}</div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeFixtureModal(e) {
    // If called with an event (click on overlay), only close if clicking the overlay itself
    if (e && e.target && e.target.id !== 'fixtureModal') return;
    const modal = document.getElementById('fixtureModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function openCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function renderLastMatches() {
    const container = document.getElementById('homeLatestMatches');
    if (!container || !window.allMatches || window.allMatches.length === 0) return;

    const played = window.allMatches.filter(m => m.VS && (m.RESULTADO || (m.GF !== '' && m.GC !== '')));
    const lastMatch = played.length > 0 ? played[0] : null;

    if (lastMatch) {
        container.innerHTML = generateMatchCard(lastMatch, 'ÚLTIMO PARTIDO');
    }
}

function renderNextMatch() {
    const container = document.getElementById('nextMatchCard');
    if (!container) return;

    const nextMatch = window.allUpcoming && window.allUpcoming.length > 0 ? window.allUpcoming[0] : null;
    if (nextMatch) {
         container.innerHTML = generateMatchCard(nextMatch, 'PRÓXIMO PARTIDO');
    } else {
        container.innerHTML = '<div class="glass-panel" style="padding:2rem; color:var(--text-muted); text-align:center;">Próximo partido a confirmar</div>';
    }
}

function generateMatchCard(m, title = "") {
    const isUpcoming = title.includes('PRÓXIMO');
    const gf = m.gf ?? m.GF ?? (isUpcoming ? '' : '?');
    const gc = m.gc ?? m.GC ?? (isUpcoming ? '' : '?');
    
    // Evitar duplicados (Ej: "Apertura - Fecha 2 - Fecha 2")
    const rawTorneo = m.torneo || m.TORNEO || '';
    const rawInstancia = m.instancia || m.INSTANCIA || '';
    let torneoFull = rawTorneo;
    if (rawInstancia && !rawTorneo.toUpperCase().includes(rawInstancia.toUpperCase())) {
        torneoFull += ` - ${rawInstancia}`;
    }
    if (!torneoFull) torneoFull = isUpcoming ? "Campaña 2026" : "Campaña Histórica";
    torneoFull = torneoFull.toUpperCase();

    // Formatear Fecha (AAAA-MM-DD -> DD/MM/AAAA)
    const rawFecha = m.fecha || m.FECHA || 'TBD';
    let fechaFinal = rawFecha;
    if (rawFecha.includes('-')) {
        const parts = rawFecha.split('-');
        if (parts.length === 3) fechaFinal = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const rivalShield = getRivalShield(m.rival || m.VS);
    
    return `
        <div class="glass-panel" style="padding: 2.5rem; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: var(--accent-primary); opacity: 0.8;"></div>
            
            <div style="text-align: center; margin-bottom: 0.5rem;">
                <div style="font-size: 0.7rem; letter-spacing: 3px; color: var(--text-muted); font-weight: 800; margin-bottom: 0.8rem; opacity: 0.6;">${title.toUpperCase()}</div>
                <div class="torneo-tag" style="font-size: 0.75rem; letter-spacing: 2px; color: var(--accent-primary); font-weight: 800;">${torneoFull}</div>
            </div>
            
            <div class="teams-display" style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 2rem; width: 100%;">
                <div class="team" style="text-align: right;">
                    <img src="img/logo/ESCUDO_BUFARRA.png" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 1rem; filter: drop-shadow(0 0 15px rgba(255,255,255,0.1));">
                    <div class="team-name" style="font-size: 1rem; letter-spacing: 1px; font-weight: 700;">LA BUFARRA</div>
                </div>
                
                <div class="vs-badge" style="padding: 1rem; font-size: 3rem; color: #fff; font-family: var(--font-display); font-weight: 900; letter-spacing: -2px; background: none; border: none;">
                    ${isUpcoming ? 'VS' : `${gf} - ${gc}`}
                </div>
                
                <div class="team" style="text-align: left;">
                    ${rivalShield ? `<img src="${rivalShield}" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 1rem; filter: drop-shadow(0 0 15px rgba(255,255,255,0.1));">` : '<i class="ph ph-shield" style="font-size: 80px; opacity: 0.1; margin-bottom: 1rem;"></i>'}
                    <div class="team-name" style="font-size: 1rem; letter-spacing: 1px; font-weight: 700;">${(m.rival || m.VS || 'POR DEFINIR').toUpperCase()}</div>
                </div>
            </div>
            
            <div class="match-details" style="display: flex; gap: 2.5rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2rem; width: 100%; justify-content: center;">
                <div class="detail-item" style="font-size: 0.85rem; font-weight: 600;"><i class="ph-bold ph-calendar" style="color: var(--accent-primary); font-size: 1.1rem; margin-right: 0.5rem;"></i> ${fechaFinal}</div>
                <div class="detail-item" style="font-size: 0.85rem; font-weight: 600;"><i class="ph-bold ph-clock" style="color: var(--accent-primary); font-size: 1.1rem; margin-right: 0.5rem;"></i> ${m.hora || m.HORA || 'TBD'} HS</div>
                <div class="detail-item" style="font-size: 0.85rem; font-weight: 600;"><i class="ph-bold ph-map-pin" style="color: var(--accent-primary); font-size: 1.1rem; margin-right: 0.5rem;"></i> ${m.lugar || m.LUGAR || 'TBD'}</div>
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

async function renderLeagueTable(expanded = false) {
    const container = document.getElementById('leagueTableContainer');
    if (!container) return;

    let teams = [];
    try {
        const res = await fetch('data/league_table.json?v=' + Date.now());
        if (res.ok) teams = await res.json();
    } catch(e) { console.warn("DB: Falló carga de tabla dinámica, usando fallback."); }

    if (!teams || teams.length === 0) {
        teams = [
            { pos: 1, name: "La Costa FC", pj: 2, pts: 6 },
            { pos: 2, name: "Berges FC (Dom)", pj: 2, pts: 6 },
            { pos: 3, name: "FC Fernetbache", pj: 2, pts: 6 },
            { pos: 4, name: "Porte FC (Domingo)", pj: 2, pts: 3 },
            { pos: 5, name: "Parque Guarani", pj: 1, pts: 3 },
            { pos: 6, name: "LA BUFARRA", pj: 2, pts: 3, highlighted: true },
            { pos: 7, name: "Safaera FC", pj: 2, pts: 3 },
            { pos: 8, name: "C. A. Magna", pj: 2, pts: 3 },
            { pos: 9, name: "Alta Gama F.C", pj: 1, pts: 0 },
            { pos: 10, name: "C. A. Parenaese", pj: 2, pts: 0 },
            { pos: 11, name: "Prestcold FC", pj: 2, pts: 0 },
            { pos: 12, name: "ENFUGEIRA FC", pj: 2, pts: 0 }
        ];
    }

    let displayTeams = expanded ? teams : teams.filter(t => t.highlighted || (t.name && t.name.toUpperCase().includes('BUFARRA')));
    
    // Si no hay resaltados, mostrar los primeros 5
    if (!expanded && displayTeams.length === 0) {
        displayTeams = teams.slice(0, 5);
    }

    let html = `
        <div class="glass-panel" id="tableWidget" style="cursor:pointer; padding: 2.5rem; transition: all 0.5s ease; border: ${expanded ? '2px solid var(--accent-primary)' : '1px solid var(--border-light)'}; box-shadow: ${expanded ? '0 0 50px var(--accent-glow)' : 'none'}; overflow: hidden;">
            <div style="text-align:center; margin-bottom: 2.5rem;">
                <div style="font-family:var(--font-display); font-size:0.8rem; color:var(--accent-primary); letter-spacing:4px; font-weight:800; text-transform:uppercase;">Campaña Apertura 2026</div>
                <h2 style="font-family:var(--font-display); font-size:2.2rem; font-weight:900; margin: 0.5rem 0;">TABLA DE POSICIONES</h2>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${displayTeams.map(t => {
                    const isBufarra = t.highlighted;
                    const shield = isBufarra ? 'img/logo/ESCUDO_BUFARRA.png' : getRivalShield(t.name);
                    
                    return `
                        <div style="display:grid; grid-template-columns: 40px 40px 1fr 60px 60px; align-items:center; transition: all 0.3s ease; padding: 1.2rem; background: ${isBufarra ? 'rgba(255,107,129,0.1)' : 'transparent'}; border-radius: 12px; border: ${isBufarra ? '1px solid var(--accent-primary)' : '1px solid transparent'};">
                            <div style="font-family:var(--font-display); font-size:1.2rem; font-weight:900; color:${isBufarra ? 'var(--accent-primary)' : '#fff'};">${t.pos}º</div>
                            <div style="display:flex; align-items:center; justify-content:center;">
                                ${shield ? `<img src="${shield}" style="width:24px; height:24px; object-fit:contain;">` : '<i class="ph ph-shield" style="font-size:24px; opacity:0.1;"></i>'}
                            </div>
                            <div style="font-family:var(--font-display); font-size: 1rem; font-weight:800; color:#fff; text-transform:uppercase;">${t.name}</div>
                            <div style="text-align:center; font-weight:700; color:var(--text-muted); font-size:0.9rem;">${t.pj} <small style="display:block; font-size:0.5rem; opacity:0.5;">PJ</small></div>
                            <div style="text-align:center; font-weight:900; color:var(--accent-primary); font-size:1.1rem;">${t.pts} <small style="display:block; font-size:0.5rem; opacity:0.5; color:var(--text-muted);">PTS</small></div>
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
            if (expanded) {
                document.getElementById('campana')?.scrollIntoView({ behavior: 'smooth' });
            }
        };
    }
}

function filterPlantel(type, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderPlantel2026(type);
}
window.filterPlantel = filterPlantel;

function handleSearchInput(input, btnId) {
    const btn = document.getElementById(btnId);
    if (btn) btn.style.display = input.value.length > 0 ? 'block' : 'none';
    if (input.id === 'globalSearchInput') handleGlobalSearch(input.value);
}

function clearSearch(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (input) {
        input.value = '';
        input.focus();
        if (input.id === 'globalSearchInput') handleGlobalSearch('');
    }
    if (btn) btn.style.display = 'none';
}

window.handleSearchInput = handleSearchInput;
window.clearSearch = clearSearch;

function renderPlantel2026(filter = 'general') {
    const grid = document.getElementById('playersGrid');
    if (!grid || !window.allPlayers) return;

    // Reset scroll to top on first render if needed
    if (!window.hasScrolledToTop) {
        window.scrollTo(0, 0);
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.hasScrolledToTop = true;
    }

    let players2026 = window.allPlayers['2026'] || [];
    let explicitStaff = [];
    const rawData = window.rawPlayersData ? window.rawPlayersData['2026'] : null;
    
    // MAPPING DE DORSALES OFICIALES
    const JUGADOR_DORSAL = {
        "ANZUATTE": "#4",
        "BLANCO": "#5",
        "BONILLA": "#21",
        "COLOMBO": "#8",
        "DE LEON": "#71",
        "FLORES": "#3",
        "IZA": "#19",
        "MARI": "#11",
        "MARTINEZ": "#1",
        "MENCHACA": "#23",
        "MOLINA": "#15",
        "OLARTE": "#2",
        "PEDEMONTE": "#10",
        "SPARKOV": "#9"
    };

    const staffNamesToForce = ["Santiago Mateo", "Emiliano Reyes", "Mateo", "Reyes"];

    if (rawData) {
        Object.keys(rawData).forEach(tk => {
            const tData = rawData[tk];
            if (tData && tData.dt) {
                tData.dt.split(/[/,]/).forEach(name => {
                    const n = name.trim();
                    if (n && !explicitStaff.some(s => s.PLAYER.toUpperCase() === n.toUpperCase())) {
                        explicitStaff.push({ PLAYER: n, PJ: '0', GOLES: '0', ASISTENCIAS: '0', AMARILLAS: '0', ROJAS: '0', isStaff: true });
                    }
                });
            }
        });
    }

    if (!players2026.some(p => p.PLAYER.toUpperCase().includes('PEDEMONTE'))) {
        players2026.push({ PLAYER: 'Pedemonte', PJ: '0', GOLES: '0', ASISTENCIAS: '0', AMARILLAS: '0', ROJAS: '0' });
    }

    const statKeywords = ["DT", "Cuerpo", "Director", "Delegado", ...staffNamesToForce];
    const statMap = { 'goles': 'GOLES', 'asistencias': 'ASISTENCIAS', 'tarjetas': 'tarjetas' };

    let players = players2026.filter(p => !p.isStaff && !statKeywords.some(kw => (p.PLAYER || '').toUpperCase().includes(kw.toUpperCase())));
    let staff = [...explicitStaff, ...players2026.filter(p => p.isStaff || statKeywords.some(kw => (p.PLAYER || '').toUpperCase().includes(kw.toUpperCase())))];
    
    const seenStaff = new Set();
    staff = staff.filter(s => {
        const name = (s.PLAYER || '').toUpperCase().trim();
        if (seenStaff.has(name)) return false;
        seenStaff.add(name);
        return true;
    });

    if (filter !== 'general') {
        // Solo mostrar si tienen al menos 1 en la estadística seleccionada
        players = players.filter(p => {
            if (filter === 'tarjetas') {
                return (parseInt(p.AMARILLAS || 0) + parseInt(p.ROJAS || 0)) > 0;
            }
            return parseInt(p[statMap[filter]] || 0) > 0;
        });

        players.sort((a,b) => (filter==='tarjetas'? (parseInt(b.AMARILLAS||0)+parseInt(b.ROJAS||0))-(parseInt(a.AMARILLAS||0)+parseInt(a.ROJAS||0)) : parseInt(b[statMap[filter]]||0)-parseInt(a[statMap[filter]]||0)));
        staff = [];
    } else {
        // En vista general, si el staff manual está vacío, forzamos a los técnicos mencionados
        if (staff.length === 0) {
            staff.push({ PLAYER: 'Santiago Mateo', PJ: '0', GOLES: '0', ASISTENCIAS: '0', AMARILLAS: '0', ROJAS: '0', isStaff: true });
            staff.push({ PLAYER: 'Emiliano Reyes', PJ: '0', GOLES: '0', ASISTENCIAS: '0', AMARILLAS: '0', ROJAS: '0', isStaff: true });
        }
        players.sort((a,b) => (a.PLAYER||'').localeCompare(b.PLAYER||''));
    }

    const drawCard = (p) => {
        const nameText = (p.PLAYER || "").toUpperCase().trim();
        const isStaffItem = p.isStaff || statKeywords.some(kw => nameText.includes(kw.toUpperCase()));
        const img = getPlayerImage(p.PLAYER);
        
        // Determinar Dorsal o Etiqueta
        let subtitle = JUGADOR_DORSAL[nameText] || "N/A";
        if (isStaffItem) subtitle = "CUERPO TÉCNICO";
        
        let statDisplay = '';
        // Solo mostrar estadísticas si NO es staff
        if (!isStaffItem) {
            if (filter === 'general') {
                statDisplay = `
                    <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap: 5px; width: 100%; border-top:1px solid rgba(255,255,255,0.05); padding-top: 1rem; margin-top: 1rem;">
                        <div style="text-align:center;"><small style="display:block; font-size:0.55rem; color:var(--text-muted);">PJ</small><span style="font-weight:700;">${p.PJ || 0}</span></div>
                        <div style="text-align:center;"><small style="display:block; font-size:0.55rem; color:var(--text-muted);">G</small><span style="font-weight:700; color:var(--accent-primary);">${p.GOLES || 0}</span></div>
                        <div style="text-align:center;"><small style="display:block; font-size:0.55rem; color:var(--text-muted);">A</small><span style="font-weight:700;">${p.ASISTENCIAS || 0}</span></div>
                        <div style="text-align:center;"><small style="display:block; font-size:0.55rem; color:var(--text-muted);">AM</small><span style="font-weight:700; color:#ffd700;">${p.AMARILLAS || 0}</span></div>
                        <div style="text-align:center;"><small style="display:block; font-size:0.55rem; color:var(--text-muted);">RO</small><span style="font-weight:700; color:#ff4d4d;">${p.ROJAS || 0}</span></div>
                    </div>
                `;
            } else {
                const val = filter === 'tarjetas' ? (parseInt(p.AMARILLAS||0)+parseInt(p.ROJAS||0)) : p[statMap[filter]]||0;
                const label = filter === 'tarjetas' ? 'TARJ' : filter.toUpperCase();
                statDisplay = `<div style="font-family:var(--font-display); font-size: 1.5rem; font-weight:900; color:var(--accent-primary); margin-top:1rem;">${val} <small style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">${label}</small></div>`;
            }
        }

        return `
            <div class="glass-panel" style="display:flex; flex-direction:column; align-items:center; padding: 2.2rem 1.5rem; border-radius: 20px; transition: all 0.3s ease;">
                <div style="width: 110px; height: 110px; border-radius: 50%; overflow: hidden; margin-bottom: 1.2rem; border: 2px solid var(--accent-primary); box-shadow: 0 0 20px rgba(255,107,129,0.2);">
                    <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="font-family:var(--font-display); font-weight: 800; font-size: 1rem; text-transform: uppercase; color: #fff; text-align:center;">${p.PLAYER}</div>
                <div style="font-size:0.75rem; color:var(--accent-primary); text-transform:uppercase; font-weight:900; margin-top:0.4rem; letter-spacing:2px;">${subtitle}</div>
                ${statDisplay}
            </div>
        `;
    };
    let html = players.map(drawCard).join('') + staff.map(drawCard).join('');
    
    // Links de navegación rápida
    const links = {
        'general': { text: 'Ver todos los planteles', url: 'jugadores.html' },
        'goles': { text: 'Ver goleadores históricos', url: 'jugadores.html?filter=goles' },
        'asistencias': { text: 'Ver asistidores históricos', url: 'jugadores.html?filter=asistencias' },
        'tarjetas': { text: 'Ver disciplina histórica', url: 'jugadores.html?filter=tarjetas' }
    };
    html += `
        <a href="${links[filter].url}" class="glass-panel" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:2rem; text-decoration:none; border:1px dashed var(--accent-primary); border-radius: 20px;">
            <i class="ph-bold ph-arrow-right" style="font-size:2.5rem; color:var(--accent-primary); margin-bottom:1rem;"></i>
            <span style="color:#fff; font-weight:800; text-transform:uppercase; font-size:0.9rem; text-align:center;">${links[filter].text}</span>
        </a>
    `;
    grid.innerHTML = html;
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

function openRivalModal(rivalName) {
    const modal = document.getElementById('rivalModal');
    const header = document.getElementById('rivalHeader');
    const container = document.getElementById('rivalMatchesContainer');
    if (!modal || !header || !container) return;

    const matches = window.allMatches.filter(m => 
        (m.rival || m.VS || "").toUpperCase() === rivalName.toUpperCase()
    ).sort((a,b) => parseDateForSort(b.FECHA || b.fecha) - parseDateForSort(a.FECHA || a.fecha));

    const shield = getRivalShield(rivalName);
    
    header.innerHTML = `
        <div style="margin-bottom: 1rem;">
            ${shield ? `<img src="${shield}" style="width: 80px; height: 80px; object-fit: contain; filter: drop-shadow(0 0 20px rgba(255,255,255,0.1));">` : '<i class="ph ph-shield" style="font-size: 80px; opacity: 0.1;"></i>'}
        </div>
        <h2 class="section-title" style="margin:0;"><span>Historial vs</span>${rivalName.toUpperCase()}</h2>
        <div style="margin-top: 1rem; display: flex; justify-content: center; gap: 1.5rem;">
            <div style="text-align:center;"><div style="font-size:1.5rem; font-weight:900; color:#fff;">${matches.length}</div><div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">PJ</div></div>
            <div style="text-align:center;"><div style="font-size:1.5rem; font-weight:900; color:#2ecc71;">${matches.filter(m => (m.gf||m.GF) > (m.gc||m.GC)).length}</div><div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">PG</div></div>
            <div style="text-align:center;"><div style="font-size:1.5rem; font-weight:900; color:#f1c40f;">${matches.filter(m => (m.gf||m.GF) === (m.gc||m.GC)).length}</div><div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">PE</div></div>
            <div style="text-align:center;"><div style="font-size:1.5rem; font-weight:900; color:#ff4757;">${matches.filter(m => (m.gf||m.GF) < (m.gc||m.GC)).length}</div><div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">PP</div></div>
        </div>
    `;

    if (matches.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted);">No hay partidos registrados contra este rival aún.</div>';
    } else {
        container.innerHTML = matches.map(m => {
            const gf = m.gf || m.GF || 0;
            const gc = m.gc || m.GC || 0;
            const resColor = gf > gc ? '#2ecc71' : (gf === gc ? '#f1c40f' : '#ff4757');
            const fechaLabel = m.FECHA || m.fecha || 'TBD';
            const torneoStr = (m.torneo || "").toUpperCase();
            
            return `
                <div class="glass-panel" style="padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-light); border-radius: 12px;">
                    <div style="flex: 1.2;">
                        <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 0.2rem;">${fechaLabel}</div>
                        <div style="font-size: 0.65rem; color: var(--accent-primary); font-weight: 700; letter-spacing: 0.5px;">${torneoStr}</div>
                    </div>
                    <div style="flex: 1; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 1rem;">
                        <div style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 900; color: ${resColor}; text-shadow: 0 0 10px ${resColor}33;">${gf} - ${gc}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeRivalModal(e) {
    if (e && e.target && e.target.id !== 'rivalModal' && !e.target.closest('.modal-close-btn')) return;
    document.getElementById('rivalModal').style.display = 'none';
    document.body.style.overflow = '';
}

function getRivalFormHTML(rivalName) {
    const matches = window.allMatches.filter(m => 
        (m.rival || m.VS || "").toUpperCase() === rivalName.toUpperCase()
    ).slice(0, 5);
    if (matches.length === 0) return '';
    return '<div style="display:flex; gap:4px; margin-top:2px;">' + matches.map(m => {
        const gf = m.gf || m.GF || 0;
        const gc = m.gc || m.GC || 0;
        if (gf > gc) return '<span style="color:#2ecc71; font-weight:900; font-size:0.75rem;">G</span>';
        if (gf === gc) return '<span style="color:#f1c40f; font-weight:900; font-size:0.75rem;">E</span>';
        return '<span style="color:#ff4757; font-weight:900; font-size:0.75rem;">P</span>';
    }).join('') + '</div>';
}

function handleGlobalSearch(query) {
    const dropdown = document.getElementById('searchResultsDropdown');
    if (!dropdown) return;
    if (!query || query.trim().length < 2) {
        dropdown.style.display = 'none';
        return;
    }
    const q = query.toLowerCase().trim();
    const results = [];

    // Search Players
    Object.keys(PLAYER_MAP).forEach(p => {
        if (p.toLowerCase().includes(q)) {
            results.push({ type: 'player', label: p, sub: 'Jugador Oficial', icon: 'ph-user-focus' });
        }
    });

    // Search Rivals
    window.allMatches.forEach(m => {
        const rival = (m.VS || m.rival || '').trim();
        if (rival.toLowerCase().includes(q)) {
            results.push({ type: 'rival', label: rival, sub: 'Rival Histórico', icon: 'ph-shield', extra: getRivalFormHTML(rival) });
        }
    });

    const seen = new Set();
    const finalResults = results.filter(r => {
        const key = `${r.type}-${r.label.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 10);

    if (finalResults.length > 0) {
        dropdown.innerHTML = finalResults.map(r => `
            <div onclick="handleSearchClick('${r.type}', '${r.label}')" class="search-item-suggestion" style="display:flex; align-items:center; gap:1rem; padding:0.85rem 1.25rem; cursor:pointer; border-radius:12px; transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <i class="ph-bold ${r.icon}" style="color:var(--accent-primary); font-size:1.3rem;"></i>
                <div style="flex:1;">
                    <div style="font-weight:800; color:#fff; font-size:0.9rem; text-transform:uppercase; letter-spacing:0.5px;">${r.label}</div>
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                        <div style="font-size:0.7rem; color:var(--text-muted); opacity:0.8;">${r.sub}</div>
                        ${r.extra || ''}
                    </div>
                </div>
            </div>
        `).join('');
        dropdown.style.display = 'block';
    } else {
        dropdown.innerHTML = '<div style="padding:1.5rem; color:var(--text-muted); text-align:center; font-size:0.8rem; font-weight:700; letter-spacing:1px;">SIN RESULTADOS</div>';
        dropdown.style.display = 'block';
    }
}

function handleSearchClick(type, label) {
    if (type === 'player') window.location.href = `jugadores.html?search=${encodeURIComponent(label)}`;
    else if (type === 'rival') openRivalModal(label);
    else if (type === 'tournament') window.location.href = `campeonatos.html?tournament=${encodeURIComponent(label)}`;
    else if (type === 'date') window.location.href = `partidos.html?date=${encodeURIComponent(label)}`;
}

window.handleGlobalSearch = handleGlobalSearch;
window.handleSearchClick = handleSearchClick;
window.openRivalModal = openRivalModal;
window.closeRivalModal = closeRivalModal;

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

// Configuración global de OneSignal
window.OneSignal = window.OneSignal || [];
OneSignal.push(function() {
    OneSignal.init({
        appId: "5216c0c7-ff86-439c-b82c-dc884915ce0c",
        notifyButton: { enable: false }
    });
});

// Lógica de invitación a notificaciones y PWA
function initSmartPrompts() {
    const status = localStorage.getItem('bufarra_notifications');
    const closedDate = localStorage.getItem('bufarra_prompt_closed');
    const today = new Date().toDateString();

    if (status === 'true' || closedDate === today) return;

    // Si ya estamos suscritos en OneSignal, no preguntar
    OneSignal.push(function() {
        OneSignal.isPushNotificationsEnabled(function(isEnabled) {
            if (isEnabled) {
                localStorage.setItem('bufarra_notifications', 'true');
                return;
            }
            showTheBanner(today);
        });
    });
}

function showTheBanner(today) {
    const banner = document.createElement('div');
    banner.className = 'noti-prompt-banner';
    banner.innerHTML = `
        <div class="noti-prompt-header">
            <img src="img/logo/ESCUDO_BUFARRA.png" style="width: 50px; height: 50px; object-fit: contain;">
            <div class="noti-prompt-text">
                <b>¡Sumate a La Bufarra!</b>
                <p>Activá las notificaciones para recibir alertas de partidos, cambios de horario y resultados al instante.</p>
            </div>
        </div>
        <div class="noti-prompt-btns">
            <button class="noti-btn noti-btn-yes" id="btnNotiYes">ACTIVAR ALERTAS</button>
            <button class="noti-btn noti-btn-no" id="btnNotiNo">LUEGO</button>
        </div>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.classList.add('show'), 2000);

    document.getElementById('btnNotiYes').onclick = () => {
        OneSignal.push(function() {
            OneSignal.registerForPushNotifications();
            localStorage.setItem('bufarra_notifications', 'true');
            banner.classList.remove('show');
        });
    };

    document.getElementById('btnNotiNo').onclick = () => {
        localStorage.setItem('bufarra_prompt_closed', today);
        banner.classList.remove('show');
    };
}

// Registro de Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW reg error:', err));
    });
}

// Lanzar prompts inteligentes al cargar
window.addEventListener('dataLoaded', initSmartPrompts);

