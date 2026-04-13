/* ═══════════════════════════════════════
   Admin Panel JS — La Bufarra
   ═══════════════════════════════════════ */

const API = '';  // Same origin
let authToken = sessionStorage.getItem('bufarra_token') || '';
let currentUser = sessionStorage.getItem('bufarra_user') || '';
let roster = [];
let matchesData = [];
let playersData = {};
let upcomingData = [];
let financesData = {};
let editingMatchId = null;

// ─── INIT ───
document.addEventListener('DOMContentLoaded', async () => {
    // Check if already logged in
    if (authToken) {
        const res = await apiFetch('/api/check-auth');
        if (res && res.authenticated) {
            showApp();
            return;
        }
        authToken = '';
        currentUser = '';
        sessionStorage.removeItem('bufarra_token');
        sessionStorage.removeItem('bufarra_user');
    }
    document.getElementById('loginScreen').style.display = 'flex';
    
    // Enter key on password
    document.getElementById('passwordInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
    });
    document.getElementById('usernameInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('passwordInput').focus();
    });
    document.getElementById('usernameInput').focus();
});

// ─── API Helper ───
async function apiFetch(url, opts = {}) {
    const isStaticHost = window.location.hostname.includes('netlify') || 
                        (window.location.hostname.includes('.') && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1'));
    
    if (isStaticHost && url.includes('/api/login')) {
        console.warn('Admin Panel: Detected static host. Functions requiring server.py will not work here.');
        toast('El panel de admin solo funciona localmente con el Servidor Python', 'warning');
    }

    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
    
    try {
        const res = await fetch(API + url, { ...opts, headers });
        
        // If we get an HTML response instead of JSON (common on static hosts for missing routes)
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            throw new Error('API return HTML instead of JSON (possibly static host 404)');
        }

        const data = await res.json();
        if (res.status === 401) {
            toast('Sesión expirada', 'error');
            doLogout();
            return null;
        }
        return data;
    } catch (e) {
        console.error('API Error:', e);
        if (isStaticHost) {
            toast('En Netlify el Admin es "Solo Lectura". Usá el servidor local para cargar datos.', 'error');
        } else {
            toast('Error de conexión con el Servidor', 'error');
        }
        return null;
    }
}

// ─── AUTH ───
async function doLogin() {
    const user = document.getElementById('usernameInput').value.trim();
    const pw = document.getElementById('passwordInput').value;
    if (!user || !pw) return;
    
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph-bold ph-spinner"></i> Verificando...';
    
    const res = await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username: user, password: pw })
    });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-lock-key"></i> Ingresar';
    
    if (res && res.token) {
        authToken = res.token;
        currentUser = res.user || user;
        sessionStorage.setItem('bufarra_token', authToken);
        sessionStorage.setItem('bufarra_user', currentUser);
        showApp();
    } else {
        document.getElementById('loginError').style.display = 'block';
        if (res && res.error) {
            console.warn('Login failure:', res.error);
        }
        document.getElementById('passwordInput').value = '';
        document.getElementById('usernameInput').focus();
    }
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

function doLogout() {
    authToken = '';
    currentUser = '';
    sessionStorage.removeItem('bufarra_token');
    sessionStorage.removeItem('bufarra_user');
    document.getElementById('adminApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('passwordInput').value = '';
    document.getElementById('usernameInput').value = '';
    document.getElementById('loginError').style.display = 'none';
}

async function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminApp').style.display = 'block';
    document.getElementById('userGreeting').textContent = `Hola, ${currentUser}`;
    
    // Load all data
    await Promise.all([
        loadRoster(),
        loadMatches(),
        loadPlayers(),
        loadUpcoming(),
        loadFinances()
    ]);
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
    
    const res = await apiFetch('/api/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPw, new_password: newPw })
    });
    
    if (res && res.message) {
        toast('Contraseña actualizada ✓', 'success');
        closeModal();
    } else {
        toast(res?.error || 'Error al cambiar', 'error');
    }
}

// ─── TAB MANAGEMENT ───
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ─── ROSTER ───
async function loadRoster() {
    const data = await apiFetch('/api/config/roster');
    if (data) roster = data;
    buildPlayersFormTable();
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
    const data = await apiFetch('/api/matches');
    if (data) matchesData = data;
    renderMatchesList();
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
    document.querySelectorAll('#matchYearFilters .filter-pill').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderFilteredMatches(year);
}

function renderFilteredMatches(year) {
    const container = document.getElementById('matchesList');
    const filtered = year === 'all' ? matchesData : matchesData.filter(m => m.año === year);
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="ph-bold ph-soccer-ball"></i><p>No hay partidos cargados</p></div>';
        return;
    }
    
    container.innerHTML = filtered.map(m => {
        const resClass = m.resultado === 'V' ? 'win' : m.resultado === 'E' ? 'draw' : 'loss';
        const resLetter = m.resultado === 'V' ? 'V' : m.resultado === 'E' ? 'E' : 'D';
        const torneo = m.instancia ? `${m.torneo} - ${m.instancia}` : m.torneo;
        return `
            <div class="match-item" onclick="editMatch('${m.id}')">
                <div class="match-info">
                    <div class="date">${m.fecha} · ${m.lugar || ''}</div>
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
    const isVisible = container.style.display !== 'none';
    container.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        editingMatchId = null;
        document.getElementById('matchFormTitle').textContent = 'Agregar Partido';
        clearMatchForm();
    }
}

function cancelMatchForm() {
    document.getElementById('matchFormContainer').style.display = 'none';
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

function formatDateToInput(csvDate) {
    // Convert D/M/YYYY to YYYY-MM-DD
    if (!csvDate) return '';
    const parts = csvDate.split('/');
    if (parts.length !== 3) return csvDate;
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
}

async function saveMatch() {
    const rival = document.getElementById('mRival').value.trim();
    if (!rival) {
        toast('Ingresá el nombre del rival', 'error');
        return;
    }
    
    const matchData = {
        año: document.getElementById('mAño').value,
        fecha: formatDateToCSV(document.getElementById('mFecha').value),
        torneo: document.getElementById('mTorneo').value,
        instancia: document.getElementById('mInstancia').value,
        rival: rival.toUpperCase(),
        gf: parseInt(document.getElementById('mGF').value) || 0,
        gc: parseInt(document.getElementById('mGC').value) || 0,
        lugar: document.getElementById('mLugar').value,
        jugadores: []
    };
    
    // Collect player data
    roster.forEach((name, idx) => {
        const jugo = document.querySelector(`.pJugo[data-idx="${idx}"]`).checked;
        if (jugo) {
            const playerEntry = {
                nombre: name,
                jugo: true,
                goles: parseInt(document.querySelector(`.pGoles[data-idx="${idx}"]`).value) || 0,
                asistencias: parseInt(document.querySelector(`.pAsist[data-idx="${idx}"]`).value) || 0,
                amarillas: parseInt(document.querySelector(`.pAmar[data-idx="${idx}"]`).value) || 0,
                rojas: parseInt(document.querySelector(`.pRoja[data-idx="${idx}"]`).value) || 0,
                mvp: document.querySelector(`.pMVP[data-idx="${idx}"]`).checked
            };
            matchData.jugadores.push(playerEntry);
        }
    });
    
    let res;
    if (editingMatchId) {
        res = await apiFetch(`/api/matches/${editingMatchId}`, {
            method: 'PUT',
            body: JSON.stringify(matchData)
        });
    } else {
        res = await apiFetch('/api/matches', {
            method: 'POST',
            body: JSON.stringify(matchData)
        });
    }
    
    if (res && !res.error) {
        toast(editingMatchId ? 'Partido actualizado' : 'Partido cargado', 'success');
        cancelMatchForm();
        await loadMatches();
        await loadPlayers();
    } else {
        toast('Error al guardar', 'error');
    }
}

function editMatch(matchId) {
    const match = matchesData.find(m => m.id === matchId);
    if (!match) return;
    
    editingMatchId = matchId;
    document.getElementById('matchFormTitle').textContent = 'Editar Partido';
    document.getElementById('matchFormContainer').style.display = 'block';
    
    document.getElementById('mAño').value = match.año || '';
    document.getElementById('mFecha').value = formatDateToInput(match.fecha);
    document.getElementById('mTorneo').value = match.torneo || '';
    document.getElementById('mInstancia').value = match.instancia || '';
    document.getElementById('mRival').value = match.rival || '';
    document.getElementById('mGF').value = match.gf || 0;
    document.getElementById('mGC').value = match.gc || 0;
    document.getElementById('mLugar').value = match.lugar || '';
    
    // Reset all players first
    document.querySelectorAll('.pJugo').forEach(cb => {
        cb.checked = false;
        togglePlayerRow(parseInt(cb.dataset.idx));
    });
    
    // Fill in player data
    if (match.jugadores && match.jugadores.length > 0) {
        match.jugadores.forEach(jug => {
            const rosterIdx = roster.findIndex(r => r.toLowerCase() === jug.nombre.toLowerCase());
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
        });
    }
    
    // Scroll to form
    document.getElementById('matchFormPanel').scrollIntoView({ behavior: 'smooth' });
}

async function deleteMatch(matchId) {
    const match = matchesData.find(m => m.id === matchId);
    if (!confirm(`¿Eliminar partido vs ${match?.rival}? Esta acción no se puede deshacer.`)) return;
    
    const res = await apiFetch(`/api/matches/${matchId}`, { method: 'DELETE' });
    if (res && !res.error) {
        toast('Partido eliminado', 'success');
        await loadMatches();
        await loadPlayers();
    }
}

// ─── PLAYERS ───
async function loadPlayers() {
    const data = await apiFetch('/api/players');
    if (data) playersData = data;
    renderPlayersStats();
}

function renderPlayersStats() {
    const container = document.getElementById('playersStatsGrid');
    const filtersContainer = document.getElementById('playerYearFilters');
    
    const years = Object.keys(playersData).filter(k => k !== 'ALL').sort().reverse();
    filtersContainer.innerHTML = `<button class="filter-pill active" onclick="filterPlayers('ALL')">Histórico</button>` +
        years.map(y => `<button class="filter-pill" onclick="filterPlayers('${y}')">${y}</button>`).join('');
    
    renderFilteredPlayers('ALL');
}

function filterPlayers(year) {
    document.querySelectorAll('#playerYearFilters .filter-pill').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderFilteredPlayers(year);
}

function renderFilteredPlayers(year) {
    const container = document.getElementById('playersStatsGrid');
    const playersObj = playersData[year] || {};
    const players = Object.values(playersObj);
    
    if (players.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="ph-bold ph-users"></i><p>No hay datos de jugadores</p></div>';
        return;
    }
    
    // Sort by PJ descending
    const sorted = players.sort((a, b) => (b.pj || b.PJ || 0) - (a.pj || a.PJ || 0));
    
    container.innerHTML = sorted.map(p => {
        const nombre = p.nombre || p.PLAYER || '';
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
                <div class="name">${nombre}</div>
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
    const data = await apiFetch('/api/upcoming');
    if (data) upcomingData = data;
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
                isPast = matchDate < today;
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

// Convert upcoming match to a real match (pre-fill form)
async function convertUpcoming(upcomingId) {
    const upcoming = upcomingData.find(u => u.id === upcomingId);
    if (!upcoming) return;
    
    if (!confirm(`¿Cargar datos del partido vs ${upcoming.rival}? Se quitará de próximos partidos.`)) return;
    
    const res = await apiFetch(`/api/upcoming/convert/${upcomingId}`, { method: 'POST' });
    if (res && res.converted) {
        // Switch to Partidos tab
        switchTab('partidos');
        
        // Open form and pre-fill with upcoming data
        const data = res.converted;
        editingMatchId = null;
        document.getElementById('matchFormTitle').textContent = 'Cargar Partido (desde próximo)';
        document.getElementById('matchFormContainer').style.display = 'block';
        clearMatchForm();
        
        // Pre-fill from upcoming data
        if (data.fecha) {
            document.getElementById('mFecha').value = formatDateToInput(data.fecha);
            // Extract year
            const parts = data.fecha.split('/');
            if (parts.length === 3) {
                const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                document.getElementById('mAño').value = year;
            }
        }
        if (data.rival) document.getElementById('mRival').value = data.rival;
        if (data.torneo) document.getElementById('mTorneo').value = data.torneo;
        if (data.instancia) document.getElementById('mInstancia').value = data.instancia;
        if (data.lugar) document.getElementById('mLugar').value = data.lugar;
        
        // Scroll to form
        document.getElementById('matchFormPanel').scrollIntoView({ behavior: 'smooth' });
        toast('Completá el resultado y los datos individuales', 'success');
        
        // Reload upcoming
        await loadUpcoming();
    }
}

function showUpcomingForm(editId) {
    const existing = editId ? upcomingData.find(u => u.id === editId) : null;
    
    openModal(existing ? 'Editar Próximo Partido' : 'Agregar Próximo Partido', `
        <div class="form-grid">
            <div class="form-group">
                <label>Fecha</label>
                <input type="date" id="uFecha" value="${existing ? formatDateToInput(existing.fecha) : ''}">
            </div>
            <div class="form-group">
                <label>Hora</label>
                <input type="time" id="uHora" value="${existing?.hora || ''}">
            </div>
            <div class="form-group">
                <label>Rival</label>
                <input type="text" id="uRival" value="${existing?.rival || ''}" placeholder="Nombre del rival">
            </div>
            <div class="form-group">
                <label>Torneo</label>
                <select id="uTorneo">
                    <option value="">Seleccionar...</option>
                    ${['Pretemporada','Apertura','Intermedio','Clausura','Copa de Oro','Copa de Plata','Copa de Bronce','Copa de Campeones','Copa del Rey','SuperCopa','Copa de Verano','Amistosos']
                        .map(t => `<option ${existing?.torneo === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Instancia</label>
                <input type="text" id="uInstancia" value="${existing?.instancia || ''}" placeholder="Ej: FECHA 3">
            </div>
            <div class="form-group">
                <label>Lugar</label>
                <select id="uLugar">
                    <option value="">Seleccionar...</option>
                    ${['PRO','POLI','CENTENARIO','ALCO BENDAS','RINCONADA']
                        .map(l => `<option ${existing?.lugar === l ? 'selected' : ''}>${l}</option>`).join('')}
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
        fecha: formatDateToCSV(document.getElementById('uFecha').value),
        hora: document.getElementById('uHora').value,
        rival: document.getElementById('uRival').value.trim().toUpperCase(),
        torneo: document.getElementById('uTorneo').value,
        instancia: document.getElementById('uInstancia').value,
        lugar: document.getElementById('uLugar').value
    };
    
    if (!data.rival) { toast('Ingresá el rival', 'error'); return; }
    
    let res;
    if (editId) {
        res = await apiFetch(`/api/upcoming/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
        res = await apiFetch('/api/upcoming', { method: 'POST', body: JSON.stringify(data) });
    }
    
    if (res && !res.error) {
        toast(editId ? 'Partido actualizado' : 'Partido agregado', 'success');
        closeModal();
        await loadUpcoming();
    }
}

function editUpcoming(id) {
    showUpcomingForm(id);
}

async function deleteUpcoming(id) {
    if (!confirm('¿Eliminar este próximo partido?')) return;
    const res = await apiFetch(`/api/upcoming/${id}`, { method: 'DELETE' });
    if (res && !res.error) {
        toast('Eliminado', 'success');
        await loadUpcoming();
    }
}

// ─── FINANCES ───
async function loadFinances() {
    const data = await apiFetch('/api/finances');
    if (data) financesData = data;
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
    const cuotas = financesData.cuotas || {};
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const currentYear = new Date().getFullYear();
    
    // Generate month keys for current year
    const monthKeys = months.map((m, i) => `${currentYear}-${String(i+1).padStart(2,'0')}`);
    
    let html = '<thead><tr><th>Jugador</th>';
    months.forEach(m => html += `<th>${m}</th>`);
    html += '</tr></thead><tbody>';
    
    roster.forEach(name => {
        html += `<tr><td>${name}</td>`;
        monthKeys.forEach(mk => {
            const paid = cuotas[name]?.[mk] || false;
            html += `<td>
                <button class="cuota-check ${paid ? 'paid' : 'unpaid'}" 
                        onclick="toggleCuota('${name}', '${mk}', ${!paid})">
                    ${paid ? '✓' : '✕'}
                </button>
            </td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody>';
    table.innerHTML = html;
}

async function toggleCuota(jugador, mes, pagado) {
    await apiFetch('/api/finances/cuota', {
        method: 'POST',
        body: JSON.stringify({ jugador, mes, pagado })
    });
    
    // Update local state
    if (!financesData.cuotas) financesData.cuotas = {};
    if (!financesData.cuotas[jugador]) financesData.cuotas[jugador] = {};
    financesData.cuotas[jugador][mes] = pagado;
    
    renderCuotas();
}

async function saveCostoFecha() {
    const costo = parseInt(document.getElementById('costoFechaInput').value) || 0;
    await apiFetch('/api/finances/costo-fecha', {
        method: 'POST',
        body: JSON.stringify({ costoFecha: costo })
    });
    financesData.costoFecha = costo;
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
        jugador: document.getElementById('fmJugador').value,
        monto: parseInt(document.getElementById('fmMonto').value) || 0,
        motivo: document.getElementById('fmMotivo').value,
        fecha: new Date().toLocaleDateString('es-UY'),
        pagada: false
    };
    if (!data.jugador) { toast('Seleccioná un jugador', 'error'); return; }
    
    const res = await apiFetch('/api/finances/multa', { method: 'POST', body: JSON.stringify(data) });
    if (res && !res.error) {
        toast('Multa registrada', 'success');
        closeModal();
        await loadFinances();
    }
}

async function deleteMulta(id) {
    if (!confirm('¿Eliminar esta multa?')) return;
    await apiFetch(`/api/finances/multa/${id}`, { method: 'DELETE' });
    await loadFinances();
}

// ── Transacciones ──
function renderTransacciones() {
    const container = document.getElementById('transaccionesList');
    const transacciones = financesData.transacciones || [];
    
    if (transacciones.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay transacciones</p></div>';
        return;
    }
    
    container.innerHTML = transacciones.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="desc">${t.descripcion || 'Sin descripción'}</div>
                <div class="cat">${t.categoria || ''} · ${t.fecha || ''}</div>
            </div>
            <div class="transaction-amount ${t.tipo === 'ingreso' ? 'ingreso' : 'egreso'}">
                ${t.tipo === 'ingreso' ? '+' : '-'}$${(parseFloat(t.monto) || 0).toLocaleString()}
            </div>
            <button class="btn btn-icon btn-danger btn-sm" onclick="deleteTransaccion('${t.id}')">
                <i class="ph-bold ph-trash"></i>
            </button>
        </div>
    `).join('');
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
        tipo: document.getElementById('ftTipo').value,
        monto: document.getElementById('ftMonto').value,
        categoria: document.getElementById('ftCategoria').value,
        fecha: formatDateToCSV(document.getElementById('ftFecha').value),
        descripcion: document.getElementById('ftDescripcion').value
    };
    if (!data.monto || data.monto === '0') { toast('Ingresá un monto', 'error'); return; }
    
    const res = await apiFetch('/api/finances/transaccion', { method: 'POST', body: JSON.stringify(data) });
    if (res && !res.error) {
        toast('Transacción registrada', 'success');
        closeModal();
        await loadFinances();
    }
}

async function deleteTransaccion(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    await apiFetch(`/api/finances/transaccion/${id}`, { method: 'DELETE' });
    await loadFinances();
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
        concepto: document.getElementById('fdConcepto').value,
        fechaLimite: formatDateToCSV(document.getElementById('fdFecha').value),
        monto: parseInt(document.getElementById('fdMonto').value) || 0
    };
    if (!data.concepto) { toast('Ingresá un concepto', 'error'); return; }
    
    const res = await apiFetch('/api/finances/deadline', { method: 'POST', body: JSON.stringify(data) });
    if (res && !res.error) {
        toast('Deadline agregado', 'success');
        closeModal();
        await loadFinances();
    }
}

async function deleteDeadline(id) {
    if (!confirm('¿Eliminar este deadline?')) return;
    await apiFetch(`/api/finances/deadline/${id}`, { method: 'DELETE' });
    await loadFinances();
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

// ─── TOAST ───
function toast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="ph-bold ${type === 'success' ? 'ph-check-circle' : 'ph-warning'}"></i> ${message}`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}
