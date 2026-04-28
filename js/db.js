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
    
    const loadLocal = async () => {
        try {
            // PRIORIDAD 1: Datos inyectados desde el Excel directamente
            if (window.PLAYERS_EXCEL_DATA) {
                window.allPlayers = mapPlayers(window.PLAYERS_EXCEL_DATA);
            } else {
                const pRes = await fetch('data/players.json' + cacheBuster).catch(() => null);
                if (pRes && pRes.ok) window.allPlayers = mapPlayers(await pRes.json());
            }

            const mRes = await fetch('data/matches.json' + cacheBuster).catch(() => null);
            if (mRes && mRes.ok) {
                window.allMatches = mapMatches(await mRes.json());
            }
        } catch (e) {
            console.error("Local Load Error:", e);
        }
    };

    const loadSupabase = async () => {
        try {
            let sbMatches = [];
            const mRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=*&order=fecha.desc`, { headers: SP_HEADERS }).catch(() => null);
            if (mRes && mRes.ok) sbMatches = mapMatches(await mRes.json());
            
            // Fusión de partidos: AHORA SUPABASE ES EL MAESTRO ÚNICO
            if (sbMatches.length > 0) {
                const local = window.allMatches || [];
                const mergedMap = new Map();
                
                // Función para generar una clave única de partido (Normalizada y Agresiva)
                const getMatchKey = (m) => {
                    const rRaw = (m.VS || m.rival || m.RIVAL || '').toString().trim().toUpperCase();
                    const rClean = rRaw.replace(/\b(FC|F\.C|CA|C\.A|DEPORTIVA|CLUB|ATLETICO|ASOCIACION|JRS|JUNIORS)\b/gi, '')
                                       .replace(/\(.*\)/g, '')
                                       .replace(/[^A-Z0-9]/g, '')
                                       .trim();
                    const fRaw = (m.FECHA || m.fecha || '').trim();
                    const a = (m.AÑO || m.año || '').toString().trim();
                    let fNorm = fRaw;
                    if (fRaw.includes('/')) {
                        const p = fRaw.split('/');
                        if (p.length === 3) fNorm = `${parseInt(p[0])}/${parseInt(p[1])}/${p[2]}`;
                    } else if (fRaw.includes('-')) {
                        const p = fRaw.split('-');
                        if (p.length === 3) fNorm = `${parseInt(p[2])}/${parseInt(p[1])}/${p[0]}`;
                    }
                    return `${a}-${fNorm}-${rClean}`;
                };

                // 1. Cargamos lo Local (JSON de backup)
                local.forEach(m => mergedMap.set(getMatchKey(m), m));
                
                // 2. SUPABASE TIENE PRIORIDAD (Pisa lo local). 
                // Como acabamos de migrar el Excel a Supabase, la nube tiene la verdad.
                sbMatches.forEach(m => mergedMap.set(getMatchKey(m), m));
                
                window.allMatches = Array.from(mergedMap.values());
            }
            
            const uRes = await fetch(`${SUPABASE_URL}/rest/v1/upcoming?select=*&order=fecha.asc`, { headers: SP_HEADERS }).catch(() => null);
            if (uRes && uRes.ok) window.allUpcoming = await uRes.json();
            return true;
        } catch (e) {
            console.error("Supabase Load Error:", e);
            return false;
        }
    };

    try {
        // 1. Cargar base local de todo el histórico (Failsafe)
        await loadLocal();
        
        // 2. PRIORIDAD ESPECIAL: Si tenemos datos inyectados del Excel, usarlos como base maestra
        if (window.PLAYERS_EXCEL_DATA) {
            console.log("DB: Usando datos maestros del Excel (Respaldo JS)");
            window.allPlayers = mapPlayers(window.PLAYERS_EXCEL_DATA);
        }

        // 3. Cargar Supabase (PARTIDOS)
        const sbMatchesSuccess = await loadSupabase();

        // 4. Cargar Supabase (JUGADORES/ESTADISTICAS) para actualizaciones en tiempo real
        const sbPlayersSuccess = await loadPlayersSupabase();

        // 4. CALCULO DINÁMICO DE ESTADÍSTICAS 2026 (Para que el plantel se vea siempre en vivo)
        const matches2026 = (window.allMatches || []).filter(m => {
            const yr = String(m.AÑO || m.año || '');
            const fe = String(m.FECHA || m.fecha || '');
            return yr.includes('2026') || fe.includes('2026');
        });
        
        if (matches2026.length > 0) {
            const liveStats = calculateLiveStats(matches2026);
            const baseStats = window.allPlayers['2026'] || [];
            
            // Fusionar: Usar LiveStats si existe el jugador, sino BaseStats
            const merged = [...baseStats];
            Object.values(liveStats).forEach(lp => {
                const idx = merged.findIndex(bp => bp.PLAYER.toUpperCase() === lp.PLAYER.toUpperCase());
                if (idx >= 0) {
                    merged[idx] = lp; // Reemplazar con datos frescos
                } else {
                    merged.push(lp); // Agregar nuevo
                }
            });
            window.allPlayers['2026'] = merged;
        }

        const success = sbMatchesSuccess && sbPlayersSuccess;
        finishLoad(success ? "Híbrido (Local + Supabase)" : "Local JSON Fallback");
    } catch (e) {
        console.error("DB: Error fatal en loadMatches:", e);
        finishLoad("Error Fallback");
    }
}

async function loadPlayersSupabase() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/players_stats?select=*`, { headers: SP_HEADERS }).catch(() => null);
        if (!res || !res.ok) return false;
        
        const data = await res.json();
        if (!data || data.length === 0) return false;

        // Agrupar por año (como espera el resto de la web)
        const cloudPlayers = {};
        data.forEach(p => {
            const yr = p.year || 'ALL';
            if (!cloudPlayers[yr]) cloudPlayers[yr] = [];
            
            cloudPlayers[yr].push({
                PLAYER: p.player_name,
                PJ: parseInt(p.pj || 0),
                PG: parseInt(p.pg || 0),
                PE: parseInt(p.pe || 0),
                PP: parseInt(p.pp || 0),
                GOLES: parseInt(p.goles || 0),
                ASISTENCIAS: parseInt(p.asistencias || 0),
                AMARILLAS: parseInt(p.amarillas || 0),
                ROJAS: parseInt(p.rojas || 0),
                MVP: parseInt(p.mvp || 0)
            });
        });

        // Fusionar con window.allPlayers (Dándole prioridad a la Nube si tiene datos)
        for (const [yr, players] of Object.entries(cloudPlayers)) {
            if (players.length === 0) continue; // Ignorar años vacíos en la nube
            
            if (!window.allPlayers[yr]) {
                window.allPlayers[yr] = players;
            } else {
                // Merge inteligente por nombre: La nube manda si existe el jugador
                players.forEach(cp => {
                    const idx = window.allPlayers[yr].findIndex(lp => lp.PLAYER.toUpperCase() === cp.PLAYER.toUpperCase());
                    if (idx >= 0) window.allPlayers[yr][idx] = cp;
                    else window.allPlayers[yr].push(cp);
                });
            }
        }
        return true;
    } catch(e) {
        console.warn("DB: Falló carga de jugadores de Supabase:", e);
        return false;
    }
}

function calculateLiveStats(matches) {
    const stats = {};
    matches.forEach(m => {
        const gf = parseInt(m.GF || 0);
        const gc = parseInt(m.GC || 0);
        const res = gf > gc ? 'V' : (gf < gc ? 'D' : 'E');
        
        if (m.jugadores) {
            Object.entries(m.jugadores).forEach(([name, data]) => {
                if (name.startsWith('__')) return;
                
                let n = name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const upperName = n.toUpperCase();
                
                // Buscar el nombre oficial (apellido) en el PLAYER_MAP
                let officialName = n;
                for (const [surname, info] of Object.entries(window.PLAYER_MAP)) {
                    const upperSurname = surname.toUpperCase();
                    const upperFullName = (info.fullName || "").toUpperCase();
                    const aliases = (info.aliases || []).map(a => a.toUpperCase());
                    
                    if (upperName === upperSurname || upperName === upperFullName || aliases.includes(upperName)) {
                        officialName = surname;
                        break;
                    }
                }
                n = officialName;

                if (!stats[n]) {
                    stats[n] = { PLAYER: n, PJ: 0, PG: 0, PE: 0, PP: 0, GOLES: 0, ASISTENCIAS: 0, AMARILLAS: 0, ROJAS: 0, MVP: 0 };
                }
                
                const s = stats[n];
                s.PJ++;
                if (res === 'V') s.PG++;
                else if (res === 'E') s.PE++;
                else s.PP++;
                
                s.GOLES += parseInt(data.goles || 0);
                s.ASISTENCIAS += parseInt(data.asistencias || 0);
                s.AMARILLAS += parseInt(data.amarillas || 0);
                s.ROJAS += parseInt(data.rojas || 0);
                if (data.mvp) s.MVP++;
            });
        }
    });
    return Object.values(stats);
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
        
        // PRIORIDAD: Resultado manual guardado en el JSON de jugadores (para penales/correciones)
        const manualRes = m.jugadores ? (m.jugadores.__resultado_manual || m.jugadores.__resultado) : null;
        const res = manualRes || m.resultado || m.RESULTADO || (gf !== '' && gc !== '' ? (parseInt(gf) > parseInt(gc) ? 'V' : parseInt(gf) < parseInt(gc) ? 'D' : 'E') : '');

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
        let name = p.PLAYER || p.nombre || p.player_name || '';
        name = name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Unificación de nombres usando el PLAYER_MAP si existe
        let officialName = name;
        const upperName = name.toUpperCase();
        for (const [surname, info] of Object.entries(window.PLAYER_MAP || {})) {
            if (upperName === surname.toUpperCase() || upperName === (info.fullName || "").toUpperCase()) {
                officialName = surname;
                break;
            }
        }

        return {
            PLAYER: officialName,
            YEAR: p.YEAR || p.year || p.año || '',
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
    };

    // SI VIENE EL EXCEL DIRECTAMENTE (OBJETO CON ALL)
    if (data.ALL && !Array.isArray(data)) {
        for (const [key, content] of Object.entries(data)) {
            if (Array.isArray(content)) {
                mapped[key] = content.map(p => {
                    const n = normalize(p);
                    if (!n.YEAR) n.YEAR = key;
                    return n;
                });
            } else if (typeof content === 'object') {
                let yearPlayers = [];
                for (const tData of Object.values(content)) {
                    const nodes = tData.jugadores || tData;
                    if (Array.isArray(nodes)) nodes.forEach(p => {
                        const n = normalize(p);
                        if (!n.YEAR) n.YEAR = key;
                        yearPlayers.push(n);
                    });
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

    // Sort matches by date (descending) and instance priority
    window.allMatches.sort((a,b) => parseDateForSort(b.FECHA, b) - parseDateForSort(a.FECHA, a));

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

    if (typeof initScrollObserver === 'function') initScrollObserver();
    
    // Disparar evento para otros componentes
    const event = new CustomEvent('dataLoaded', { detail: { source } });
    window.dispatchEvent(event);
    document.dispatchEvent(event);
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

function parseDateForSort(dateStr, matchObj = null) {
    if(!dateStr || typeof dateStr !== 'string') return 0;
    const parts = dateStr.trim().split('/');
    if(parts.length < 2) return 0;
    
    let d = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    let yStr = parts[2] ? parts[2].trim() : "2026";
    if (yStr.length === 2) yStr = '20' + yStr;
    const y = parseInt(yStr, 10);
    
    let time = new Date(y, m - 1, d).getTime() || 0;

    // Si tenemos el objeto del partido, añadimos un pequeño offset según la instancia
    // para que Final > Semi > Cuartos > Fecha en orden descendente.
    if (matchObj) {
        const inst = String(matchObj.instancia || matchObj.INSTANCIA || '').toUpperCase();
        if (inst.includes('FINAL') && !inst.includes('SEMI')) time += 1000;
        else if (inst.includes('SEMI')) time += 500;
        else if (inst.includes('CUARTOS')) time += 250;
        else if (inst.includes('FECHA')) {
            const num = parseInt(inst.replace(/[^0-9]/g, '')) || 0;
            time += num;
        }
    }

    return time;
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
        'C. A. MAGNA': 'img/escudos/magna.png',
        'C.A. MAGNA': 'img/escudos/magna.png',
        'MAGNA': 'img/escudos/magna.png'
    };

    if (SPECIAL_SHIELDS[n]) return SPECIAL_SHIELDS[n];
    
    // De-duplicar prefijos comunes que ya fueron quitados o que sobran
    let finalClean = fileName.replace(/\s+/g, '-').replace(/^c-a-/, '').replace(/^ca-/, '');
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
        const gf = match.GF ?? match.gf ?? '';
        const gc = match.GC ?? match.gc ?? '';
        let resStr = match.RESULTADO || '';
        if (gf !== '' && gc !== '') {
            resStr = `${gf} - ${gc}`;
            const extra = String(match.RESULTADO).match(/\((.*)\)/);
            if (extra) resStr += ` (${extra[1]})`;
        }
        textEl.innerHTML = `Un ${match.FECHA}, La Bufarra jugó contra ${match.VS}. Resultado: <strong>${resStr}</strong>.`;
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
    
    let matchTime = m.hora || m.HORA || '';
    if (!matchTime && m.jugadores && m.jugadores.__hora) matchTime = m.jugadores.__hora;
    let matchTimeFormatted = (!matchTime || matchTime === 'TBD') ? (isUpcoming ? 'SIN CONFIRMAR' : 'S/H') : matchTime + ' HS';
    
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
                    ${isUpcoming ? 'VS' : (function(){
                        let score = `${gf} - ${gc}`;
                        const extra = String(m.RESULTADO || '').match(/\((.*)\)/);
                        if (extra) return `<div style="display:flex; flex-direction:column; align-items:center;"><span style="line-height:1;">${score}</span><span style="font-size:1rem; letter-spacing:0; margin-top:0.5rem; opacity:0.8;">(${extra[1]})</span></div>`;
                        return score;
                    })()}
                </div>
                
                <div class="team" style="text-align: left;">
                    ${rivalShield ? `<img src="${rivalShield}" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 1rem; filter: drop-shadow(0 0 15px rgba(255,255,255,0.1));">` : '<i class="ph ph-shield" style="font-size: 80px; opacity: 0.1; margin-bottom: 1rem;"></i>'}
                    <div class="team-name" style="font-size: 1rem; letter-spacing: 1px; font-weight: 700;">${(m.rival || m.VS || 'POR DEFINIR').toUpperCase()}</div>
                </div>
            </div>
            
            <div class="match-details" style="display: flex; flex-direction:row; flex-wrap:wrap; justify-content: center; gap: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2rem; width: 100%;">
                <div class="detail-item" style="font-size: 0.85rem; font-weight: 600; white-space:nowrap;"><i class="ph-bold ph-calendar" style="color: var(--accent-primary); font-size: 1.1rem; margin-right: 0.4rem;"></i>${fechaFinal}</div>
                <div class="detail-item" style="font-size: 0.85rem; font-weight: 600; white-space:nowrap;"><i class="ph-bold ph-clock" style="color: var(--accent-primary); font-size: 1.1rem; margin-right: 0.4rem;"></i>${matchTimeFormatted}</div>
                <div class="detail-item" style="font-size: 0.85rem; font-weight: 600; white-space:nowrap;"><i class="ph-bold ph-map-pin" style="color: var(--accent-primary); font-size: 1.1rem; margin-right: 0.4rem;"></i>${(m.lugar || m.LUGAR || 'A CONFIRMAR').toUpperCase()}</div>
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
        const res = await fetch('https://hmaqdzkpjkxamggaiypo.supabase.co/rest/v1/config?key=eq.league_table&select=value', {
            headers: {
                'apikey': 'sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y'
            }
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0 && data[0].value) {
                teams = data[0].value;
            }
        }
    } catch(e) { console.warn("DB: Falló carga de tabla Supabase, intentando fallback"); }

    if (!teams || teams.length === 0) {
        try {
            const res = await fetch('data/league_table.json?v=' + Date.now());
            if (res.ok) teams = await res.json();
        } catch(e) {}
    }

    if (!teams || teams.length === 0) {
        teams = [
            { pos: 1, name: "La Costa FC", pj: 2, pts: 6 },
            { pos: 2, name: "Berges FC (Dom)", pj: 2, pts: 6 },
            { pos: 3, name: "FC Fernetbache ( Dom Pro)", pj: 2, pts: 6 },
            { pos: 4, name: "Porte FC (Domingo)", pj: 2, pts: 3 },
            { pos: 5, name: "Parque Guarani", pj: 1, pts: 3 },
            { pos: 6, name: "LA BUFARRA", pj: 2, pts: 3, highlighted: true },
            { pos: 7, name: "Safaera FC.", pj: 2, pts: 3 },
            { pos: 8, name: "C. A. Magna", pj: 2, pts: 3 },
            { pos: 9, name: "Alta Gama F.C", pj: 1, pts: 0 },
            { pos: 10, name: "Club Atletico Parenaese", pj: 2, pts: 0 },
            { pos: 11, name: "Prestcold FC", pj: 2, pts: 0 },
            { pos: 12, name: "ENFUGEIRA FC", pj: 2, pts: 0 }
        ];
    }
    
    // NO HACEMOS SORT AUTOMATICO, respetamos el orden manual del admin
    teams.forEach((t, i) => t.pos = i + 1);

    let displayTeams = expanded ? teams : teams.filter(t => t.highlighted || (t.name && t.name.toUpperCase().includes('BUFARRA')));
    
    // Si la lista es muy corta, mostrar el Top 5 para que la home no se vea vacía
    if (!expanded && displayTeams.length <= 1 && teams.length > 1) {
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
                        <div style="display:grid; grid-template-columns: 20px 30px 35px 1fr 40px 60px; align-items:center; transition: all 0.3s ease; padding: 1.2rem; background: ${isBufarra ? 'rgba(255,107,129,0.1)' : 'transparent'}; border-radius: 12px; border: ${isBufarra ? '1px solid var(--accent-primary)' : '1px solid transparent'};">
                            <div style="text-align:center;">
                                ${t.trend === 'up' ? '<i class="ph-fill ph-caret-up" style="color:#25D366; font-size:1rem;"></i>' : 
                                  t.trend === 'down' ? '<i class="ph-fill ph-caret-down" style="color:#ff4d4d; font-size:1rem;"></i>' : 
                                  '<span style="color:var(--text-muted); font-size:0.8rem; opacity:0.3;">-</span>'}
                            </div>
                            <div style="font-family:var(--font-display); font-size:1rem; font-weight:900; color:${isBufarra ? 'var(--accent-primary)' : '#fff'};">${t.pos}º</div>
                            <div style="display:flex; align-items:center; justify-content:center;">
                                ${shield ? `<img src="${shield}" style="width:24px; height:24px; object-fit:contain;">` : '<i class="ph ph-shield" style="font-size:24px; opacity:0.1;"></i>'}
                            </div>
                            <div style="font-family:var(--font-display); font-size: 0.95rem; font-weight:800; color:#fff; text-transform:uppercase;">${t.name}</div>
                            <div style="text-align:center; font-weight:700; color:var(--text-muted); font-size:0.9rem;">${t.pj} <small style="display:block; font-size:0.5rem; opacity:0.5;">PJ</small></div>
                            <div style="text-align:center; font-weight:900; color:${isBufarra ? 'var(--accent-primary)' : '#fff'}; font-size:1.2rem;">${t.pts} <small style="display:block; font-size:0.5rem; opacity:0.5; color:var(--text-muted);">PTS</small></div>
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
    
    // Si el array está vacío o no existe, forzamos la carga del roster base para que la Home nunca esté vacía
    if (!players2026 || players2026.length === 0) {
        console.warn("DB: allPlayers['2026'] vacío, generando roster de emergencia...");
        const rosterBase = ["Anzuatte", "Blanco", "Bonilla", "Colombo", "De Leon", "Flores", "Iza", "Martinez", "Mari", "Menchaca", "Molina", "Olarte", "Pedemonte", "Sparkov"];
        players2026 = rosterBase.map(name => ({ PLAYER: name, PJ: 0, GOLES: 0, ASISTENCIAS: 0, AMARILLAS: 0, ROJAS: 0 }));
    }
    
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

    const staffNamesToForce = ["SANTIAGO MATEO", "EMILIANO REYES", "MATEO", "REYES"];

    if (rawData) {
        Object.keys(rawData).forEach(tk => {
            const tData = rawData[tk];
            if (tData && tData.dt) {
                tData.dt.split(/[/,]/).forEach(name => {
                    const n = name.trim();
                    if (n && !explicitStaff.some(s => s.PLAYER.toUpperCase() === n.toUpperCase())) {
                        explicitStaff.push({ PLAYER: n, PJ: 0, GOLES: 0, ASISTENCIAS: 0, AMARILLAS: 0, ROJAS: 0, isStaff: true });
                    }
                });
            }
        });
    }

    // Forzar Staff si no está
    staffNamesToForce.forEach(stName => {
        const upper = stName.toUpperCase();
        // Evitar duplicados inteligentes (si ya hay alguien con ese nombre o es parte de un nombre existente)
        if (!explicitStaff.some(s => s.PLAYER.toUpperCase().includes(upper) || upper.includes(s.PLAYER.toUpperCase()))) {
            explicitStaff.push({ PLAYER: stName.charAt(0) + stName.slice(1).toLowerCase(), PJ: 0, GOLES: 0, ASISTENCIAS: 0, AMARILLAS: 0, ROJAS: 0, isStaff: true });
        }
    });

    if (!players2026.some(p => p.PLAYER.toUpperCase().includes('PEDEMONTE'))) {
        players2026.push({ PLAYER: 'Pedemonte', PJ: 0, GOLES: 0, ASISTENCIAS: 0, AMARILLAS: 0, ROJAS: 0 });
    }

    const statMap = { 'goles': 'GOLES', 'asistencias': 'ASISTENCIAS', 'tarjetas': 'tarjetas' };

    let players = players2026.filter(p => !p.isStaff && !staffNamesToForce.some(kw => (p.PLAYER || '').toUpperCase().includes(kw)));
    let staff = [...explicitStaff];
    
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

        players.sort((a,b) => {
            let valB, valA;
            if (filter === 'tarjetas') {
                valB = parseInt(b.AMARILLAS || 0) + parseInt(b.ROJAS || 0);
                valA = parseInt(a.AMARILLAS || 0) + parseInt(a.ROJAS || 0);
            } else {
                valB = parseInt(b[statMap[filter]] || 0);
                valA = parseInt(a[statMap[filter]] || 0);
            }
            if (valB !== valA) return valB - valA;
            
            // Desempate 1: Menos partidos jugados es mejor (si hay empate)
            const pjB = parseInt(b.PJ || 0);
            const pjA = parseInt(a.PJ || 0);
            if (pjA !== pjB) return pjA - pjB;
            
            // Desempate 2: Orden alfabético
            return (a.PLAYER || '').localeCompare(b.PLAYER || '');
        });
        staff = [];
    } else {
        // El staff ya está cargado por staffNamesToForce anteriormente
        players.sort((a,b) => (a.PLAYER||'').localeCompare(b.PLAYER||''));
    }

    const drawCard = (p) => {
        const nameText = (p.PLAYER || "").toUpperCase().trim();
        const isStaffItem = p.isStaff || staffNamesToForce.some(kw => nameText.includes(kw.toUpperCase()));
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

    // DEFENSA FINAL: Si el HTML quedó vacío, forzamos el dibujo del roster base
    if (!html || html.trim().length < 50) {
        console.warn("DB: El HTML de plantel parece estar vacío. Forzando render de emergencia.");
        const rosterBase = ["Anzuatte", "Blanco", "Bonilla", "Colombo", "De Leon", "Flores", "Iza", "Martinez", "Mari", "Menchaca", "Molina", "Olarte", "Pedemonte", "Sparkov"];
        html = rosterBase.map(name => drawCard({ PLAYER: name, PJ: 0, GOLES: 0, ASISTENCIAS: 0, AMARILLAS: 0, ROJAS: 0 })).join('');
    }

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
            const res = (m.RESULTADO || m.resultado || "").toString().toUpperCase();
            const resType = res.startsWith('V') ? 'V' : (res.startsWith('E') ? 'E' : 'D');
            const resColor = resType === 'V' ? '#2ecc71' : (resType === 'E' ? '#f1c40f' : '#ff4757');
            const fechaLabel = m.FECHA || m.fecha || 'TBD';
            const torneoStr = (m.torneo || "").toUpperCase();
            
            // Score display logic
            let scoreDisplay = "";
            if (m.GF !== undefined && m.GC !== undefined && m.GF !== "" && m.GC !== "") {
                scoreDisplay = `${m.GF} - ${m.GC}`;
                const extra = res.match(/\((.*)\)/);
                if (extra) scoreDisplay += ` (${extra[1]})`;
            } else {
                scoreDisplay = res || '?-?';
            }
            return `
                <div class="glass-panel" style="padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-light); border-radius: 12px;">
                    <div style="flex: 1.2;">
                        <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 0.2rem;">${fechaLabel}</div>
                        <div style="font-size: 0.65rem; color: var(--accent-primary); font-weight: 700; letter-spacing: 0.5px;">${torneoStr}</div>
                    </div>
                    <div style="flex: 1; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 1rem;">
                        <div style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 900; color: ${resColor}; text-shadow: 0 0 10px ${resColor}33;">${scoreDisplay}</div>
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
        const res = (m.RESULTADO || m.resultado || "").toString().toUpperCase();
        if (res.startsWith('V')) return '<span style="color:#2ecc71; font-weight:900; font-size:0.75rem;">G</span>';
        if (res.startsWith('E')) return '<span style="color:#f1c40f; font-weight:900; font-size:0.75rem;">E</span>';
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
        const rivalRaw = m.VS || m.rival || m.RIVAL || '';
        const rival = rivalRaw.toString().trim();
        if (rival && rival.toLowerCase().includes(q)) {
            results.push({ type: 'rival', label: rival, sub: 'Rival Histórico', icon: 'ph-shield', extra: getRivalFormHTML(rival) });
        }
    });

    const seen = new Set();
    const finalResults = results.filter(r => {
        // Normalización agresiva para el "seen" del buscador
        const normLabel = r.label.toUpperCase()
                           .replace(/\b(FC|F\.C|CA|C\.A|DEPORTIVA|CLUB|ATLETICO|ASOCIACION|JRS|JUNIORS)\b/gi, '')
                           .replace(/[^A-Z0-9]/g, '')
                           .trim();
        const key = `${r.type}-${normLabel}`;
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
    return;
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

