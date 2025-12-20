// ==========================================
// 1. DATI STATICI & FISICA (Distanze & Dadi)
// ==========================================

const ROOM_DISTANCES = {
    "Cucina":{"Ballo":7,"Serra":20,"Biliardo":17,"Biblioteca":23,"Studio":0,"Ingresso":18,"Veranda":19,"Pranzo":11},
    "Ballo":{"Cucina":7,"Serra":4,"Biliardo":6,"Biblioteca":12,"Studio":17,"Ingresso":13,"Veranda":15,"Pranzo":7},
    "Serra":{"Cucina":20,"Ballo":4,"Biliardo":7,"Biblioteca":14,"Studio":20,"Ingresso":20,"Veranda":0,"Pranzo":19},
    "Biliardo":{"Cucina":17,"Ballo":6,"Serra":7,"Biblioteca":4,"Studio":15,"Ingresso":15,"Veranda":22,"Pranzo":14},
    "Biblioteca":{"Cucina":23,"Ballo":12,"Serra":14,"Biliardo":4,"Studio":7,"Ingresso":7,"Veranda":14,"Pranzo":14},
    "Studio":{"Cucina":0,"Ballo":17,"Serra":20,"Biliardo":15,"Biblioteca":7,"Ingresso":4,"Veranda":17,"Pranzo":17},
    "Ingresso":{"Cucina":18,"Ballo":13,"Serra":20,"Biliardo":15,"Biblioteca":7,"Studio":4,"Veranda":8,"Pranzo":8},
    "Veranda":{"Cucina":19,"Ballo":15,"Serra":0,"Biliardo":22,"Biblioteca":14,"Studio":17,"Ingresso":8,"Pranzo":4},
    "Pranzo":{"Cucina":11,"Ballo":7,"Serra":19,"Biliardo":14,"Biblioteca":14,"Studio":17,"Ingresso":8,"Veranda":4}
};

let TURN_MATRIX = {};

// Probabilità cumulativa (CDF) di ottenere almeno X con 2d6
// Indice 0-1 non usati, 2=100%, ..., 12=2.7%
const DICE_PROBS = [0, 0, 1.0, 0.97, 0.91, 0.83, 0.72, 0.58, 0.41, 0.27, 0.16, 0.08, 0.02];

function getReachability(dist) {
    if (dist <= 0) return 1.0; // Già lì o passaggio segreto
    if (dist > 12) return 0.0; // Impossibile in 1 turno con i dadi
    return DICE_PROBS[dist];
}

function initPathfinding() {
    rooms.forEach(r1 => {
        TURN_MATRIX[r1] = {};
        rooms.forEach(r2 => {
            if (r1 === r2) {
                TURN_MATRIX[r1][r2] = 0;
            } else {
                const dist = ROOM_DISTANCES[r1][r2];
                if (dist === 0) {
                    TURN_MATRIX[r1][r2] = 1; // Passaggio segreto conta come 1 mossa sicura
                } else {
                    // Stima euristica dei turni: media 7 passi a turno
                    TURN_MATRIX[r1][r2] = Math.ceil(dist / 7);
                }
            }
        });
    });
}

// ==========================================
// 2. MOTORE ENTROPICO (Scienza della Deduzione)
// ==========================================

/**
 * Calcola l'entropia binaria di una probabilità p.
 * Massima (1.0) quando p=0.5 (massima incertezza).
 * Minima (0.0) quando p=0 o p=1 (certezza).
 */
function shannonEntropy(p) {
    if (p <= 0 || p >= 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

/**
 * Genera l'ipotesi migliore per una stanza basandosi sull'Information Gain.
 * @param {string} room Stanza corrente
 * @param {Object} probs Cache delle probabilità dal solver
 */
function generateHypothesisForRoom(room, allProbs) {
    const pSol = allProbs.solution[room] || 0; // FIX: Accesso a .solution
    
    const candidatesS = suspects.filter(c => grid[c].SOL !== 1 && grid[c][myName] !== 2);
    const candidatesW = weapons.filter(c => grid[c].SOL !== 1 && grid[c][myName] !== 2);
    const shieldsS = suspects.filter(c => grid[c][myName] === 2 || grid[c].SOL === 2);
    const shieldsW = weapons.filter(c => grid[c][myName] === 2 || grid[c].SOL === 2);

    const getUtility = (card) => {
        const p = allProbs.solution[card] || 0; // FIX
        return p + (shannonEntropy(p) * 0.5); 
    };

    let bestS = candidatesS.sort((a, b) => getUtility(b) - getUtility(a))[0];
    let bestW = candidatesW.sort((a, b) => getUtility(b) - getUtility(a))[0];
    let stratName = "🔬 Scientist";

    if (!bestS) bestS = shieldsS[0] || suspects[0];
    if (!bestW) bestW = shieldsW[0] || weapons[0];

    // Bluff logic (semplificata per brevità, stessa di prima)
    const roomIsSolved = grid[room].SOL === 2;
    if (Math.random() > 0.6 && !roomIsSolved) { 
        if (shieldsS.length > 0 && Math.random() < 0.5) { bestS = shieldsS[0]; stratName = "🛡️ Shield (S)"; }
        else if (shieldsW.length > 0) { bestW = shieldsW[0]; stratName = "🛡️ Shield (W)"; }
    }

    const pS = allProbs.solution[bestS] || 0; // FIX
    const pW = allProbs.solution[bestW] || 0; // FIX
    if (pS > 0.8 && pW > 0.8) stratName = "🎯 Sniper";

    return {
        suspect: bestS, weapon: bestW,
        text: `<b>${bestS}</b> + <b>${bestW}</b>`,
        type: stratName,
        probS: Math.round(pS * 100), probW: Math.round(pW * 100)
    };
}

function calculateTacticalMoves(currentLoc) {
    if (!currentLoc || !ROOM_DISTANCES[currentLoc]) return [];

    // FIX: Prendi tutto l'oggetto probabilità
    const allProbs = typeof getProbabilities === 'function' ? getProbabilities() : { solution: {} };
    const solProbs = allProbs.solution;

    let moves = rooms.map(room => {
        const pRoom = solProbs[room] || 0; // FIX
        const isMyRoom = grid[room][myName] === 2;
        const isKnownNo = grid[room].SOL === 1;
        
        const isCurrent = room === currentLoc;
        const dist = isCurrent ? 0 : ROOM_DISTANCES[currentLoc][room];
        const isSecret = !isCurrent && dist === 0;
        let reachability = isCurrent || isSecret ? 1.0 : getReachability(dist);
        
        let utility = pRoom * 1000; 
        if (!isMyRoom && !isKnownNo) utility += shannonEntropy(pRoom) * 200;

        if (isCurrent) {
            if (pRoom < 0.05 && !isMyRoom) utility -= 500; 
            else utility += 100; 
        } else {
            utility *= reachability;
            if (dist > 12) utility -= 1000;
        }
        
        const hypo = generateHypothesisForRoom(room, allProbs); // Passa tutto oggetto
        
        let reasons = [];
        if (pRoom > 0.8) reasons.push("🔥 Hotspot");
        else if (pRoom < 0.01) reasons.push("❄️ Fredda");
        else reasons.push("❓ Incerta");
        if (isSecret) reasons.push("🚇 Segreto");
        if (dist > 0 && dist <= 12) reasons.push(`🎲 ${Math.round(reachability*100)}%`);

        return {
            room, score: utility, pRoom: Math.round(pRoom * 100),
            dist, isSecret, isCurrent, reasons, hypothesis: hypo, reachability
        };
    });

    return moves.sort((a, b) => b.score - a.score);
}

// UI Rendering rimane uguale, chiamerà calculateTacticalMoves che è stato fixato.
function updateTacticalSuggestions() {
    const currentLoc = document.getElementById('current-position').value;
    const container = document.getElementById('tactical-suggestions');
    if (!currentLoc) { container.innerHTML = '<div class="suggestions-placeholder">📍 Seleziona posizione...</div>'; return; }
    
    const rankedMoves = calculateTacticalMoves(currentLoc);
    const top3 = rankedMoves.slice(0, 3);
    
    let html = "";
    if (top3.length === 0) html = "<div class='suggestions-placeholder'>Nessuna mossa utile.</div>";

    top3.forEach((s, idx) => {
        let barColor = s.pRoom > 60 ? "var(--success)" : (s.pRoom > 20 ? "var(--accent)" : "var(--text-muted)");
        let rankClass = idx === 0 ? 'is-top' : 'is-standard';
        let moveInfo = s.isCurrent ? "QUI" : (s.isSecret ? "🚇 PASSAGGIO" : `🎲 ${Math.round(s.reachability*100)}%`);
        if (s.dist > 12) moveInfo = "🏃 >1 turno";

        html += `
        <div class="suggestion-item ${rankClass}" style="border-left: 4px solid ${barColor}">
            <div class="suggestion-header">
                <div><div class="suggestion-room-name">${s.room} <span style="font-size:0.8em; color:${barColor}; margin-left:5px;">${s.pRoom}% Sol.</span></div>
                <div class="suggestion-reasons">${s.reasons.join(' • ')}</div></div>
                <div class="suggestion-score-box"><div class="suggestion-turn-info">${moveInfo}</div></div>
            </div>
            <div class="suggestion-insight"><span class="insight-icon">💡</span>
                <div class="insight-content"><div class="insight-text">${s.hypothesis.text} <span style="font-size:0.7em; opacity:0.7">(${s.hypothesis.probS}%/${s.hypothesis.probW}%)</span></div>
                <span class="insight-type">${s.hypothesis.type}</span></div>
            </div>
            <div style="width:100%; height:4px; background:#333; margin-top:6px; border-radius:2px; overflow:hidden;"><div style="width:${s.pRoom}%; height:100%; background:${barColor};"></div></div>
        </div>`;
    });
    container.innerHTML = html;
}