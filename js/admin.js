/* ═══════════════════════════════════════
   Admin Panel JS — La Bufarra
   ═══════════════════════════════════════ */

const SUPABASE_URL = "https://hmaqdzkpjkxamggaiypo.supabase.co";
const SUPABASE_KEY = "sb_publishable_Vu_F-McwcDK4g2k8fU6w7A_p_Mva8-Y";
const SP_HEADERS = { 
    "apikey": SUPABASE_KEY, 
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
};

let authToken = sessionStorage.getItem('bufarra_token') || '';
let currentUser = sessionStorage.getItem('bufarra_user') || '';
let roster = [];
let matchesData = [];
let playersData = {};
let upcomingData = [];
let financesData = { cuotas:{}, costoFecha:0, multas:[], transacciones:[], deadlines:[], cuotaObjetivo:2970 };
let manualStatsData = {};
let editingMatchId = null;
let currentTxFilter = 'all';
let currentMatchSearch = '';
let currentPlayerSearch = '';
let currentMatchYear = 'all';
let currentPlayerYear = 'ALL';
let adminLeagueTeams = [];

// ─── INIT ───
document.addEventListener('DOMContentLoaded', async () => {
    if (authToken) {
        showApp();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('fabContainer').style.display = 'none';
    }
    
    // Enter key on password
    document.getElementById('passwordInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
    });
    document.getElementById('usernameInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('passwordInput').focus();
    });
    document.getElementById('usernameInput').focus();
});

// ─── Supabase Helper ───
async function spFetch(endpoint, method = 'GET', body = null, select = '*') {
    let finalUrl = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    
    if (method === 'GET') {
        const hasParams = finalUrl.includes('?');
        const sep = hasParams ? '&' : '?';
        
        // Add select if not already in URL
        if (select && !finalUrl.includes('select=')) {
            finalUrl += `${sep}select=${select}`;
        }
    }
    
    const opts = {
        method,
        headers: { 
            ...SP_HEADERS,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    };
    if (body) opts.body = JSON.stringify(body);
    if (method === 'PATCH') {
        opts.headers['Prefer'] = 'return=representation';
    }

    try {
        const res = await fetch(finalUrl, opts);
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Supabase Error: ${res.status} ${errorText}`);
        }
        
        // Handle 204 No Content or empty bodies
        if (res.status === 204 || res.headers.get('content-length') === '0') {
            return {};
        }
        
        const text = await res.text();
        return text ? JSON.parse(text) : {};
    } catch (e) {
        console.error('Supabase Fetch Error:', e);
        // Silently fail for certain operations or toast for critical ones
        return null;
    }
}

// ─── AUTH (Supabase Version) ───
async function doLogin() {
    const user = document.getElementById('usernameInput').value.trim().toLowerCase();
    const pw = document.getElementById('passwordInput').value;
    if (!user || !pw) return;
    
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph-bold ph-circle-notch animate-spin"></i> Entrando...';
    
    try {
        // --- MASTER LOGIN OVERRIDE ---
        if ((user === 'admin' && pw === 'bufarra2026') || 
            (user === 'oso' && pw === 'oso2018') ||
            (user === 'feli' && pw === 'feli2018') ||
            (user === 'justi' && pw === 'justi2018')) {
            const displayNames = { admin: 'Administrador', oso: 'Oso', feli: 'Feli', justi: 'Justi' };
            authSuccess(user, displayNames[user]);
            return;
        }

        const loginUser = userData[user];
        
        // --- SECURE CONTEXT CHECK & FALLBACK ---
        if (!window.crypto || !window.crypto.subtle) {
            console.warn('Insecure context detected. Using fallback password check.');
            if (pw === 'labufarra2026') {
                authSuccess(user, loginUser?.display_name || user);
                return;
            } else {
                throw new Error('Insecure context: Solamente podes usar la clave maestra o activar SSL.');
            }
        }

        if (!loginUser) throw new Error('Usuario no encontrado');

        const saltHex = loginUser.salt;
        const storedHash = loginUser.hash;
        
        const encoder = new TextEncoder();
        const pwData = encoder.encode(pw);
        const saltData = encoder.encode(saltHex);
        
        const keyMaterial = await crypto.subtle.importKey('raw', pwData, 'PBKDF2', false, ['deriveBits']);
        const derivedKey = await crypto.subtle.deriveBits({
            name: 'PBKDF2',
            salt: saltData,
            iterations: 100000,
            hash: 'SHA-256'
        }, keyMaterial, 256);
        
        const hashArray = Array.from(new Uint8Array(derivedKey));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (hashHex === storedHash || pw === 'labufarra2026') {
            authSuccess(user, loginUser.display_name || user);
        } else {
            throw new Error('Contraseña incorrecta');
        }
    } catch (e) {
        console.warn('Login failure:', e.message);
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('passwordInput').value = '';
        document.getElementById('usernameInput').focus();
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph-bold ph-lock-key"></i> Ingresar';
    }
}

function authSuccess(user, displayName) {
    authToken = 'supabase_authed'; 
    currentUser = displayName || user;
    
    sessionStorage.setItem('bufarra_token', authToken);
    sessionStorage.setItem('bufarra_user', currentUser);
    showApp();
}

function togglePasswordVisibility() {
    const pwd = document.getElementById('passwordInput');
    const icon = document.getElementById('passwordToggleIcon');
    if (pwd.type === 'password') {
        pwd.type = 'text';
        icon.classList.remove('ph-eye');
        icon.classList.add('ph-eye-slash');
    } else {
        pwd.type = 'password';
        icon.classList.remove('ph-eye-slash');
        icon.classList.add('ph-eye');
    }
}

// ─── UI Helpers ───
function toggleFAB() {
    document.getElementById('fabContainer').classList.toggle('active');
}

// Close FAB when clicking outside
document.addEventListener('click', (e) => {
    const fab = document.getElementById('fabContainer');
    if (fab && !fab.contains(e.target) && fab.classList.contains('active')) {
        fab.classList.remove('active');
    }
});

// Función original deshabilitada movida a la segunda declaración de doChangePassword

function doLogout() {
    authToken = '';
    sessionStorage.removeItem('bufarra_user');
    document.getElementById('adminApp').style.display = 'none';
    document.getElementById('fabContainer').style.display = 'none';
    const errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.style.display = 'none';
}

async function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminApp').style.display = 'block';
    document.getElementById('fabContainer').style.display = 'block';
    document.getElementById('userGreeting').textContent = `Hola, ${currentUser}`;
    
    // Load all data
    await loadRoster();
    await loadManualStats(); // Load this before others for UI consistency
    
    await Promise.all([
        loadMatches(),
        loadPlayers(),
        loadUpcoming(),
        loadFinances(),
        loadLeagueTableAdmin()
    ]);
    
    renderLeagueTableAdmin();

    // Recalcular automáticamente si no hay datos o hay inconsistencias
    if (Object.keys(playersData).length === 0) {
        await recalculateAllStats();
    }
}

// ── Password Change ──
function showChangePassword() {
    openModal('Cambiar Contraseña', `
        <div class="form-grid" style="grid-template-columns:1fr">
            <div class="form-group">
                <label>Contraseña actual</label>
                <input type="password" id="cpOld" placeholder="Tu contraseña actual">
            </div>
            <div class="form-group">
                <label>Nueva contraseña</label>
                <input type="password" id="cpNew" placeholder="Mínimo 4 caracteres">
            </div>
            <div class="form-group">
                <label>Confirmar nueva contraseña</label>
                <input type="password" id="cpConfirm" placeholder="Repetí la nueva">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" style="width:auto" onclick="doChangePassword()">
                <i class="ph-bold ph-key"></i> Cambiar
            </button>
        </div>
    `);
}

async function doChangePassword() {
    const oldPw = document.getElementById('cpOld').value;
    const newPw = document.getElementById('cpNew').value;
    const confirmPw = document.getElementById('cpConfirm').value;
    
    if (newPw !== confirmPw) { toast('Las contraseñas no coinciden', 'error'); return; }
    if (newPw.length < 4) { toast('Mínimo 4 caracteres', 'error'); return; }
    
    // Traer usuarios de Supabase para validar clave vieja
    const data = await spFetch('config?key=eq.users', 'GET', null, 'value');
    if (!data || !data[0]) { toast('Error de conexión', 'error'); return; }
    const configVal = data[0].value;
    const userData = configVal.users || {};
    
    // currentUser se graba globalmente en el login (es por ej. "Oso" en display o usuario)
    // Buscamos el key correcto en el objeto de usuarios:
    const username = Object.keys(userData).find(k => (userData[k].display_name || k).toLowerCase() === currentUser.toLowerCase());
    if (!username) { toast('Usuario no encontrado', 'error'); return; }
    
    const userObj = userData[username];
    const passwordMatchParams = {
        name: 'PBKDF2',
        salt: new TextEncoder().encode(userObj.salt),
        iterations: 100000,
        hash: 'SHA-256'
    };
    
    const encoder = new TextEncoder();
    
    // 1. Verificar la contraseña vieja
    const oldKeyMaterial = await crypto.subtle.importKey('raw', encoder.encode(oldPw), 'PBKDF2', false, ['deriveBits']);
    const oldDerivedKey = await crypto.subtle.deriveBits(passwordMatchParams, oldKeyMaterial, 256);
    const oldHashHex = Array.from(new Uint8Array(oldDerivedKey)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // labufarra2026 es el pasaporte de emergencia por si perdimos la pass vieja
    if (oldHashHex !== userObj.hash && oldPw !== 'labufarra2026') {
        toast('Contraseña actual incorrecta', 'error');
        return;
    }
    
    // 2. Generar el hash y salt de la NUEVA contraseña
    const newSaltHex = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
    const newKeyMaterial = await crypto.subtle.importKey('raw', encoder.encode(newPw), 'PBKDF2', false, ['deriveBits']);
    const newDerivedKey = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt: encoder.encode(newSaltHex),
        iterations: 100000,
        hash: 'SHA-256'
    }, newKeyMaterial, 256);
    const newHashHex = Array.from(new Uint8Array(newDerivedKey)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // 3. Guardar en Supabase
    userData[username].salt = newSaltHex;
    userData[username].hash = newHashHex;
    
    const res = await spFetch('config?key=eq.users', 'PATCH', { value: configVal });
    
    if (res) {
        toast('Contraseña actualizada ✓', 'success');
        closeModal();
    } else {
        toast('Error al guardar la nueva contraseña', 'error');
    }
}

// ─── TAB MANAGEMENT ───
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).style.display = 'block';

    if (tabName === 'notificaciones') loadNotifications();
}

// ─── ROSTER ───
// Helper to strip accents to avoid normalization mismatch
function removeAccents(str) {
    if (!str) return str;
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function loadRoster() {
    // Plantel Oficial 2026 (Forzado para evitar históricos)
    roster = ['Anzuatte', 'Blanco', 'Bonilla', 'Colombo', 'Iza', 'Mari', 'Martinez', 'Menchaca', 'Olarte', 'Sparkov', 'Flores', 'De Leon', 'Molina', 'Pedemonte'].sort();
    
    console.log("Roster 2026 activo:", roster.length);
    buildPlayersFormTable();
}

// ── Roster Management ──
function showRosterManager() {
    const listHtml = roster.map((name) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; margin-bottom:5px; border-radius:8px;">
            <span>${name}</span>
            <button class="btn btn-icon btn-danger btn-sm" onclick="deleteRosterPlayer('${name}')">
                <i class="ph-bold ph-trash"></i>
            </button>
        </div>
    `).join('');

    openModal('Gestionar Plantel Global', `
        <div style="margin-bottom:1.5rem; max-height:40vh; overflow-y:auto; padding-right:5px;">
            ${listHtml || '<div class="empty-state">No hay jugadores</div>'}
        </div>
        <div class="form-group" style="margin-top:10px">
            <label>Agregar Nuevo Jugador</label>
            <div style="display:flex; gap:10px;">
                <input type="text" id="newRosterName" placeholder="Ej: Perez" style="margin-bottom:0">
                <button class="btn btn-primary" onclick="addRosterPlayer()" style="width:auto; white-space:nowrap;">
                    <i class="ph-bold ph-plus"></i> Añadir
                </button>
            </div>
        </div>
        <div class="form-actions" style="margin-top:20px;">
            <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
        </div>
    `);
}

async function addRosterPlayer() {
    const inp = document.getElementById('newRosterName');
    const name = inp.value.trim();
    if (!name) return;
    
    // Validar si existe
    if (roster.some(r => r.toLowerCase() === name.toLowerCase())) {
        toast('El jugador ya existe', 'error');
        return;
    }
    
    const newRoster = [...roster, name].sort();
    
    // Guardar en la DB
    const res = await spFetch('config?key=eq.roster', 'PATCH', { value: newRoster });
    if (res) {
        toast('Jugador agregado', 'success');
        await loadRoster(); // recarga la memoria
        buildPlayersFormTable(); // Actualiza planilla de partido
        renderCuotas(); // Actualiza finanzas
        showRosterManager(); // refresh el modal
    }
}

async function deleteRosterPlayer(name) {
    if (!confirm(`¿Eliminar a ${name} del plantel? (Esto no borra su historial de estadísticas previo)`)) return;
    
    const newRoster = roster.filter(r => r !== name);
    
    const res = await spFetch('config?key=eq.roster', 'PATCH', { value: newRoster });
    if (res) {
        toast('Jugador eliminado', 'success');
        await loadRoster();
        buildPlayersFormTable();
        renderCuotas();
        showRosterManager();
    }
}

function buildPlayersFormTable() {
    const tbody = document.getElementById('playersFormBody');
    tbody.innerHTML = '';
    
    roster.forEach((name, idx) => {
        const tr = document.createElement('tr');
        tr.id = `player-row-${idx}`;
        tr.className = 'player-inactive';
        tr.innerHTML = `
            <td>${name}</td>
            <td><input type="checkbox" class="pJugo" data-idx="${idx}" onchange="togglePlayerRow(${idx})"></td>
            <td><input type="number" class="pGoles" data-idx="${idx}" value="0" min="0" disabled></td>
            <td><input type="number" class="pAsist" data-idx="${idx}" value="0" min="0" disabled></td>
            <td><input type="number" class="pAmar" data-idx="${idx}" value="0" min="0" disabled></td>
            <td><input type="number" class="pRoja" data-idx="${idx}" value="0" min="0" disabled></td>
            <td><input type="radio" name="mvp" class="pMVP" data-idx="${idx}" disabled></td>
        `;
        tbody.appendChild(tr);
    });
}

function togglePlayerRow(idx) {
    const row = document.getElementById(`player-row-${idx}`);
    const checked = row.querySelector('.pJugo').checked;
    row.className = checked ? '' : 'player-inactive';
    row.querySelectorAll('input[type="number"], input[type="radio"]').forEach(inp => {
        inp.disabled = !checked;
        if (!checked) {
            if (inp.type === 'number') inp.value = '0';
            if (inp.type === 'radio') inp.checked = false;
        }
    });
}

// ─── MATCHES ───
async function loadMatches() {
    let data = await spFetch('matches', 'GET', null, '*');
    if (!data) data = [];
    
    matchesData = data.map(m => {
        const dateStr = m.fecha || '';
        let year = 'S/D';
        
        // Supabase uses YYYY-MM-DD
        if (dateStr.includes('-')) {
            year = dateStr.split('-')[0];
        } else if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            year = parts[parts.length - 1];
        }
        
        if (year.length === 2) year = '20' + year;

        // Extraer hora si está escondida en el JSON de jugadores
        let matchHora = m.hora || '';
        if (!matchHora && m.jugadores && m.jugadores.__hora) {
            matchHora = m.jugadores.__hora;
        }

        return {
            ...m,
            fecha: dateStr.includes('-') ? formatDateForUI(dateStr) : dateStr,
            año: year,
            hora: matchHora
        };
    });

    renderMatchesList();
}

function formatDateForUI(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${parseInt(d)}/${parseInt(m)}/${y}`;
}

function formatDateForDB(uiDate) {
    if (!uiDate) return null;
    const parts = uiDate.split('/');
    if (parts.length < 3) return null;
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
}

function renderMatchesList() {
    const container = document.getElementById('matchesList');
    const filtersContainer = document.getElementById('matchYearFilters');
    
    // Build year filters
    const years = [...new Set(matchesData.map(m => m.año))].sort().reverse();
    filtersContainer.innerHTML = `<button class="filter-pill active" onclick="filterMatches('all')">Todos</button>` +
        years.map(y => `<button class="filter-pill" onclick="filterMatches('${y}')">${y}</button>`).join('');
    
    renderFilteredMatches('all');
}

function filterMatches(year) {
    currentMatchYear = year;
    document.querySelectorAll('#matchYearFilters .filter-pill').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderFilteredMatches(year);
}

function filterMatchesBySearch() {
    const input = document.getElementById('matchSearchInput');
    currentMatchSearch = input.value.toLowerCase();
    
    // Toggle clear button
    const clearBtn = document.getElementById('clearMatchSearch');
    if (clearBtn) clearBtn.style.display = currentMatchSearch ? 'flex' : 'none';
    
    renderFilteredMatches(currentMatchYear);
}

function clearSearch(type) {
    if (type === 'match') {
        document.getElementById('matchSearchInput').value = '';
        currentMatchSearch = '';
        document.getElementById('clearMatchSearch').style.display = 'none';
        renderFilteredMatches(currentMatchYear);
    } else if (type === 'player') {
        document.getElementById('playerSearchInput').value = '';
        currentPlayerSearch = '';
        document.getElementById('clearPlayerSearch').style.display = 'none';
        renderFilteredPlayers(currentPlayerYear);
    }
}

function renderFilteredMatches(year) {
    const container = document.getElementById('matchesList');
    if (!matchesData) return;
    
    // Check for pending "Upcoming" matches that are past their date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pendingMatches = (upcomingData || []).filter(u => {
        if (!u.fecha) return false;
        const parts = u.fecha.split('/');
        if (parts.length !== 3) return false;
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        return d <= today;
    });
    
    let pendingAlertHTML = '';
    if (pendingMatches.length > 0) {
        pendingAlertHTML = pendingMatches.map(u => `
            <div class="match-item" style="border: 2px solid var(--accent); background: rgba(0,255,136,0.05);" onclick="convertUpcoming('${u.id}')">
                <div class="match-info">
                    <div style="color:var(--accent); font-weight:bold; margin-bottom:5px;">⚠ PARTIDO PENDIENTE DE CARGA</div>
                    <div class="date">${u.fecha || ''} · ${u.hora || ''}</div>
                    <div class="teams">LA BUFARRA vs ${u.rival || '?'}</div>
                    <div class="meta">${u.torneo || ''} ${u.instancia ? '- ' + u.instancia : ''}</div>
                </div>
                <div class="match-actions" style="display:flex; gap:0.4rem;" onclick="event.stopPropagation()">
                    <button class="btn btn-icon btn-danger btn-sm" onclick="event.stopPropagation(); if(confirm('¿Descartar este aviso de carga rápida?')) deleteUpcoming('${u.id}')" title="Descartar aviso">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="convertUpcoming('${u.id}')" title="Cargar a Estadísticas">
                        <i class="ph-bold ph-note-pencil"></i> Cargar Datos
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    const parseDate = (s) => {
        if (!s) return 0;
        if (s.includes('/')) {
            const [d, m, y] = s.split('/');
            return new Date(y, m - 1, d).getTime();
        }
        return new Date(s).getTime();
    };

    // Filter and Sort
    let filtered = [...matchesData];
    if (year !== 'all') {
        filtered = filtered.filter(m => String(m.año) === String(year));
    }
    if (currentMatchSearch) {
        filtered = filtered.filter(m => (m.rival || '').toLowerCase().includes(currentMatchSearch));
    }
    
    filtered.sort((a,b) => parseDate(b.fecha) - parseDate(a.fecha));
    
    if (filtered.length === 0 && pendingMatches.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="ph-bold ph-soccer-ball"></i><p>No se encontraron partidos</p></div>';
        return;
    }
    
    container.innerHTML = pendingAlertHTML + filtered.map(m => {
        const resClass = m.gf > m.gc ? 'win' : m.gf === m.gc ? 'draw' : 'loss';
        const resLetter = m.gf > m.gc ? 'V' : m.gf === m.gc ? 'E' : 'D';
        const torneo = m.instancia ? `${m.torneo} - ${m.instancia}` : m.torneo;
        return `
            <div class="match-item" onclick="editMatch('${m.id}')">
                <div class="match-info">
                    <div class="date">${m.fecha} · ${m.hora || '--:--'}hs · ${m.lugar || ''}</div>
                    <div class="teams">LA BUFARRA ${m.gf} - ${m.gc} ${m.rival}</div>
                    <div class="meta">${torneo || 'Amistoso'}</div>
                </div>
                <div class="result-badge ${resClass}">${resLetter}</div>
                <div class="match-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-icon btn-secondary" onclick="editMatch('${m.id}')" title="Editar">
                        <i class="ph-bold ph-pencil"></i>
                    </button>
                    <button class="btn btn-icon btn-danger" onclick="deleteMatch('${m.id}')" title="Eliminar">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ─── MATCH FORM ───
function toggleMatchForm() {
    const container = document.getElementById('matchFormContainer');
    const btn = document.getElementById('toggleFormBtn');
    const isVisible = container.style.display !== 'none';
    
    if (isVisible) {
        container.style.display = 'none';
        btn.innerHTML = '<i class="ph-bold ph-plus"></i> Nuevo';
        btn.classList.remove('btn-danger');
        editingMatchId = null;
    } else {
        container.style.display = 'block';
        btn.innerHTML = '<i class="ph-bold ph-x"></i>';
        btn.classList.add('btn-danger');
        document.getElementById('matchFormTitle').textContent = 'Agregar Partido';
        document.getElementById('saveMatchTopBtn').style.display = 'none';
        clearMatchForm();
    }
}

function cancelMatchForm() {
    document.getElementById('matchFormContainer').style.display = 'none';
    document.getElementById('saveMatchTopBtn').style.display = 'none';
    editingMatchId = null;
    clearMatchForm();
}

function clearMatchForm() {
    document.getElementById('mAño').value = new Date().getFullYear();
    document.getElementById('mFecha').value = '';
    document.getElementById('mTorneo').value = '';
    document.getElementById('mInstancia').value = '';
    document.getElementById('mRival').value = '';
    document.getElementById('mGF').value = '0';
    document.getElementById('mGC').value = '0';
    document.getElementById('mLugar').value = '';
    document.getElementById('mHora').value = '';
    
    // Reset player table
    document.querySelectorAll('.pJugo').forEach(cb => {
        cb.checked = false;
        const idx = cb.dataset.idx;
        togglePlayerRow(parseInt(idx));
    });
}

function formatDateToCSV(dateStr) {
    // Convert YYYY-MM-DD to D/M/YYYY
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
}

function formatDateToInput(val) {
    if (!val) return '';
    // If already YYYY-MM-DD (ISO)
    if (val.includes('-')) return val.split('T')[0];
    
    // If D/M/YYYY (UI)
    const parts = val.split('/');
    if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        let y = parts[2];
        if (y.length === 2) y = '20' + y;
        return `${y}-${m}-${d}`;
    }
    return val;
}

async function saveMatch() {
    const rival = document.getElementById('mRival').value.trim();
    if (!rival) {
        toast('Ingresá el nombre del rival', 'error');
        return;
    }
    
    const playersLineup = {};
    roster.forEach((name, idx) => {
        const jugo = document.querySelector(`.pJugo[data-idx="${idx}"]`).checked;
        if (jugo) {
            playersLineup[name] = {
                goles: parseInt(document.querySelector(`.pGoles[data-idx="${idx}"]`).value) || 0,
                asistencias: parseInt(document.querySelector(`.pAsist[data-idx="${idx}"]`).value) || 0,
                amarillas: parseInt(document.querySelector(`.pAmar[data-idx="${idx}"]`).value) || 0,
                rojas: parseInt(document.querySelector(`.pRoja[data-idx="${idx}"]`).value) || 0,
                mvp: document.querySelector(`.pMVP[data-idx="${idx}"]`).checked
            };
        }
    });

    // The date input type="date" already returns YYYY-MM-DD which is what the DB expects.
    // Do NOT pass through formatDateForDB (which expects D/M/YYYY and would return null).
    const rawFecha = document.getElementById('mFecha').value; // YYYY-MM-DD from input[type=date]
    // Clonar para no ensuciar la visualización
    const playersToSave = { ...playersLineup };
    const mHora = document.getElementById('mHora').value;
    if (mHora) {
        playersToSave['__hora'] = mHora; // Guardado "invisible"
    }

    const matchObj = {
        fecha: rawFecha || null,
        rival: rival.toUpperCase(),
        gf: parseInt(document.getElementById('mGF').value) || 0,
        gc: parseInt(document.getElementById('mGC').value) || 0,
        torneo: document.getElementById('mTorneo').value,
        instancia: document.getElementById('mInstancia').value,
        lugar: document.getElementById('mLugar').value,
        jugadores: playersToSave
    };

    const id = editingMatchId || ('m' + Date.now());
    const method = editingMatchId ? 'PATCH' : 'POST';
    const urlSuffix = editingMatchId ? `?id=eq.${editingMatchId}` : '';
    
    // Solo enviamos el ID si es un registro nuevo (POST)
    if (!editingMatchId) matchObj.id = id;

    const res = await spFetch('matches' + urlSuffix, method, matchObj);
    if (res !== null) {
        toast(editingMatchId ? 'Cambios guardados ✓' : 'Partido creado ✓ No olvides correr tu script Python', 'success');
        
        // --- BORRADO AUTOMÁTICO DE PRÓXIMOS ---
        // Si no estábamos editando, verificamos si existe un aviso de Carga Rápida o partido próximo que coincida
        if (!editingMatchId && rawFecha) {
            const uiDate = formatDateForUI(rawFecha); // D/M/YYYY
            const upcomingMatch = (upcomingData || []).find(u => 
                u.fecha === uiDate && 
                u.rival && matchObj.rival && 
                u.rival.trim().toLowerCase() === matchObj.rival.trim().toLowerCase()
            );
            if (upcomingMatch) {
                // Lo borramos silenciosamente de próximos porque ya se jugó
                await spFetch(`upcoming?id=eq.${upcomingMatch.id}`, 'DELETE');
                console.log('Aviso de Próximos borrado automáticamente tras cargar el partido.');
            }
        }

        editingMatchId = null; // Limpiar estado de edición
        cancelMatchForm();
        const mainBtn = document.getElementById('toggleFormBtn');
        if (mainBtn) {
            mainBtn.innerHTML = '<i class="ph-bold ph-plus"></i> Nuevo';
            mainBtn.classList.remove('btn-danger');
        }

        // Refresh UI
        loadMatches();
        loadUpcoming(); // Refrescar próximos por si se borró
        loadPlayers();
        
        setTimeout(() => {
            if (confirm('¿Querés avisar de estos cambios al grupo de WhatsApp?')) {
                const isNew = !editingMatchId;
                const verb = isNew ? '¡Nuevo partido cargado!' : 'Atención: Hubo una corrección en las páginas de estadísticas del último partido.';
                const text = `*La Bufarra - Panel Estadístico*\n${verb}\n\n*Rival:* ${matchObj.rival}\n*Resultado:* La Bufarra ${matchObj.gf} - ${matchObj.gc} ${matchObj.rival}\n\nRevisá los puntos en labufarra.com ⚽`;
                window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text), '_blank');
            }
        }, 300);
    } else {
        console.error("Fallo al guardar partido:", matchObj);
        toast('Error al guardar en la nube. Revisá conexión.', 'error');
    }
}

function editMatch(matchId) {
    const match = matchesData.find(m => m.id === matchId);
    if (!match) return;
    
    editingMatchId = matchId;
    document.getElementById('matchFormTitle').textContent = 'Editar Partido';
    document.getElementById('matchFormContainer').style.display = 'block';
    document.getElementById('saveMatchTopBtn').style.display = 'flex';

    // Rellenar campos básicos
    document.getElementById('mAño').value = match.año || match.year || new Date().getFullYear();
    document.getElementById('mFecha').value = formatDateToInput(match.fecha);
    document.getElementById('mTorneo').value = match.torneo || '';
    document.getElementById('mInstancia').value = match.instancia || '';
    document.getElementById('mRival').value = match.rival || '';
    document.getElementById('mGF').value = match.gf || 0;
    document.getElementById('mGC').value = match.gc || 0;
    document.getElementById('mLugar').value = match.lugar || '';
    document.getElementById('mHora').value = match.hora || '';
    
    // Reset all players
    document.querySelectorAll('.pJugo').forEach(cb => {
        cb.checked = false;
        togglePlayerRow(parseInt(cb.dataset.idx));
    });
    
    // Fill in player data from Supabase object format { "Name": { goles: 1... } }
    if (match.jugadores) {
        for (const [name, jug] of Object.entries(match.jugadores)) {
            if (name === '__hora') continue; // Saltar metadato de hora
            
            // Match using normalized names
            const normName = removeAccents(name.toLowerCase());
            const rosterIdx = roster.findIndex(r => removeAccents(r.toLowerCase()) === normName);
            
            if (rosterIdx >= 0) {
                document.querySelector(`.pJugo[data-idx="${rosterIdx}"]`).checked = true;
                togglePlayerRow(rosterIdx);
                document.querySelector(`.pGoles[data-idx="${rosterIdx}"]`).value = jug.goles || 0;
                document.querySelector(`.pAsist[data-idx="${rosterIdx}"]`).value = jug.asistencias || 0;
                document.querySelector(`.pAmar[data-idx="${rosterIdx}"]`).value = jug.amarillas || 0;
                document.querySelector(`.pRoja[data-idx="${rosterIdx}"]`).value = jug.rojas || 0;
                if (jug.mvp) {
                    document.querySelector(`.pMVP[data-idx="${rosterIdx}"]`).checked = true;
                }
            }
        }
    }
    document.getElementById('matchFormPanel').scrollIntoView({ behavior: 'smooth' });
}

async function deleteMatch(matchId) {
    const match = matchesData.find(m => m.id === matchId);
    if (!match) return;
    if (!confirm(`¿Eliminar partido vs ${match.rival}? Esta acción no se puede deshacer.`)) return;
    
    // Save the raw ISO fecha before deleting (match.fecha is formatted D/M/YYYY for UI)
    // We need to reconstruct the ISO date for stats update
    const matchForStats = {
        ...match,
        fecha: formatDateToInput(match.fecha) || match.fecha  // convert back to YYYY-MM-DD
    };
    
    const res = await spFetch(`matches?id=eq.${matchId}`, 'DELETE');
    if (res !== null) {
        toast('Partido eliminado', 'success');
        await updateStatsForMatch(matchForStats, true);
        await loadMatches();
        await loadPlayers();
    } else {
        toast('Error al eliminar el partido', 'error');
    }
}

// ─── PLAYER DATABASE & NORMALIZATION ───
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
    'Molina': { fullName: 'Justiniano Molina', aliases: ['Justi'] }
};

function removeAccents(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeName(name) {
    if (!name) return "";
    const clean = removeAccents(name.trim().toLowerCase());
    
    // Hardcoded authoritative mappings (Surname only)
    const authoritativeMap = {
        'alvez': 'Alvez', 'lautaro alvez': 'Alvez',
        'anzuatte': 'Anzuatte', 'agustin anzuatte': 'Anzuatte',
        'blanco': 'Blanco', 'tomas blanco': 'Blanco',
        'brito': 'Brito', 'emiliano brito': 'Brito',
        'bonilla': 'Bonilla', 'felipe bonilla': 'Bonilla',
        'cravino': 'Cravino', 'agustin cravino': 'Cravino',
        'colombo': 'Colombo', 'mateo colombo': 'Colombo',
        'da silveira': 'Da Silveira', 'guzman da silveira': 'Da Silveira',
        'de leon': 'De Leon', 'enzo de leon': 'De Leon',
        'dobal': 'Dobal', 'federico dobal': 'Dobal',
        'fernandez': 'Fernandez', 'geronimo fernandez': 'Fernandez',
        'flores': 'Flores', 'antonio flores': 'Flores',
        'iza': 'Iza', 'federico iza': 'Iza',
        'lorenzo': 'Lorenzo', 'martin lorenzo': 'Lorenzo',
        'luzardo': 'Luzardo', 'valentin luzardo': 'Luzardo',
        'martinez': 'Martinez', 'miqueas martinez': 'Martinez',
        'mari': 'Mari', 'pablo mari': 'Mari',
        'mateo': 'Mateo', 'santiago mateo': 'Mateo',
        'menchaca': 'Menchaca', 'mateo menchaca': 'Menchaca',
        'molina': 'Molina', 'justiniano molina': 'Molina',
        'olarte': 'Olarte', 'juan miguel olarte': 'Olarte',
        'pedemonte': 'Pedemonte', 'sebastian pedemonte': 'Pedemonte',
        'rocca': 'Rocca', 'diego rocca': 'Rocca',
        'rodriguez': 'Rodriguez', 'guillermo rodriguez': 'Rodriguez',
        'silva': 'Silva', 'bruno silva': 'Silva',
        'gaston silva': 'Silva, Gaston',
        'sparkov': 'Sparkov', 'santiago sparkov': 'Sparkov',
        'valle': 'Valle', 'joaquin valle': 'Valle',
        'vigil': 'Vigil', 'sebastian vigil': 'Vigil',
        'balestie': 'Balestie', 'kevin balestie': 'Balestie'
    };

    return authoritativeMap[clean] || (clean.charAt(0).toUpperCase() + clean.slice(1));
}



async function loadPlayers() {
    // 1. Cargar Base Histórica DESDE EL EXCEL (Verdad Absoluta para el Histórico FINAL)
    playersData = { 'ALL': {} };
    
    if (window.PLAYERS_EXCEL_DATA) {
        // El ALL del Excel es la única fuente para la pestaña HISTÓRICO
        if (window.PLAYERS_EXCEL_DATA['ALL']) {
            window.PLAYERS_EXCEL_DATA['ALL'].forEach(p => {
                const name = normalizeName(p.nombre || p.player_name);
                playersData['ALL'][name] = { ...p, player_name: name };
            });
        }
        
        // Cargar otros años del Excel
        Object.keys(window.PLAYERS_EXCEL_DATA).forEach(y => {
            if (y === 'ALL') return;
            playersData[y] = {};
            window.PLAYERS_EXCEL_DATA[y].forEach(p => {
                const name = normalizeName(p.nombre || p.player_name);
                playersData[y][name] = { ...p, player_name: name };
            });
        });
    }
    
    // 2. Cargar datos de la nube (Predominan para el año actual 2026)
    let cloudData = await spFetch('players_stats', 'GET', null, '*');
    
    if (cloudData && Array.isArray(cloudData)) {
        cloudData.forEach(p => {
            const year = p.year || '2026';
            if (year === 'ALL') return; 
            
            const name = normalizeName(p.player_name);
            if (!playersData[year]) playersData[year] = {};
            playersData[year][name] = { ...p, player_name: name };
        });
    }

    renderPlayersStats();
}


// STATISTICS LOADED ABOVE

function renderPlayersStats() {
    const container = document.getElementById('playersStatsGrid');
    const filtersContainer = document.getElementById('playerYearFilters');
    
    const years = Object.keys(playersData).filter(k => k !== 'ALL').sort().reverse();
    filtersContainer.innerHTML = `<button class="filter-pill active" onclick="filterPlayers('ALL')">Histórico</button>` +
        years.map(y => `<button class="filter-pill" onclick="filterPlayers('${y}')">${y}</button>`).join('');
    
    renderFilteredPlayers('ALL');
}

function filterPlayers(year) {
    currentPlayerYear = year;
    document.querySelectorAll('#playerYearFilters .filter-pill').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderFilteredPlayers(year);
}

function filterPlayersBySearch() {
    const input = document.getElementById('playerSearchInput');
    currentPlayerSearch = input.value.trim().toLowerCase();
    
    // Toggle clear button
    const clearBtn = document.getElementById('clearPlayerSearch');
    if (clearBtn) clearBtn.style.display = currentPlayerSearch ? 'flex' : 'none';
    
    renderFilteredPlayers(currentPlayerYear);
}

function renderFilteredPlayers(year) {
    const container = document.getElementById('playersStatsGrid');
    
    // Asegurarnos de usar todos los jugadores presentes en la data de ese año (los 30+)
    const playersObj = playersData[year] || {};
    let players = Object.values(playersObj);
    
    // Apply search filter (Matching names, full names, and aliases)
    if (currentPlayerSearch) {
        players = players.filter(p => {
            const normName = (p.player_name || p.nombre || '').toLowerCase();
            return normName.includes(currentPlayerSearch);
        });
    }

    if (players.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="ph-bold ph-users"></i><p>No se encontraron jugadores</p></div>';
        return;
    }
    
    // Sort by PJ descending
    const sorted = players.sort((a, b) => (b.pj || b.PJ || 0) - (a.pj || a.PJ || 0));
    
    container.innerHTML = sorted.map(p => {
        const nombre = p.player_name || p.nombre || p.PLAYER || 'Sin nombre';
        const pj = p.pj || p.PJ || 0;
        const pg = p.pg || p.PG || 0;
        const pe = p.pe || p.PE || 0;
        const pp = p.pp || p.PP || 0;
        const goles = p.goles || p.GOLES || 0;
        const asist = p.asistencias || p.ASISTENCIAS || 0;
        const amar = p.amarillas || p.AMARILLAS || 0;
        const rojas = p.rojas || p.ROJAS || 0;
        const mvp = p.mvp || p.MVP || 0;
        const winPct = pj > 0 ? Math.round(pg / pj * 100) : 0;
        
        return `
            <div class="player-stat-card">
                <div class="name" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${nombre}</span>
                    <button class="btn btn-icon btn-sm" onclick="openEditPlayerModal('${nombre}')" style="background:transparent; color:var(--text-muted);">
                        <i class="ph-bold ph-pencil-simple"></i>
                    </button>
                </div>
                <div class="stat-row">
                    <div class="stat-item"><div class="val">${pj}</div><div class="lbl">PJ</div></div>
                    <div class="stat-item"><div class="val" style="color:var(--green)">${pg}</div><div class="lbl">PG</div></div>
                    <div class="stat-item"><div class="val" style="color:var(--yellow)">${pe}</div><div class="lbl">PE</div></div>
                    <div class="stat-item"><div class="val" style="color:var(--red)">${pp}</div><div class="lbl">PP</div></div>
                    <div class="stat-item"><div class="val">${goles}</div><div class="lbl">GOL</div></div>
                    <div class="stat-item"><div class="val">${asist}</div><div class="lbl">ASI</div></div>
                    <div class="stat-item"><div class="val">${amar}</div><div class="lbl">🟨</div></div>
                    <div class="stat-item"><div class="val">${rojas}</div><div class="lbl">🟥</div></div>
                    <div class="stat-item"><div class="val">${mvp}</div><div class="lbl">MVP</div></div>
                    <div class="stat-item"><div class="val">${winPct}%</div><div class="lbl">%PG</div></div>
                </div>
            </div>
        `;
    }).join('');
}

// ─── UPCOMING ───
async function loadUpcoming() {
    const data = await spFetch('upcoming', 'GET', null, '*');
    if (data) {
        // Ordenar por fecha ISO nativa (más próximo primero)
        data.sort((a, b) => {
            if (!a.fecha) return 1;
            if (!b.fecha) return -1;
            return new Date(a.fecha) - new Date(b.fecha);
        });
        
        upcomingData = data.map(u => ({
            ...u,
            fecha: formatDateForUI(u.fecha)
        }));
    }
    renderUpcoming();
}

function renderUpcoming() {
    const container = document.getElementById('upcomingList');
    
    if (upcomingData.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="ph-bold ph-calendar"></i><p>No hay próximos partidos</p></div>';
        return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    container.innerHTML = upcomingData.map(u => {
        // Check if this match is in the past
        let isPast = false;
        if (u.fecha) {
            const parts = u.fecha.split('/');
            if (parts.length === 3) {
                const matchDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                isPast = matchDate <= today; // Include today
            }
        }
        
        return `
            <div class="match-item ${isPast ? 'past-match' : ''}">
                <div class="match-info">
                    <div class="date">${u.fecha || ''} · ${u.hora || ''} ${isPast ? '<span style="color:var(--accent);font-weight:600">⚠ Ya se jugó</span>' : ''}</div>
                    <div class="teams">LA BUFARRA vs ${u.rival || '?'}</div>
                    <div class="meta">${u.torneo || ''} ${u.instancia ? '- ' + u.instancia : ''} · ${u.lugar || ''}</div>
                </div>
                <div class="match-actions">
                    ${isPast ? `<button class="btn btn-secondary btn-sm" onclick="convertUpcoming('${u.id}')" title="Cargar datos del partido">
                        <i class="ph-bold ph-note-pencil"></i> Cargar Datos
                    </button>` : ''}
                    <button class="btn btn-icon btn-secondary" onclick="editUpcoming('${u.id}')" title="Editar">
                        <i class="ph-bold ph-pencil"></i>
                    </button>
                    <button class="btn btn-icon btn-danger" onclick="deleteUpcoming('${u.id}')" title="Eliminar">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}


async function deleteUpcoming(id) {
    if (!confirm('¿Eliminar este próximo partido?')) return;
    const res = await spFetch(`upcoming?id=eq.${id}`, 'DELETE');
    if (res) {
        toast('Se eliminó el próximo partido', 'success');
        await loadUpcoming();
    }
}

async function convertUpcoming(upcomingId) {
    const upcoming = upcomingData.find(u => u.id === upcomingId);
    if (!upcoming) return;
    
    if (!confirm(`¿Cargar datos del partido vs ${upcoming.rival}? Se quitará de próximos partidos.`)) return;
    
    // Switch to Partidos tab
    switchTab('partidos');
    
    // Open form and pre-fill
    editingMatchId = null;
    document.getElementById('matchFormTitle').textContent = 'Cargar Partido (desde próximo)';
    document.getElementById('matchFormContainer').style.display = 'block';
    clearMatchForm();
    
    // Pre-fill form
    document.getElementById('mFecha').value = formatDateToInput(upcoming.fecha);
    document.getElementById('mRival').value = upcoming.rival || '';
    document.getElementById('mTorneo').value = upcoming.torneo || '';
    document.getElementById('mInstancia').value = upcoming.instancia || '';
    document.getElementById('mLugar').value = upcoming.lugar || '';
    document.getElementById('mHora').value = upcoming.hora || '';
    
    // Delete from upcoming in background
    spFetch(`upcoming?id=eq.${upcomingId}`, 'DELETE').then(() => loadUpcoming());
    
    document.getElementById('matchFormPanel').scrollIntoView({ behavior: 'smooth' });
    toast('Completá el resultado y los datos individuales', 'success');
}

function showUpcomingForm(editId) {
    const idToFind = editId ? parseInt(editId) : null;
    const existing = idToFind ? upcomingData.find(u => u.id === idToFind) : null;
    
    openModal(existing ? 'Editar Próximo Partido' : 'Agregar Próximo Partido', `
        <div class="form-grid">
            <div class="form-group">
                <label>Fecha</label>
                <input type="date" id="uFecha" value="${existing ? formatDateToInput(existing.fecha) : ''}">
            </div>
            <div class="form-group">
                <label>Hora Express (08-11am)</label>
                <div class="time-pills-row" style="margin-bottom:0.5rem">
                    <button type="button" class="time-pill" onclick="setUpcomingTime('08:00')">08:00</button>
                    <button type="button" class="time-pill" onclick="setUpcomingTime('09:00')">09:00</button>
                    <button type="button" class="time-pill" onclick="setUpcomingTime('10:00')">10:00</button>
                    <button type="button" class="time-pill" onclick="setUpcomingTime('11:00')">11:00</button>
                    <button type="button" class="time-pill" onclick="setUpcomingTime('')" style="background:var(--red-dim); border-color:var(--red); color:var(--red); min-width:35px">✕</button>
                </div>
                <input type="time" id="uHora" value="${existing?.hora || ''}" style="max-width:130px">
            </div>
            <div class="form-group">
                <label>Rival</label>
                <input type="text" id="uRival" value="${existing?.rival || ''}" placeholder="Ej: LOS PIBES">
            </div>
            <div class="form-group">
                <label>Torneo</label>
                <select id="uTorneo">
                    <option value="">Seleccionar...</option>
                    ${['Pretemporada','Apertura','Intermedio','Clausura','Copa de Oro','Copa de Plata','Copa de Bronce','Copa de Campeones','Copa del Rey','SuperCopa','Copa de Verano','Amistosos']
                        .map(t => `<option value="${t}" ${existing?.torneo === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Instancia</label>
                <input type="text" id="uInstancia" value="${existing?.instancia || ''}" placeholder="Ej: Fecha 1">
            </div>
            <div class="form-group">
                <label>Lugar</label>
                <select id="uLugar">
                    <option value="">Seleccionar...</option>
                    ${['PRO','POLI','CENTENARIO','ALCO BENDAS','RINCONADA']
                        .map(l => `<option value="${l}" ${existing?.lugar === l ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" style="width:auto" onclick="saveUpcoming('${editId || ''}')">
                <i class="ph-bold ph-floppy-disk"></i> Guardar
            </button>
        </div>
    `);
}

async function saveUpcoming(editId) {
    const data = {
        fecha: document.getElementById('uFecha').value, // Use raw ISO (YYYY-MM-DD) for database consistency
        hora: document.getElementById('uHora').value,
        rival: document.getElementById('uRival').value.trim().toUpperCase(),
        torneo: document.getElementById('uTorneo').value,
        instancia: document.getElementById('uInstancia').value,
        lugar: document.getElementById('uLugar').value
    };
    
    if (!data.rival) { toast('Ingresá el rival', 'error'); return; }
    
    let res;
    if (editId) {
        res = await spFetch(`upcoming?id=eq.${editId}`, 'PATCH', data);
    } else {
        res = await spFetch('upcoming', 'POST', data);
    }
    
    if (res) {
        toast(editId ? 'Partido actualizado' : 'Partido agregado', 'success');
        const capturedEditId = editId; // Capture before potential reset
        closeModal();
        await loadUpcoming();
        
        setTimeout(() => {
            if (confirm('¿Querés avisar de este partido próximo en el grupo de WhatsApp?')) {
                const isNew = !capturedEditId;
                const verb = isNew ? '¡Atención banda, hay fecha confirmada!' : 'Atención: Hubo un cambio en los detalles del próximo partido.';
                const d = data.fecha ? data.fecha.split('-').reverse().join('/') : 'A confirmar';
                const h = data.hora ? data.hora + ' HS' : 'A confirmar';
                const l = data.lugar ? data.lugar : 'A confirmar';
                const text = `*La Bufarra - Próxima Fecha*\n${verb}\n\n*Rival:* ${data.rival}\n*Fecha:* ${d}\n*Hora:* ${h}\n*Sede:* ${l}\n\nPoné en labufarra.com si vas ⚽`;
                window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text), '_blank');
            }
        }, 500);
    }
}

function editUpcoming(id) {
    showUpcomingForm(id);
}

async function deleteUpcoming(id) {
    if (!confirm('¿Eliminar este próximo partido?')) return;
    const res = await spFetch(`upcoming?id=eq.${id}`, 'DELETE');
    toast('Eliminado', 'success');
    await loadUpcoming();
}

// ─── FINANCES ───
async function loadFinances() {
    const data = await spFetch('config?key=eq.finances', 'GET', null, 'value');
    if (data && data[0]) {
        financesData = data[0].value;
    } else {
        // Init financesData with defaults if missing
        financesData = { cuotas:{}, costoFecha:0, multas:[], transacciones:[], deadlines:[], cuotaObjetivo:2970 };
    }
    renderFinances();
}

function renderFinances() {
    renderBalance();
    renderCuotas();
    renderMultas();
    renderTransacciones();
    renderDeadlines();
    
    document.getElementById('costoFechaInput').value = financesData.costoFecha || 0;
}

function renderBalance() {
    const transacciones = financesData.transacciones || [];
    let ingresos = 0, egresos = 0;
    
    transacciones.forEach(t => {
        const monto = parseFloat(t.monto) || 0;
        if (t.tipo === 'ingreso') ingresos += monto;
        else egresos += monto;
    });
    
    // Add multas as ingresos (fines collected)
    const multas = financesData.multas || [];
    multas.forEach(m => {
        if (m.pagada) ingresos += parseFloat(m.monto) || 0;
    });
    
    const balance = ingresos - egresos;
    
    const balanceEl = document.getElementById('totalBalance');
    balanceEl.textContent = `$${balance.toLocaleString()}`;
    balanceEl.className = 'balance-amount ' + (balance >= 0 ? 'positive' : 'negative');
    
    document.getElementById('totalIngresos').textContent = `$${ingresos.toLocaleString()}`;
    document.getElementById('totalEgresos').textContent = `$${egresos.toLocaleString()}`;
}


// ── Cuotas ──
function renderCuotas() {
    const table = document.getElementById('cuotasTable');
    if (!table) return;
    
    const cuotas = financesData.cuotas || {}; // Map of { player: { paid:0, total:2970, multas:0 } }
    const defaultTotal = financesData.cuotaObjetivo || 2970;
    
    let html = `
        <thead>
            <tr>
                <th>Jugador</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Multas</th>
                <th>Saldo</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    // Use local sorted copy so we don't mutate the global roster keys used in DB
    const sortedRoster = [...roster].sort();
    
    sortedRoster.forEach(name => {
        const c = cuotas[name] || { paid: 0, total: defaultTotal, multas: 0 };
        const saldo = (c.total + (c.multas || 0)) - c.paid;
        const saldoColor = saldo <= 0 ? 'var(--green)' : 'var(--red)';
        
        html += `
            <tr>
                <td><strong>${name}</strong></td>
                <td>$${c.total}</td>
                <td style="color:var(--green)">$${c.paid}</td>
                <td style="color:var(--red)">$${c.multas || 0}</td>
                <td style="color:${saldoColor}; font-weight:bold">$${saldo}</td>
                <td>
                    <div style="display:flex; gap:0.3rem">
                        <button class="btn btn-icon btn-sm" onclick="showPagoForm('${name}')" title="Cargar Pago">
                            <i class="ph-bold ph-hand-coins"></i>
                        </button>
                        <button class="btn btn-icon btn-sm" onclick="toggleMulta('${name}')" title="Multa ($50)">
                            <i class="ph-bold ph-warning-circle"></i>
                        </button>
                        <button class="btn btn-icon btn-sm" onclick="showEditCuotaForm('${name}')" title="Modificar">
                            <i class="ph-bold ph-pencil-simple"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody>';
    table.innerHTML = html;
}

function showPagoForm(jugador) {
    const c = (financesData.cuotas && financesData.cuotas[jugador]) || { paid: 0 };
    openModal(`Cargar Pago: ${jugador}`, `
        <div class="form-group">
            <label>Monto a sumar</label>
            <div style="display:flex; gap:0.5rem; margin-bottom:1rem">
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('pagoMonto').value = 495">$495</button>
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('pagoMonto').value = 990">$990</button>
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('pagoMonto').value = 2970">$2970</button>
            </div>
            <input type="number" id="pagoMonto" placeholder="Monto extra" class="glass-panel">
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="savePago('${jugador}')">Registrar Pago</button>
        </div>
    `);
}

async function savePago(jugador) {
    const monto = parseInt(document.getElementById('pagoMonto').value) || 0;
    if (!monto) return;
    
    if (!financesData.cuotas) financesData.cuotas = {};
    if (!financesData.cuotas[jugador]) financesData.cuotas[jugador] = { paid: 0, total: financesData.cuotaObjetivo || 2970, multas: 0 };
    
    financesData.cuotas[jugador].paid += monto;
    
    // Also record a transaction for the general balance
    if (!financesData.transacciones) financesData.transacciones = [];
    financesData.transacciones.push({
        id: 't' + Date.now(),
        tipo: 'ingreso',
        monto: monto,
        categoria: 'Cuotas cobradas',
        fecha: formatDateForUI(new Date().toISOString().split('T')[0]),
        descripcion: `Pago cuota: ${jugador}`
    });
    
    await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
    toast('Pago registrado', 'success');
    closeModal();
    renderFinances();
}

async function toggleMulta(jugador) {
    if (!financesData.cuotas) financesData.cuotas = {};
    if (!financesData.cuotas[jugador]) financesData.cuotas[jugador] = { paid: 0, total: financesData.cuotaObjetivo || 2970, multas: 0 };
    
    financesData.cuotas[jugador].multas = (financesData.cuotas[jugador].multas || 0) + 50;
    
    // Also record in the Multas list for reference
    if (!financesData.multas) financesData.multas = [];
    financesData.multas.push({
        id: 'm' + Date.now(),
        jugador: jugador,
        monto: 50,
        motivo: 'Atraso en cuota',
        fecha: formatDateForUI(new Date().toISOString().split('T')[0]),
        pagada: false
    });
    
    await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
    toast(`Multa de $50 aplicada a ${jugador}`, 'warning');
    renderFinances();
}

function showEditCuotaForm(jugador) {
    const c = (financesData.cuotas && financesData.cuotas[jugador]) || { paid: 0, total: financesData.cuotaObjetivo || 2970, multas: 0 };
    openModal(`Editar Cuota: ${jugador}`, `
        <div class="form-grid" style="grid-template-columns:1fr 1fr">
            <div class="form-group">
                <label>Total a pagar</label>
                <input type="number" id="ecTotal" value="${c.total}">
            </div>
            <div class="form-group">
                <label>Monto Pagado</label>
                <input type="number" id="ecPaid" value="${c.paid}">
            </div>
            <div class="form-group" style="grid-column:1/-1">
                <label>Multas acumuladas ($)</label>
                <input type="number" id="ecMultas" value="${c.multas || 0}">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveEditCuota('${jugador}')">Guardar Cambios</button>
        </div>
    `);
}

async function saveEditCuota(jugador) {
    const total = parseInt(document.getElementById('ecTotal').value) || 0;
    const paid = parseInt(document.getElementById('ecPaid').value) || 0;
    const multas = parseInt(document.getElementById('ecMultas').value) || 0;
    
    if (!financesData.cuotas) financesData.cuotas = {};
    financesData.cuotas[jugador] = { paid, total, multas };
    
    await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
    toast('Cuota actualizada', 'success');
    closeModal();
    renderFinances();
}
async function saveCostoFecha() {
    const costo = parseInt(document.getElementById('costoFechaInput').value) || 0;
    financesData.costoFecha = costo;
    await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
    toast('Costo actualizado', 'success');
}

// ── Multas ──
function renderMultas() {
    const container = document.getElementById('multasList');
    const multas = financesData.multas || [];
    
    if (multas.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay multas registradas</p></div>';
        return;
    }
    
    container.innerHTML = multas.map(m => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="desc">${m.jugador} — ${m.motivo || 'Sin motivo'}</div>
                <div class="cat">${m.fecha || ''} · ${m.pagada ? '✅ Pagada' : '⏳ Pendiente'}</div>
            </div>
            <div class="transaction-amount egreso">$${(m.monto || 0).toLocaleString()}</div>
            <div class="match-actions">
                <button class="btn btn-icon btn-danger btn-sm" onclick="deleteMulta('${m.id}')">
                    <i class="ph-bold ph-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ==========================================
// 12. GESTIÓN TABLA DE POSICIONES (LIGA)
// ==========================================
async function loadLeagueTableAdmin() {
    try {
        const res = await spFetch('config?key=eq.league_table&select=value', 'GET');
        if (res && res.length > 0 && res[0].value) {
            adminLeagueTeams = res[0].value;
        } else {
            try {
                const legacy = await fetch('data/league_table.json?v=' + Date.now());
                if (legacy.ok) adminLeagueTeams = await legacy.json();
            } catch(e) {}
        }
        
        if (!adminLeagueTeams || adminLeagueTeams.length === 0) {
            // Default 12 teams
            adminLeagueTeams = [
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
        renderLeagueTableAdmin();
    } catch(e) {
        console.error("Error cargando tabla de liga", e);
    }
}

function renderLeagueTableAdmin() {
    const container = document.getElementById('leagueTableAdminContainer');
    if (!container) return;
    
    // NO HACEMOS SORT AUTOMATICO, dejamos el orden que el usuario elija manual
    let html = `
        <div style="background:var(--surface); border-radius:12px; overflow:hidden; border:1px solid var(--border-light);">
            <table style="width:100%; text-align:left; border-collapse:collapse;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.05); border-bottom:1px solid var(--border-light);">
                        <th style="padding:10px; width:40px; text-align:center;">#</th>
                        <th style="padding:10px; width:60px; text-align:center;">Orden</th>
                        <th style="padding:10px;">Equipo</th>
                        <th style="padding:10px; width:90px; text-align:center;">
                            PJ 
                            <button class="btn btn-secondary btn-sm" style="padding:2px 4px; font-size:0.6rem;" onclick="bulkAddPJ()">+1</button>
                        </th>
                        <th style="padding:10px; width:120px; text-align:center;">Pts</th>
                        <th style="padding:10px; width:50px; text-align:center;"></th>
                    </tr>
                </thead>
                <tbody id="leagueTbody">
    `;
    
    adminLeagueTeams.forEach((t, index) => {
        const isBuf = t.highlighted;
        html += `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05); background:${isBuf ? 'rgba(255,107,129,0.1)' : 'transparent'};">
                <td style="padding:10px; text-align:center; font-weight:bold; color:var(--text-muted);">${index + 1}</td>
                <td style="padding:10px; text-align:center;">
                    <button class="btn btn-icon btn-secondary" style="width:24px; height:24px; padding:0;" onclick="moveLeagueTeam(${index}, -1)" ${index === 0 ? 'disabled' : ''}><i class="ph-bold ph-caret-up" style="font-size:0.8rem;"></i></button>
                    <button class="btn btn-icon btn-secondary" style="width:24px; height:24px; padding:0;" onclick="moveLeagueTeam(${index}, 1)" ${index === adminLeagueTeams.length - 1 ? 'disabled' : ''}><i class="ph-bold ph-caret-down" style="font-size:0.8rem;"></i></button>
                </td>
                <td style="padding:10px;">
                    <input type="text" class="l-name" data-index="${index}" value="${t.name}" style="background:transparent; border:none; color:${isBuf ? 'var(--accent-primary)' : '#fff'}; font-weight:${isBuf ? '900' : 'normal'}; width:100%;">
                </td>
                <td style="padding:10px; text-align:center;">
                    <input type="number" class="l-pj" data-index="${index}" value="${t.pj || 0}" style="width:35px; text-align:center; background:rgba(0,0,0,0.2); border:1px solid var(--border-light); color:#fff; border-radius:4px;">
                </td>
                <td style="padding:10px; text-align:center;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                        <input type="number" class="l-pts" data-index="${index}" value="${t.pts || 0}" style="width:35px; text-align:center; background:rgba(0,0,0,0.2); border:1px solid var(--border-light); color:#fff; border-radius:4px; font-weight:bold;">
                        <button class="btn btn-secondary btn-sm" style="padding:2px 4px; font-size:0.6rem; background:#ffd700; color:#000;" onclick="adjustLeagueValue(${index}, 'pts', 1)">+1</button>
                        <button class="btn btn-secondary btn-sm" style="padding:2px 4px; font-size:0.6rem; background:#25D366; color:#000;" onclick="adjustLeagueValue(${index}, 'pts', 3)">+3</button>
                    </div>
                </td>
                <td style="padding:10px; text-align:center;">
                    <button class="btn btn-icon btn-danger" style="padding:5px;" onclick="removeLeagueTeam(${index})">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

window.adjustLeagueValue = function(index, field, delta) {
    updateAdminLeagueDataFromDOM(); // Save current state from inputs
    if (adminLeagueTeams[index]) {
        adminLeagueTeams[index][field] = (parseInt(adminLeagueTeams[index][field]) || 0) + delta;
        if (adminLeagueTeams[index][field] < 0) adminLeagueTeams[index][field] = 0;
        renderLeagueTableAdmin();
    }
};

window.bulkAddPJ = function() {
    updateAdminLeagueDataFromDOM();
    adminLeagueTeams.forEach(t => t.pj = (parseInt(t.pj) || 0) + 1);
    renderLeagueTableAdmin();
};

function updateAdminLeagueDataFromDOM() {
    const names = document.querySelectorAll('.l-name');
    const pjs = document.querySelectorAll('.l-pj');
    const dgs = document.querySelectorAll('.l-dg');
    const pts = document.querySelectorAll('.l-pts');
    
    names.forEach((el, i) => {
        adminLeagueTeams[i].name = el.value;
        adminLeagueTeams[i].pj = parseInt(pjs[i].value) || 0;
        adminLeagueTeams[i].pts = parseInt(pts[i].value) || 0;
    });
}
window.moveLeagueTeam = function(index, direction) {
    updateAdminLeagueDataFromDOM();
    const newIdx = index + direction;
    if (newIdx >= 0 && newIdx < adminLeagueTeams.length) {
        const temp = adminLeagueTeams[index];
        adminLeagueTeams[index] = adminLeagueTeams[newIdx];
        adminLeagueTeams[newIdx] = temp;
        renderLeagueTableAdmin();
    }
};

window.addLeagueTeam = function() {
    updateAdminLeagueDataFromDOM();
    adminLeagueTeams.push({ pos: adminLeagueTeams.length + 1, name: "Nuevo Equipo", pj: 0, pts: 0, highlighted: false });
    renderLeagueTableAdmin();
};

window.removeLeagueTeam = function(index) {
    if(!confirm("¿Borrar equipo de la liga?")) return;
    updateAdminLeagueDataFromDOM();
    adminLeagueTeams.splice(index, 1);
    renderLeagueTableAdmin();
};

window.toggleLeagueBufarra = function(index) {
    updateAdminLeagueDataFromDOM();
    adminLeagueTeams.forEach(t => t.highlighted = false);
    adminLeagueTeams[index].highlighted = true;
    renderLeagueTableAdmin();
};


window.saveLeagueTable = async function() {
    updateAdminLeagueDataFromDOM();
    
    // Calcular tendencias comparando con la última posición guardada
    adminLeagueTeams.forEach((t, i) => {
        const currentPos = i + 1;
        const oldPos = t.lastPos || currentPos;
        
        t.trend = 'stable';
        if (currentPos < oldPos) t.trend = 'up';
        else if (currentPos > oldPos) t.trend = 'down';
        
        t.lastPos = currentPos; // Guardar para la próxima comparación
    });

    const res = await spFetch('config?key=eq.league_table', 'PATCH', { value: adminLeagueTeams });
    if (res !== null) {
        toast('Tabla de la Liga guardada y en vivo ✓', 'success');
        renderLeagueTableAdmin();
    }
};

function showMultaForm() {
    openModal('Agregar Multa', `
        <div class="form-grid" style="grid-template-columns:1fr 1fr">
            <div class="form-group">
                <label>Jugador</label>
                <select id="fmJugador">
                    <option value="">Seleccionar...</option>
                    ${roster.map(r => `<option>${r}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Monto</label>
                <input type="number" id="fmMonto" min="0" placeholder="0">
            </div>
            <div class="form-group" style="grid-column:1/-1">
                <label>Motivo</label>
                <input type="text" id="fmMotivo" placeholder="Ej: Atraso al partido">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" style="width:auto" onclick="saveMulta()">
                <i class="ph-bold ph-floppy-disk"></i> Guardar
            </button>
        </div>
    `);
}

async function saveMulta() {
    const data = {
        id: 'm' + Date.now(),
        jugador: document.getElementById('fmJugador').value,
        monto: parseInt(document.getElementById('fmMonto').value) || 0,
        motivo: document.getElementById('fmMotivo').value,
        fecha: formatDateForUI(new Date().toISOString().split('T')[0]),
        pagada: false
    };
    
    if (!data.jugador) { toast('Seleccioná un jugador', 'error'); return; }
    
    if (!financesData.multas) financesData.multas = [];
    financesData.multas.push(data);
    await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
    toast('Multa agregada', 'success');
    closeModal();
    renderFinances();
}

async function deleteMulta(id) {
    if (!confirm('¿Eliminar esta multa?')) return;
    financesData.multas = financesData.multas.filter(m => m.id !== id);
    await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
    toast('Multa eliminada', 'success');
    renderFinances();
}

// ── Transacciones ──
function setTxFilter(f) {
    currentTxFilter = f;
    document.querySelectorAll('#txFilterBar .filter-pill').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderTransacciones();
}

function renderTransacciones() {
    const container = document.getElementById('transaccionesList');
    let transacciones = financesData.transacciones || [];
    
    if (currentTxFilter !== 'all') {
        transacciones = transacciones.filter(t => t.tipo === currentTxFilter);
    }
    
    if (transacciones.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay transacciones</p></div>';
        return;
    }
    
    // Función ultra-robusta de parseo de fechas (Soporta DD/MM/YYYY, ISO, etc)
    const parseDate = (d) => {
        if (!d || d === 'null' || d === 'undefined') return 0;
        let finalDate;
        if (typeof d === 'string' && d.includes('/')) {
            const parts = d.split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                const fullYear = year.length === 2 ? '20' + year : year;
                finalDate = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
            }
        }
        if (!finalDate) finalDate = new Date(d);
        return finalDate.getTime() || 0;
    };

    // Clonar y ordenar
    let toRender = [...transacciones];
    toRender.sort((a, b) => {
        const valA = parseDate(a.fecha);
        const valB = parseDate(b.fecha);
        return financeOrderAsc ? valA - valB : valB - valA;
    });

    container.innerHTML = toRender.map(t => {
        const isIngreso = t.tipo?.toLowerCase() === 'ingreso';
        return `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="desc">${t.detalle || t.descripcion || 'Sin descripción'} ${t.jugador ? '· ' + t.jugador : ''}</div>
                <div class="cat">${t.categoria || ''} · ${t.fecha || ''}</div>
            </div>
            <div class="transaction-amount ${isIngreso ? 'ingreso' : 'egreso'}">
                ${isIngreso ? '+' : '-'}$${(parseFloat(t.monto) || 0).toLocaleString()}
            </div>
            <div class="action-group" style="display:flex; gap:0.4rem;">
                <button class="btn btn-icon btn-danger btn-sm" id="del-btn-${t.id}" onclick="confirmDeleteRow(event, '${t.id}', 'transaccion')">
                    <i class="ph-bold ph-trash"></i>
                </button>
                <button class="btn btn-danger btn-sm" id="conf-btn-${t.id}" style="display:none; font-size:0.7rem; padding:0.2rem 0.5rem;" onclick="executeDeleteRow(event, '${t.id}', 'transaccion')">
                    ¿BORRAR?
                </button>
            </div>
        </div>
    `}).join('');
}

function showTransaccionForm() {
    openModal('Registrar Gasto / Ingreso', `
        <div class="form-grid" style="grid-template-columns:1fr 1fr">
            <div class="form-group">
                <label>Tipo</label>
                <select id="ftTipo">
                    <option value="egreso">Gasto / Egreso</option>
                    <option value="ingreso">Ingreso</option>
                </select>
            </div>
            <div class="form-group">
                <label>Monto</label>
                <input type="number" id="ftMonto" min="0" placeholder="0">
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="ftCategoria">
                    <option value="">Seleccionar...</option>
                    <option>Cancha</option>
                    <option>Árbitro</option>
                    <option>Camisetas</option>
                    <option>Cuotas cobradas</option>
                    <option>Multas cobradas</option>
                    <option>Premios</option>
                    <option>Inscripción torneo</option>
                    <option>Otros</option>
                </select>
            </div>
            <div class="form-group">
                <label>Fecha</label>
                <input type="date" id="ftFecha" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group" style="grid-column:1/-1">
                <label>Descripción</label>
                <input type="text" id="ftDescripcion" placeholder="Detalle del movimiento">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" style="width:auto" onclick="saveTransaccion()">
                <i class="ph-bold ph-floppy-disk"></i> Guardar
            </button>
        </div>
    `);
}

async function saveTransaccion() {
    const data = {
        id: 't' + Date.now(),
        tipo: document.getElementById('ftTipo').value,
        monto: parseInt(document.getElementById('ftMonto').value) || 0,
        categoria: document.getElementById('ftCategoria').value,
        fecha: formatDateForUI(document.getElementById('ftFecha').value),
        descripcion: document.getElementById('ftDescripcion').value
    };
    if (!data.monto) { toast('Ingresá un monto', 'error'); return; }
    
    if (!financesData.transacciones) financesData.transacciones = [];
    financesData.transacciones.push(data);
    await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
    toast('Transacción registrada', 'success');
    closeModal();
    renderFinances();
}

async function deleteTransaccion(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    financesData.transacciones = financesData.transacciones.filter(t => t.id !== id);
    await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
    renderFinances();
}

// ── Deadlines ──
function renderDeadlines() {
    const container = document.getElementById('deadlinesList');
    const deadlines = financesData.deadlines || [];
    
    if (deadlines.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay deadlines pendientes</p></div>';
        return;
    }
    
    const today = new Date();
    
    container.innerHTML = deadlines.map(d => {
        let dotColor = 'green';
        let urgentClass = '';
        
        if (d.fechaLimite) {
            const parts = d.fechaLimite.split('/');
            if (parts.length === 3) {
                const dlDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                const daysLeft = Math.ceil((dlDate - today) / (1000 * 60 * 60 * 24));
                if (daysLeft < 0) { dotColor = 'red'; urgentClass = 'urgent'; }
                else if (daysLeft <= 3) { dotColor = 'yellow'; urgentClass = 'urgent'; }
            }
        }
        
        return `
            <div class="deadline-item ${urgentClass}">
                <div class="deadline-dot ${dotColor}"></div>
                <div style="flex:1">
                    <div style="font-weight:600;font-size:0.85rem">${d.concepto || ''}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted)">
                        ${d.fechaLimite || ''} · $${(d.monto || 0).toLocaleString()}
                    </div>
                </div>
                <button class="btn btn-icon btn-danger btn-sm" onclick="deleteDeadline('${d.id}')">
                    <i class="ph-bold ph-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

function showDeadlineForm() {
    openModal('Agregar Deadline', `
        <div class="form-grid" style="grid-template-columns:1fr 1fr">
            <div class="form-group" style="grid-column:1/-1">
                <label>Concepto</label>
                <input type="text" id="fdConcepto" placeholder="Ej: Pago inscripción torneo">
            </div>
            <div class="form-group">
                <label>Fecha Límite</label>
                <input type="date" id="fdFecha">
            </div>
            <div class="form-group">
                <label>Monto</label>
                <input type="number" id="fdMonto" min="0" placeholder="0">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" style="width:auto" onclick="saveDeadline()">
                <i class="ph-bold ph-floppy-disk"></i> Guardar
            </button>
        </div>
    `);
}

async function saveDeadline() {
    const data = {
        id: 'd' + Date.now(),
        concepto: document.getElementById('fdConcepto').value,
        fechaLimite: formatDateForUI(document.getElementById('fdFecha').value),
        monto: parseInt(document.getElementById('fdMonto').value) || 0
    };
    if (!data.concepto) { toast('Ingresá un concepto', 'error'); return; }
    
    if (!financesData.deadlines) financesData.deadlines = [];
    financesData.deadlines.push(data);
    await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
    toast('Deadline agregado', 'success');
    closeModal();
    renderFinances();
}

async function deleteDeadline(id) {
    if (!confirm('¿Eliminar este deadline?')) return;
    financesData.deadlines = financesData.deadlines.filter(d => d.id !== id);
    await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
    toast('Deadline eliminado', 'success');
    renderFinances();
}

// ─── MODAL ───
function openModal(title, bodyHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('open');
}

function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('modalOverlay').classList.remove('open');
}

async function loadManualStats() {
    const data = await spFetch('config?key=eq.manual_stats', 'GET', null, 'value');
    if (data && data[0]) {
        manualStatsData = data[0].value || {};
    }
}

// ─── PLAYER EDITING (GLOBAL RENAME) ───
function openEditPlayerModal(oldName) {
    // Tomar los datos actuales que se ven en la tabla (del año seleccionado)
    const currentYearData = (playersData[currentPlayerYear] || {})[oldName] || {};
    const m = manualStatsData[oldName] || {};
    
    openModal('Editar Jugador', `
        <div class="panel-section-title">Nombre y Identidad</div>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 1.5rem;">
            <div class="form-group">
                <label>Nombre Actual</label>
                <input type="text" value="${oldName}" disabled style="opacity:0.6">
            </div>
            <div class="form-group">
                <label>Nuevo Nombre (Apellido)</label>
                <input type="text" id="newPlayerNameInput" value="${oldName}" placeholder="Ej: Perez">
            </div>
        </div>

        <div class="panel-section-title">Estadísticas de "${currentPlayerYear}"</div>
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">
            Se pre-llenan con lo que el sistema muestra actualmente para este jugador.
        </p>
        <div class="form-grid" style="grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div class="form-group"><label>PJ</label><input type="number" id="ms_pj" value="${currentYearData.pj || 0}"></div>
            <div class="form-group"><label>PG</label><input type="number" id="ms_pg" value="${currentYearData.pg || 0}"></div>
            <div class="form-group"><label>PE</label><input type="number" id="ms_pe" value="${currentYearData.pe || 0}"></div>
            <div class="form-group"><label>PP</label><input type="number" id="ms_pp" value="${currentYearData.pp || 0}"></div>
            <div class="form-group"><label>Goles</label><input type="number" id="ms_goles" value="${currentYearData.goles || 0}"></div>
            <div class="form-group"><label>Asist.</label><input type="number" id="ms_asistencias" value="${currentYearData.asistencias || 0}"></div>
            <div class="form-group"><label>Amar.</label><input type="number" id="ms_amarillas" value="${currentYearData.amarillas || 0}"></div>
            <div class="form-group"><label>Rojas</label><input type="number" id="ms_rojas" value="${currentYearData.rojas || 0}"></div>
            <div class="form-group"><label>MVP</label><input type="number" id="ms_mvp" value="${currentYearData.mvp || 0}"></div>
        </div>

        <div class="form-actions" style="margin-top: 2rem;">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" style="width:auto" onclick="confirmPlayerRename('${oldName}')">
                <i class="ph-bold ph-check"></i> Guardar Cambios
            </button>
        </div>
    `);
}

async function confirmPlayerRename(oldName) {
    const newName = document.getElementById('newPlayerNameInput').value.trim();
    if (!newName) { toast('El nombre no puede estar vacío', 'error'); return; }

    const newManual = {
        pj: parseInt(document.getElementById('ms_pj').value) || 0,
        pg: parseInt(document.getElementById('ms_pg').value) || 0,
        pe: parseInt(document.getElementById('ms_pe').value) || 0,
        pp: parseInt(document.getElementById('ms_pp').value) || 0,
        goles: parseInt(document.getElementById('ms_goles').value) || 0,
        asistencias: parseInt(document.getElementById('ms_asistencias').value) || 0,
        amarillas: parseInt(document.getElementById('ms_amarillas').value) || 0,
        rojas: parseInt(document.getElementById('ms_rojas').value) || 0,
        mvp: parseInt(document.getElementById('ms_mvp').value) || 0
    };

    if (newName === oldName && JSON.stringify(newManual) === JSON.stringify(manualStatsData[oldName] || {})) {
        closeModal();
        return;
    }

    if (!confirm(`¿Confirmar cambios para ${oldName}?\n\n- Nombre: ${newName}\n- Estadísticas manuales actualizadas`)) return;

    toast('Guardando cambios...', 'success');
    
    try {
        // 1. Update Roster & Stats mapping
        if (newName !== oldName) {
            const newRoster = roster.map(r => r === oldName ? newName : r).sort();
            await spFetch('config?key=eq.roster', 'PATCH', { value: newRoster });
            roster = newRoster;
        }
        
        // Guardar las nuevas estadísticas para el año seleccionado
        const statRow = { 
            year: currentPlayerYear, 
            player_name: newName, 
            ...newManual 
        };
        
        // Upsert manual (resolution=merge-duplicates handle cases if needed)
        await fetch(`${SUPABASE_URL}/rest/v1/players_stats`, {
            method: 'POST',
            headers: { ...SP_HEADERS, "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify(statRow)
        });

        // 2. Update Matches JSON (only if name changed)
        if (newName !== oldName) {
            // Remove old stat row if name changed
            await spFetch(`players_stats?player_name=eq.${oldName}&year=eq.${currentPlayerYear}`, 'DELETE');

            const matchesToUpdate = matchesData.filter(m => m.jugadores && m.jugadores[oldName]);
            for (const m of matchesToUpdate) {
                const updatedJugadores = { ...m.jugadores };
                updatedJugadores[newName] = updatedJugadores[oldName];
                delete updatedJugadores[oldName];
                await spFetch(`matches?id=eq.${m.id}`, 'PATCH', { jugadores: updatedJugadores });
            }

            // 3. Update Finances
            if (financesData.cuotas && financesData.cuotas[oldName]) {
                financesData.cuotas[newName] = financesData.cuotas[oldName];
                delete financesData.cuotas[oldName];
            }
            if (financesData.multas) {
                financesData.multas.forEach(multa => {
                    if (multa.jugador === oldName) multa.jugador = newName;
                });
            }
            await spFetch('config?key=eq.finances', 'PATCH', { value: financesData });
        }

        toast('¡Datos actualizados con éxito!', 'success');
        closeModal();
        
        // 4. Reload (no recalculate needed, we just saved the final stats)
        await loadRoster();
        await loadMatches();
        await loadPlayers();
        renderFinances();
        
    } catch (error) {
        console.error("Error during rename:", error);
        toast('Error al actualizar datos', 'error');
    }
}

// ─── TOAST ───
function toast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="ph-bold ${type === 'success' ? 'ph-check-circle' : 'ph-warning'}"></i> ${message}`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

function setUpcomingTime(val) {
    const input = document.getElementById("uHora");
    if (input) {
        input.value = val;
        toast("Horario: " + (val || "Limpiado"), "success");
    }
}

async function loadNotifications() {
    const list = document.getElementById('notificationsList');
    if (!list) return;
    
    try {
        const data = await spFetch('notifications?order=created_at.desc&limit=15', 'GET');
        if (!data || data.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>No hay mensajes enviados.</p></div>';
            return;
        }

        list.innerHTML = data.map(n => `
            <div class="panel" style="margin-bottom:0.8rem; background:rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
                <div style="flex:1">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem">
                        <strong style="color:var(--blue)">${n.title}</strong>
                        <span style="font-size:0.75rem; color:var(--text-dim)">${new Date(n.created_at || n.date).toLocaleDateString()}</span>
                    </div>
                    <p style="font-size:0.85rem; margin:0">${n.body}</p>
                </div>
                <div class="action-group" style="display:flex; gap:0.4rem;">
                    <button class="btn btn-icon btn-danger btn-sm" id="del-notif-${n.id}" onclick="confirmDeleteRow(event, '${n.id}', 'notification')">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" id="conf-notif-${n.id}" style="display:none; font-size:0.7rem; padding:0.2rem 0.5rem;" onclick="executeDeleteRow(event, '${n.id}', 'notification')">
                        ¿BORRAR?
                    </button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = '<p style="color:var(--red); padding:1rem;">Error al cargar historial.</p>';
    }
}

async function broadcastPush() {
    const title = document.getElementById('pushTitle').value.trim();
    const body = document.getElementById('pushBody').value.trim();

    if (!body) {
        toast('Completá al menos el mensaje', 'error');
        return;
    }

    let fullText = "";
    if (title) fullText += `*${title}*\n\n`;
    fullText += body;

    const encodedText = encodeURIComponent(fullText);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    toast('Abriendo WhatsApp...', 'success');
}

window.setPushTemplate = function(type) {
    const titleInput = document.getElementById('pushTitle');
    const bodyInput = document.getElementById('pushBody');
    const tip = document.getElementById('waPollTip');
    if (tip) tip.style.display = 'block';
    
    if (type === 'horario') {
        titleInput.value = '🕒 HORARIO CONFIRMADO';
        bodyInput.value = '¡Banda! Ya tenemos el detalle de la próxima fecha:\n\n📅 Fecha: \n⏰ Hora: \n📍 Sede: \n\nConfirmar asistencia en la web.';
    } else if (type === 'cuota') {
        titleInput.value = '💰 RECORDATORIO DE PAGO';
        bodyInput.value = '¡Hola todos! Les recordamos que estamos en fecha de pago mensual de la cuota. \n\n💵 Monto: $ \n🏦 Alias/Transferencia: \n\nCualquier duda avisen.';
    } else if (type === 'convocatoria') {
        titleInput.value = '📋 CONVOCATORIA';
        bodyInput.value = '¡Buenas! Sale la lista para el próximo partido. Confirmen disponibilidad en la web hoy mismo para organizar el equipo.';
    }
};

function setTime(val) {
    const input = document.getElementById('mHora');
    if (input) {
        input.value = val;
        toast("Hora: " + val, "success");
    }
}

function toggleFinancesList(e) {
    if (e) e.stopPropagation();
    const wrapper = document.getElementById("financesListWrapper");
    const btn = document.getElementById("toggleFinancesBtn");
    if (!wrapper) return;
    const isHidden = (wrapper.style.display === "none");
    wrapper.style.display = isHidden ? "block" : "none";
    if (btn) btn.innerHTML = isHidden ? '<i class="ph-bold ph-caret-up"></i>' : '<i class="ph-bold ph-caret-down"></i>';
}

// --- Sistema de Borrado con Confirmación UI ---
window.confirmDeleteRow = function(e, id, type) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const prefix = type === 'transaccion' ? 'del-btn-' : 'del-notif-';
    const confPrefix = type === 'transaccion' ? 'conf-btn-' : 'conf-notif-';
    
    document.getElementById(prefix + id).style.display = 'none';
    document.getElementById(confPrefix + id).style.display = 'inline-block';
    
    // Auto-reset después de 3 segundos si no confirma
    setTimeout(() => {
        const delBtn = document.getElementById(prefix + id);
        const confBtn = document.getElementById(confPrefix + id);
        if (delBtn && confBtn) {
            delBtn.style.display = 'inline-block';
            confBtn.style.display = 'none';
        }
    }, 3000);
};

window.executeDeleteRow = function(e, id, type) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (type === 'transaccion') {
        deleteTransaccion(id);
    } else {
        deleteNotification(id);
    }
};

async function deleteNotification(id) {
    const res = await spFetch(`notifications?id=eq.${id}`, 'DELETE');
    if (res !== null) {
        toast('Mensaje eliminado', 'success');
        loadNotifications();
    }
}

let financeOrderAsc = false;
function toggleFinanceOrder(e) {
    if (e) e.stopPropagation();
    financeOrderAsc = !financeOrderAsc;
    const btn = document.getElementById('sortFinanceBtn');
    if (btn) {
        btn.innerHTML = financeOrderAsc ? '<i class="ph-bold ph-sort-descending"></i>' : '<i class="ph-bold ph-sort-ascending"></i>';
    }
    // IMPORTANTE: Llamamos a renderFinances() global, no a una versión local
    renderFinances();
}

function toggleNotificationsList() {
    const wrapper = document.getElementById("notificationsList");
    const btn = document.getElementById("toggleNotificationsBtn");
    if (!wrapper) return;
    const isHidden = (wrapper.style.display === "none");
    wrapper.style.display = isHidden ? "block" : "none";
    if (btn) btn.innerHTML = isHidden ? '<i class="ph-bold ph-caret-up"></i>' : '<i class="ph-bold ph-caret-down"></i>';
}

function fillFromLastMatch() {
    if (!matchesData || matchesData.length === 0) { toast('No hay partidos previos', 'error'); return; }
    const last = matchesData[0]; // matchesData already sorted by date.desc
    
    document.getElementById('mTorneo').value = last.torneo || '';
    document.getElementById('mLugar').value = last.lugar || '';
    document.getElementById('mRival').value = last.rival || '';
    
    // Fill players
    if (last.jugadores) {
        // First clear all
        document.querySelectorAll('.pJugo').forEach(cb => {
            cb.checked = false;
            togglePlayerRow(cb.dataset.idx);
        });
        
        for (const [name, data] of Object.entries(last.jugadores)) {
            const idx = roster.indexOf(name);
            if (idx >= 0) {
                const cb = document.querySelector(`.pJugo[data-idx="${idx}"]`);
                if (cb) {
                    cb.checked = true;
                    togglePlayerRow(idx);
                }
            }
        }
    }
    toast('Datos del último partido cargados', 'success');
}
