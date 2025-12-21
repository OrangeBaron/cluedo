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

const DICE_PROBS = [0, 0, 1.0, 0.97, 0.91, 0.83, 0.72, 0.58, 0.41, 0.27, 0.16, 0.08, 0.02];

function getReachability(dist) {
    if (dist <= 0) return 1.0;
    if (dist > 12) return 0.0;
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
                    TURN_MATRIX[r1][r2] = 1;
                } else {
                    TURN_MATRIX[r1][r2] = Math.ceil(dist / 7);
                }
            }
        });
    });
}

// ==========================================
// 2. MOTORE ENTROPICO
// ==========================================

function shannonEntropy(p) {
    if (p <= 0 || p >= 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

/**
 * Calcola un punteggio bonus se la carta aiuta a risolvere un vincolo attivo.
 * Esempio: Se sappiamo che "Player A ha [Mustard O Corda]", queste carte valgono di più.
 */
function getConstraintImpact(card) {
    let score = 0;
    // 'constraints' è una variabile globale definita in solver.js
    if (typeof constraints === 'undefined' || !constraints) return 0;

    constraints.forEach(con => {
        if (con.cards.includes(card)) {
            // Più il vincolo è ristretto, più la carta è preziosa.
            // Un vincolo su 2 carte (50/50) dà un bonus enorme (5.0).
            // Un vincolo su 6 carte dà un bonus piccolo (1.6).
            score += (10.0 / con.cards.length);
        }
    });
    return score;
}

/**
 * Seleziona la carta migliore per una categoria (Sospettato o Arma).
 * Logica (Integrata con Constraints):
 * 1. Priorità assoluta alle carte che risolvono vincoli (Constraints Breaker).
 * 2. Alta priorità a carte ignote ad alta entropia (Indagine).
 * 3. Uso intelligente di carte proprie (Bluff) per nascondere la soluzione se nota.
 * 4. Hammer (Checkmate) sulla soluzione se necessario.
 */
function getSmartSelection(list, allProbs) {
    // Identificazione stato carte
    const confirmedSolution = list.find(c => grid[c].SOL === 2);
    // True Unknowns: Carte che non so chi ha (SOL=0) e che NON ho io.
    const trueUnknowns = list.filter(c => grid[c].SOL === 0 && grid[c][myName] !== 2);
    // Shields: Carte che ho io
    const shields = list.filter(c => grid[c][myName] === 2);

    // CASO 1: INDAGINE & CONSTRAINTS BREAKING
    if (trueUnknowns.length > 0) {
        // Ordina per utilità (Probabilità + Entropia + IMPACT SUI VINCOLI)
        trueUnknowns.sort((a, b) => {
            const pA = allProbs.solution[a] || 0;
            const pB = allProbs.solution[b] || 0;
            
            // Calcolo base entropico
            const scoreA = pA + shannonEntropy(pA);
            const scoreB = pB + shannonEntropy(pB);
            
            // Boost derivante dai vincoli (Constraint Blindness Fix)
            const constraintBonusA = getConstraintImpact(a);
            const constraintBonusB = getConstraintImpact(b);

            // Combina i punteggi (i vincoli pesano molto)
            return (scoreB + constraintBonusB) - (scoreA + constraintBonusA);
        });

        const best = trueUnknowns[0];
        const impact = getConstraintImpact(best);
        
        if (impact > 2.0) {
            return { 
                card: best, 
                type: "🔓 Breaker", 
                desc: "Carta chiave per risolvere un vincolo logico." 
            };
        }

        return { 
            card: best, 
            type: "🔬 Scientist", 
            desc: "Massimizza l'acquisizione di informazioni." 
        };
    }

    // CASO 2: CATEGORIA RISOLTA (Sappiamo chi è il colpevole)
    if (confirmedSolution) {
        // Sottocaso A: Ho delle carte mie? Bluffo per non svelare che so tutto.
        if (shields.length > 0) {
            const shield = shields[Math.floor(Math.random() * shields.length)];
            return {
                card: shield,
                type: "🛡️ Bluff Segreto",
                desc: "Categoria risolta. Usa una tua carta per nascondere la soluzione."
            };
        }
        
        // Sottocaso B: Non ho carte mie. Chiedo la soluzione (Hammer).
        // Nota: A Cluedo chiedere la soluzione è utile perché costringe a rispondere sulle altre categorie.
        return {
            card: confirmedSolution,
            type: "🔨 Hammer",
            desc: "Attacco diretto alla soluzione per forzare risposte altrove."
        };
    }

    // CASO 3: FALLBACK
    if (shields.length > 0) {
        return { card: shields[0], type: "🛡️ Shield", desc: "Fallback difensivo." };
    }
    
    const valid = list.filter(c => grid[c].SOL !== 1);
    if(valid.length > 0) return { card: valid[Math.floor(Math.random() * valid.length)], type: "❓ Random", desc: "Fallback." };

    return { card: list[0], type: "💀 Panic", desc: "Nessuna opzione valida." };
}

function generateHypothesisForRoom(room, allProbs) {
    const bestS = getSmartSelection(suspects, allProbs);
    const bestW = getSmartSelection(weapons, allProbs);

    const pS = allProbs.solution[bestS.card] || 0;
    const pW = allProbs.solution[bestW.card] || 0;

    let stratName = bestS.type;
    // Nomi combinati per la UI
    if (bestS.type.includes("Breaker") || bestW.type.includes("Breaker")) stratName = "🔓 Logic Breaker";
    else if (bestS.type.includes("Bluff") || bestW.type.includes("Bluff")) stratName = "🎭 Deception";
    else if (bestS.type.includes("Hammer") && bestW.type.includes("Hammer")) stratName = "👑 Checkmate";
    else if (bestS.type.includes("Scientist") && bestW.type.includes("Scientist")) stratName = "🔬 Indagine";

    return {
        suspect: bestS.card,
        weapon: bestW.card,
        text: `<b>${bestS.card}</b> + <b>${bestW.card}</b>`,
        type: stratName,
        probS: Math.round(pS * 100),
        probW: Math.round(pW * 100)
    };
}

function calculateTacticalMoves(currentLoc) {
    if (!currentLoc || !ROOM_DISTANCES[currentLoc]) return [];

    const allProbs = typeof getProbabilities === 'function' ? getProbabilities() : { solution: {} };
    const solProbs = allProbs.solution;

    // --- CHECK VITTORIA ---
    const sSol = suspects.find(c => grid[c].SOL === 2);
    const wSol = weapons.find(c => grid[c].SOL === 2);
    const rSol = rooms.find(c => grid[c].SOL === 2);
    const isReadyToWin = sSol && wSol && rSol;

    let moves = rooms.map(room => {
        const pRoom = solProbs[room] || 0;
        const isMyRoom = grid[room][myName] === 2;
        const isKnownNo = grid[room].SOL === 1; 
        
        const isCurrent = room === currentLoc;
        const dist = isCurrent ? 0 : ROOM_DISTANCES[currentLoc][room];
        const isSecret = !isCurrent && dist === 0;
        
        // --- NUOVO CALCOLO TURNI (Risk-Aware) ---
        let turnsEst = 1;
        let reachability = 1.0;

        if (isCurrent || isSecret) {
            turnsEst = 0; // Siamo già qui (o passaggio istantaneo)
            reachability = 1.0;
        } else {
            reachability = getReachability(dist);
            
            if (dist <= 12) {
                // Se raggiungibile coi dadi, il costo non è un intero (es. 2 turni).
                // È "1 turno + rischio di fallire".
                // Se p=0.41 (dist 8), turnsEst = 1 + (1 - 0.41) = 1.59.
                // Questo rende le distanze 8-9 molto più attraenti delle distanze >12.
                turnsEst = 1 + (1 - reachability);
            } else {
                // Se fuori dalla portata dei dadi (dist > 12), usiamo la media
                turnsEst = Math.ceil(dist / 7);
            }
        }
        
        // Per display UI arrotondiamo, ma per i calcoli usiamo il float
        const turnsDisplay = Math.round(turnsEst * 10) / 10;

        // --- CALCOLO PUNTEGGIO (SCORE) ---
        let utility = 0;

        if (isReadyToWin) {
            if (room === rSol) utility = 10000;
            else utility = -1000;
            utility -= turnsEst * 100;
        } else {
            // 1. Valore della Stanza
            utility += pRoom * 800; 
            if (!isKnownNo && !isMyRoom) utility += shannonEntropy(pRoom) * 300;

            // 2. Valore dell'Ipotesi
            const hypo = generateHypothesisForRoom(room, allProbs);
            
            // Boost se stiamo rompendo vincoli
            if (hypo.type.includes("Breaker")) utility += 400;
            if (hypo.type.includes("Scientist") || hypo.type.includes("Indagine")) utility += 150;
            if (hypo.type.includes("Checkmate")) utility += 500;

            // 3. Penalità Stanze Inutili
            if ((isMyRoom || isKnownNo) && !isCurrent) {
                utility -= 150; 
            }

            // 4. COSTO MOVIMENTO (Risk-Adjusted)
            if (isCurrent) {
                if (pRoom < 0.05 && (isMyRoom || isKnownNo)) utility -= 250; 
                else utility += 50; 
            } else {
                utility -= (turnsEst) * 180; 
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
        
        if (isSecret) reasons.push("🚇 Segreto");
        else if (!isCurrent && dist <= 12 && reachability < 0.5) reasons.push("🎲 Rischio");
        
        return {
            room, 
            score: utility, 
            pRoom: Math.round(pRoom * 100),
            dist, 
            turnsEst: turnsDisplay,
            isSecret, 
            isCurrent, 
            reasons, 
            hypothesis: hypo, 
            reachability
        };
    });

    return moves.sort((a, b) => b.score - a.score);
}

// UI Rendering
function updateTacticalSuggestions() {
    const currentLoc = document.getElementById('current-position').value;
    const container = document.getElementById('tactical-suggestions');
    if (!currentLoc) { container.innerHTML = '<div class="suggestions-placeholder">📍 Seleziona posizione...</div>'; return; }

    const chk = document.getElementById('can-stay-check');
    const canStay = chk ? chk.checked : true; 

    let rankedMoves = calculateTacticalMoves(currentLoc);
    
    if (!canStay) {
        rankedMoves = rankedMoves.filter(m => m.room !== currentLoc);
    }

    const top3 = rankedMoves.slice(0, 3);
    
    let html = "";
    if (top3.length === 0) html = "<div class='suggestions-placeholder'>Nessuna mossa utile.</div>";

    top3.forEach((s, idx) => {
        let barColor = s.pRoom > 60 ? "var(--success)" : (s.pRoom > 20 ? "var(--accent)" : "var(--text-muted)");
        let rankClass = idx === 0 ? 'is-top' : 'is-standard';
        
        let moveInfo;
        if (s.isCurrent) moveInfo = "📍 QUI";
        else if (s.isSecret) moveInfo = "🚇 PASSAGGIO";
        else if (s.dist <= 12) moveInfo = `🎲 ${Math.round(s.reachability*100)}%`;
        else moveInfo = `⏱️ ~${Math.ceil(s.turnsEst)} turni`;
        
        if (s.reasons.includes("🏆 VITTORIA")) {
            rankClass = "is-top";
            barColor = "#FFD700"; 
            moveInfo = "🏆 VAI QUI";
        }

        html += `
        <div class="suggestion-item ${rankClass}" style="border-left: 4px solid ${barColor}">
            <div class="suggestion-header">
                <div>
                    <div class="suggestion-room-name">${s.room} 
                        <span style="font-size:0.8em; color:${barColor}; margin-left:5px;">${s.pRoom}% Sol.</span>
                    </div>
                    <div class="suggestion-reasons">${s.reasons.join(' • ')}</div>
                </div>
                <div class="suggestion-score-box"><div class="suggestion-turn-info">${moveInfo}</div></div>
            </div>
            <div class="suggestion-insight">
                <span class="insight-icon">💡</span>
                <div class="insight-content">
                    <div class="insight-text">Chiedi: ${s.hypothesis.text}</div>
                    <span class="insight-type">${s.hypothesis.type}</span>
                </div>
            </div>
            <div style="width:100%; height:4px; background:#333; margin-top:6px; border-radius:2px; overflow:hidden;">
                <div style="width:${s.pRoom}%; height:100%; background:${barColor};"></div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}
