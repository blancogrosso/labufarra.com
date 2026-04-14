document.addEventListener('dataLoaded', () => {
    renderCampeonatos();
});

// Triple-check for race conditions
if (window.dataLoaded || (typeof allMatches !== 'undefined' && allMatches.length > 0)) {
    renderCampeonatos();
}

// Custom instances order taking into account the specifics
const INSTANCE_ORDER = {
    'FINAL': 100,
    'SEMI FINAL': 90,
    'CUARTOS DE FINAL': 80,
    'OCTAVOS DE FINAL': 70,
    'FASE DE GRUPOS': 50,
    'FECHA': 10
};

function getInstanceWeight(inst) {
    if(!inst) return 0;
    const upInst = inst.toUpperCase();
    if(upInst.includes('FINAL') && !upInst.includes('SEMI') && !upInst.includes('CUARTOS') && !upInst.includes('OCTAVOS')) return 100;
    if(upInst.includes('SEMI')) return 90;
    if(upInst.includes('CUARTOS')) return 80;
    if(upInst.includes('OCTAVOS')) return 70;
    if(upInst.includes('GRUPOS')) return 50;
    if(upInst.includes('FECHA')) return Number(upInst.replace('FECHA', '').trim()) || 10;
    return 0;
}

// Configuration of Official Tournaments as narrated by the user
const CONSOLIDATED_TOURNAMENTS = [
    // 2021
    {
        year: '2021',
        title: 'Torneo Apertura',
        csvTournaments: ['APERTURA'],
        isMajor: false,
        desc: 'El comienzo. Un torneo que sentó las bases de la mística del club.'
    },
    {
        year: '2021',
        title: 'Torneo Clausura',
        csvTournaments: ['CLAUSURA', 'COPA DE ORO'],
        isMajor: true, // Uno de los 4 grandes
        desc: 'El primer grito de gloria. Campaña histórica coronada con la Copa de Oro.'
    },
    // 2022
    {
        year: '2022',
        title: 'Copa de Campeones',
        csvTournaments: ['COPA DE CAMPEONES'],
        isMajor: false,
        desc: 'Participación en el torneo de campeones.'
    },
    {
        year: '2022',
        title: 'Torneo Apertura',
        csvTournaments: ['APERTURA'],
        isMajor: false,
        desc: 'Gran arranque, peleando arriba hasta las últimas fechas.'
    },
    {
        year: '2022',
        title: 'Torneo Clausura',
        csvTournaments: ['CLAUSURA'],
        isMajor: false,
        desc: 'El desgaste del año pasó factura en las fechas finales.'
    },
    // 2023
    {
        year: '2023',
        title: 'Copa de Verano',
        csvTournaments: ['COPA DE VERANO'],
        isMajor: false,
        desc: 'Reafirmando la jerarquía con resultados contundentes.'
    },
    {
        year: '2023',
        title: 'Torneo Apertura',
        csvTournaments: ['APERTURA'],
        isMajor: true, // Uno de los 4 grandes
        desc: 'Campeonato absoluto dominando de punta a punta.'
    },
    {
        year: '2023',
        title: 'Torneo Intermedio',
        csvTournaments: ['INTERMEDIO'],
        isMajor: false,
        desc: 'Participación clave para el recambio del equipo.'
    },
    {
        year: '2023',
        title: 'Torneo Clausura',
        csvTournaments: ['CLAUSURA'],
        isMajor: false,
        desc: 'Desarrollo competitivo marcando presencia.'
    },
    {
        year: '2023',
        title: 'Copa de Campeones',
        csvTournaments: ['COPA DE CAMPEONES', 'COPA DE BRONCE'],
        isMajor: true, // Uno de los 4 grandes
        desc: 'Consagración en el certamen, logrando una copa memorable.'
    },
    // 2024
    {
        year: '2024',
        title: 'Torneo Apertura',
        csvTournaments: ['APERTURA'],
        isMajor: false,
        desc: 'Inicio prometedor en un año de reconfiguración del equipo.'
    },
    {
        year: '2024',
        title: 'SuperCopa',
        csvTournaments: ['SUPERCOPA'],
        isMajor: false,
        desc: 'Participación en la SuperCopa entre los mejores.'
    },
    {
        year: '2024',
        title: 'Torneo Clausura',
        csvTournaments: ['CLAUSURA', 'COPA DE ORO'], // 2024 Clausura derivó en Copa de Oro
        isMajor: false,
        desc: 'A un paso de la gloria. El equipo demostró estar para grandes cosas perdiendo ajustadamente la final de oro.'
    },
    // 2025
    {
        year: '2025',
        title: 'Torneo Apertura',
        csvTournaments: ['APERTURA'],
        isMajor: false,
        desc: 'Base sólida preparándose para el máximo objetivo del año.'
    },
    {
        year: '2025',
        title: 'Copa del Rey',
        csvTournaments: ['COPA DEL REY'],
        isMajor: false,
        desc: 'Gran torneo llegando hasta las instancias decisivas.'
    },
    {
        year: '2025',
        title: 'Torneo Clausura',
        csvTournaments: ['CLAUSURA'],
        isMajor: true, // Uno de los 4 grandes
        desc: 'El retorno triunfal a la cima, demostrando la vigencia del plantel histórico en los playoffs.'
    }
];

function renderCampeonatos() {
    const container = document.querySelector('.trophy-grid');
    if (!container) return; 
    container.innerHTML = ''; 

    CONSOLIDATED_TOURNAMENTS.forEach(config => {
        // Find all matches for this consolidated tournament
        const torMatches = allMatches.filter(m => {
            if(!m.AÑO || !m.torneo_base) return false;
            // Check if match year matches config year
            if(m.AÑO !== config.year) return false;
            
            // Check if tournament base is in the csvTournaments list (case insensitive)
            const baseUp = m.torneo_base.toUpperCase().trim();
            return config.csvTournaments.some(t => t.toUpperCase() === baseUp);
        });

        // If no matches found for this config in the CSV, we skip it
        if(torMatches.length === 0) return;

        // Find max instance
        let maxW = -1;
        let maxInstanceMatch = torMatches[0];

        // First pass: Just weights
        torMatches.forEach(m => {
            const w = getInstanceWeight(m.INSTANCIA);
            if(w > maxW) {
                maxW = w;
                maxInstanceMatch = m;
            }
        });

        // Resolve position string
        let position = "Participación en Liga";
        let isOverallChampion = false;
        const instUp = (maxInstanceMatch.INSTANCIA || '').toUpperCase();

        if (instUp === 'FINAL') {
            const gf = parseInt(maxInstanceMatch.GF || '0');
            const gc = parseInt(maxInstanceMatch.GC || '0');
            
            if(gf > gc) {
                position = "Campeón";
                isOverallChampion = true;
            } else if (gf < gc) {
                position = "Subcampeón";
            } else {
                position = "Campeón"; // Assuming penalty win based on history
                isOverallChampion = true;
            }
            // Append the actual specific cup/playoff name if it differs from the base title
            const playedTor = maxInstanceMatch.torneo_base.toUpperCase();
            if(playedTor.includes("COPA")) {
                 position += ` (${maxInstanceMatch.torneo_base})`; // e.g. "Campeón (Copa de Oro)"
            }

        } else if (instUp.includes('SEMI')) {
            position = "Semifinales";
        } else if (instUp.includes('CUARTOS')) {
            position = "Cuartos de Final";
        } else if (instUp.includes('OCTAVOS')) {
            position = "Octavos de Final";
        } else if (instUp.includes('GRUPOS')) {
            position = "Fase de Grupos";
        } else if (instUp.includes('FECHA')) {
            position = "Participación en Liga";
        }

        // We override position text for exceptions based on config.isMajor, forcing it to Champion
        if (config.isMajor) {
             position = "🏆 CAMPEÓN ABSOLUTO";
             isOverallChampion = true; // force the champion coloring just in case
        } else if (isOverallChampion) {
            // Keep specific cup pos logic
        }

        // Draw Card
        let iconHtml = '';
        let cardClass = 'trophy-card';
        let styleOverride = '';

        if (config.isMajor) {
            // Un título de los 4 grandes
            iconHtml = `<i class="ph-fill ph-star trophy-icon"></i>`;
            cardClass = 'trophy-card champion-card';
        } else if (isOverallChampion) {
            // Campeón de una copa menor o título secundario (Ej: copa de plata)
            iconHtml = `<i class="ph-fill ph-star trophy-icon"></i>`;
            cardClass = 'trophy-card champion-card';
        } else {
            // Participación normal
            iconHtml = `<i class="ph-bold ph-star trophy-icon" style="color: var(--text-muted); filter: none;"></i>`;
            styleOverride = `style="border-color: var(--border-light); background: var(--bg-card);"`;
        }

        const titleColor = (config.isMajor || isOverallChampion) ? 'white' : 'var(--text-muted)';

        const html = `
            <div class="${cardClass}" ${styleOverride}>
                ${iconHtml}
                <div class="trophy-year">${config.year}</div>
                <div class="trophy-name">${config.title}</div>
                <div style="color: ${titleColor}; font-weight: bold; margin-bottom: 1rem; text-transform: uppercase;">Posición: ${position}</div>
                <p class="trophy-desc" style="margin-bottom: 1.5rem;">${config.desc}</p>
            </div>
        `;
        
        container.innerHTML += html;
    });
}
