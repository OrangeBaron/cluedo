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

// Matrice dei costi reali (Turni stimati) ottimizzata con Floyd-Warshall
let TRAVEL_COSTS = {};

// Probabilità cumulativa (CDF) di ottenere almeno X con 2d6
const DICE_PROBS = [0, 0, 1.0, 0.97, 0.91, 0.83, 0.72, 0.58, 0.41, 0.27, 0.16, 0.08, 0.02];

function getReachability(dist) {
    if (dist <= 0) return 1.0; 
    if (dist > 12) return 0.0; 
    return DICE_PROBS[dist];
}

// Calcola il costo base (in turni) di uno spostamento diretto
function calculateDirectCost(dist) {
    if (dist === 0) return 1.0; // Passaggio segreto = 1 turno
    
    // Se raggiungibile con i dadi (<=12), costo = 1 turno + rischio fallimento
    if (dist <= 12) {
        const p = getReachability(dist);
        return 1.0 + (1.0 - p);
    }
    
    // Se irraggiungibile con un tiro solo, media matematica
    return Math.ceil(dist / 7);
}

function initPathfinding() {
    // 1. Inizializzazione con costi diretti
    rooms.forEach(r1 => {
        TRAVEL_COSTS[r1] = {};
        rooms.forEach(r2 => {
            if (r1 === r2) {
                TRAVEL_COSTS[r1][r2] = 0;
            } else {
                const dist = ROOM_DISTANCES[r1][r2];
                TRAVEL_COSTS[r1][r2] = calculateDirectCost(dist);
            }
        });
    });

    // 2. Ottimizzazione Floyd-Warshall (Trova le scorciatoie)
    // Controlla se passare per una stanza intermedia 'k' è più veloce che andare diretti
    rooms.forEach(k => {
        rooms.forEach(i => {
            rooms.forEach(j => {
                // Costo passando per k (i->k + k->j)
                const detourCost = TRAVEL_COSTS[i][k] + TRAVEL_COSTS[k][j]; 
                
                if (detourCost < TRAVEL_COSTS[i][j]) {
                    TRAVEL_COSTS[i][j] = detourCost;
                }
            });
        });
    });
}

// ==========================================
// 2. MOTORE ENTROPICO & LOGICA
// ==========================================

function shannonEntropy(p) {
    if (p <= 0 || p >= 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

function getConstraintImpact(card) {
    let score = 0;
    if (typeof constraints === 'undefined' || !constraints) return 0;
    constraints.forEach(con => {
        if (con.cards.includes(card)) score += (10.0 / con.cards.length);
    });
    return score;
}

function getSmartSelection(list, allProbs) {
    const confirmedSolution = list.find(c => grid[c].SOL === 2);
    const trueUnknowns = list.filter(c => grid[c].SOL === 0 && grid[c][myName] !== 2);
    const shields = list.filter(c => grid[c][myName] === 2);

    if (trueUnknowns.length > 0) {
        trueUnknowns.sort((a, b) => {
            const pA = allProbs.solution[a] || 0;
            const pB = allProbs.solution[b] || 0;
            const scoreA = pA + shannonEntropy(pA) + getConstraintImpact(a);
            const scoreB = pB + shannonEntropy(pB) + getConstraintImpact(b);
            return scoreB - scoreA;
        });
        const best = trueUnknowns[0];
        if (getConstraintImpact(best) > 2.0) return { card: best, type: "🔓 Breaker", desc: "Risolve vincolo." };
        return { card: best, type: "🔬 Scientist", desc: "Info max." };
    }

    if (confirmedSolution) {
        if (shields.length > 0) return { card: shields[Math.floor(Math.random()*shields.length)], type: "🛡️ Bluff Segreto", desc: "Nascondi soluzione." };
        return { card: confirmedSolution, type: "🔨 Hammer", desc: "Attacco finale." };
    }

    if (shields.length > 0) return { card: shields[0], type: "🛡️ Shield", desc: "Fallback." };
    const valid = list.filter(c => grid[c].SOL !== 1);
    if(valid.length > 0) return { card: valid[Math.floor(Math.random() * valid.length)], type: "❓ Random", desc: "Fallback." };
    return { card: list[0], type: "💀 Panic", desc: "Nessuna opzione." };
}

function generateHypothesisForRoom(room, allProbs) {
    const bestS = getSmartSelection(suspects, allProbs);
    const bestW = getSmartSelection(weapons, allProbs);
    
    let stratName = bestS.type;
    if (bestS.type.includes("Breaker") || bestW.type.includes("Breaker")) stratName = "🔓 Logic Breaker";
    else if (bestS.type.includes("Bluff") || bestW.type.includes("Bluff")) stratName = "🎭 Deception";
    else if (bestS.type.includes("Hammer") && bestW.type.includes("Hammer")) stratName = "👑 Checkmate";
    else if (bestS.type.includes("Scientist") && bestW.type.includes("Scientist")) stratName = "🔬 Indagine";

    return {
        suspect: bestS.card, weapon: bestW.card,
        text: `<b>${bestS.card}</b> + <b>${bestW.card}</b>`,
        type: stratName,
        probS: allProbs.solution[bestS.card] || 0,
        probW: allProbs.solution[bestW.card] || 0
    };
}

function calculateTacticalMoves(currentLoc) {
    if (!currentLoc || !ROOM_DISTANCES[currentLoc]) return [];
    
    // Assicuriamoci che i path siano calcolati
    if (Object.keys(TRAVEL_COSTS).length === 0) initPathfinding();

    const allProbs = typeof getProbabilities === 'function' ? getProbabilities() : { solution: {} };
    const solProbs = allProbs.solution;
    
    const sSol = suspects.find(c => grid[c].SOL === 2);
    const wSol = weapons.find(c => grid[c].SOL === 2);
    const rSol = rooms.find(c => grid[c].SOL === 2);
    const isReadyToWin = sSol && wSol && rSol;

    let moves = rooms.map(room => {
        const pRoom = solProbs[room] || 0;
        const isMyRoom = grid[room][myName] === 2;
        const isKnownNo = grid[room].SOL === 1; 
        const isCurrent = room === currentLoc;
        
        // Dati fisici diretti (per la UI)
        const directDist = isCurrent ? 0 : ROOM_DISTANCES[currentLoc][room];
        const isSecret = !isCurrent && directDist === 0;
        const reachability = getReachability(directDist);

        // COSTO REALE (Floyd-Warshall)
        const turnsEst = isCurrent ? 0 : TRAVEL_COSTS[currentLoc][room];

        // --- SCORE ---
        let utility = 0;

        if (isReadyToWin) {
            if (room === rSol) utility = 10000; 
            else utility = -1000;
            utility -= turnsEst * 100; // Penalità distanza reale
        } else {
            // Valore Stanza
            utility += pRoom * 800;
            if (!isKnownNo && !isMyRoom) utility += shannonEntropy(pRoom) * 300;

            // Valore Ipotesi
            const hypo = generateHypothesisForRoom(room, allProbs);
            if (hypo.type.includes("Breaker")) utility += 400;
            if (hypo.type.includes("Scientist") || hypo.type.includes("Indagine")) utility += 150;
            if (hypo.type.includes("Checkmate")) utility += 500;

            // Malus stanze inutili
            if ((isMyRoom || isKnownNo) && !isCurrent) utility -= 150;

            // Penalità Movimento basata sul PERCORSO MIGLIORE
            if (isCurrent) {
                if (pRoom < 0.05 && (isMyRoom || isKnownNo)) utility -= 250; 
                else utility += 50; 
            } else {
                utility -= turnsEst * 180; 
            }
        }
        
        const hypo = generateHypothesisForRoom(room, allProbs);
        let reasons = [];
        
        if (isReadyToWin && room === rSol) reasons.push("🏆 VITTORIA");
        else {
            if (pRoom > 0.8) reasons.push("🔥 Hotspot");
            else if (isKnownNo) reasons.push("❌ Scartata");
            else reasons.push("❓ Incerta");
        }
        
        // Info Movimento UI
        let moveLabel = "";
        if (isCurrent) moveLabel = "📍 QUI";
        else if (isSecret) { reasons.push("🚇 Segreto"); moveLabel = "🚇 PASSAGGIO"; }
        else if (directDist <= 12) {
             // Se è raggiungibile direttamente, mostriamo % dadi
             // Ma se il percorso migliore è diverso (es. via passaggio), lo segnaliamo?
             // Per semplicità UI: se turnsEst < directTurns, è una scorciatoia
             const directCost = calculateDirectCost(directDist);
             if (turnsEst < directCost - 0.2) {
                 reasons.push("⚡️ Scorciatoia");
                 moveLabel = `Via Passaggio (~${Math.round(turnsEst)}t)`;
             } else {
                 moveLabel = `🎲 ${Math.round(reachability*100)}%`;
             }
        } else {
            // Lontano
             const directCost = calculateDirectCost(directDist);
             if (turnsEst < directCost - 0.2) {
                 reasons.push("⚡️ Scorciatoia");
             }
             moveLabel = `⏱️ ~${Math.round(turnsEst*10)/10} turni`;
        }

        return {
            room, score: utility, pRoom: Math.round(pRoom * 100),
            dist: directDist, turnsEst, isSecret, isCurrent, 
            reasons, hypothesis: hypo, reachability, moveLabel
        };
    });

    return moves.sort((a, b) => b.score - a.score);
}

function updateTacticalSuggestions() {
    const currentLoc = document.getElementById('current-position').value;
    const container = document.getElementById('tactical-suggestions');
    if (!currentLoc) { container.innerHTML = '<div class="suggestions-placeholder">📍 Seleziona posizione...</div>'; return; }

    const chk = document.getElementById('can-stay-check');
    const canStay = chk ? chk.checked : true; 

    let rankedMoves = calculateTacticalMoves(currentLoc);
    if (!canStay) rankedMoves = rankedMoves.filter(m => m.room !== currentLoc);

    const top3 = rankedMoves.slice(0, 3);
    let html = top3.length === 0 ? "<div class='suggestions-placeholder'>Nessuna mossa utile.</div>" : "";

    top3.forEach((s, idx) => {
        let barColor = s.pRoom > 60 ? "var(--success)" : (s.pRoom > 20 ? "var(--accent)" : "var(--text-muted)");
        let rankClass = idx === 0 ? 'is-top' : 'is-standard';
        if (s.reasons.includes("🏆 VITTORIA")) { rankClass = "is-top"; barColor = "#FFD700"; }

        html += `
        <div class="suggestion-item ${rankClass}" style="border-left: 4px solid ${barColor}">
            <div class="suggestion-header">
                <div>
                    <div class="suggestion-room-name">${s.room} <span style="font-size:0.8em; color:${barColor}; margin-left:5px;">${s.pRoom}% Sol.</span></div>
                    <div class="suggestion-reasons">${s.reasons.join(' • ')}</div>
                </div>
                <div class="suggestion-score-box"><div class="suggestion-turn-info">${s.moveLabel}</div></div>
            </div>
            <div class="suggestion-insight">
                <span class="insight-icon">💡</span>
                <div class="insight-content">
                    <div class="insight-text">Chiedi: ${s.hypothesis.text}</div>
                    <span class="insight-type">${s.hypothesis.type}</span>
                </div>
            </div>
            <div style="width:100%; height:4px; background:#333; margin-top:6px; border-radius:2px; overflow:hidden;"><div style="width:${s.pRoom}%; height:100%; background:${barColor};"></div></div>
        </div>`;
    });
    container.innerHTML = html;
}
