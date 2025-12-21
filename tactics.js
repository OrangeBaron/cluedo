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
const DICE_PROBS = [0, 0, 1.0, 0.97, 0.91, 0.83, 0.72, 0.58, 0.41, 0.27, 0.16, 0.08, 0.02];

function getReachability(dist) {
    if (dist <= 0) return 1.0; // Già lì o passaggio segreto
    if (dist > 12) return 0.0; // Impossibile in 1 turno
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
                    TURN_MATRIX[r1][r2] = 1; // Passaggio segreto
                } else {
                    TURN_MATRIX[r1][r2] = Math.ceil(dist / 7);
                }
            }
        });
    });
}

// ==========================================
// 2. MOTORE ENTROPICO (Scienza della Deduzione)
// ==========================================

function shannonEntropy(p) {
    if (p <= 0 || p >= 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

/**
 * Seleziona la carta migliore per una categoria (Sospettato o Arma).
 * Logica V2:
 * 1. Priorità assoluta alle carte IGNOTE (per fare indagine).
 * 2. Se la categoria è RISOLTA (SOL=2), preferisce usare una carta PROPRIA (Shield) per nascondere la soluzione.
 * 3. Se costretto, usa la soluzione (Hammer).
 * 4. Evita sempre carte note in mano agli avversari.
 */
function getSmartSelection(list, allProbs) {
    // Identificazione stato carte
    const confirmedSolution = list.find(c => grid[c].SOL === 2);
    // True Unknowns: Carte che non so chi ha (SOL=0) e che NON ho io.
    const trueUnknowns = list.filter(c => grid[c].SOL === 0 && grid[c][myName] !== 2);
    // Shields: Carte che ho io (SOL=1 tecnicamente per gli altri, ma io so che sono mie)
    const shields = list.filter(c => grid[c][myName] === 2);

    // CASO 1: INDAGINE (Ci sono ancora carte ignote da scoprire)
    if (trueUnknowns.length > 0) {
        // Ordina per utilità (Probabilità alta + Entropia alta)
        trueUnknowns.sort((a, b) => {
            const pA = allProbs.solution[a] || 0;
            const pB = allProbs.solution[b] || 0;
            return (pB + shannonEntropy(pB)) - (pA + shannonEntropy(pA));
        });
        return { 
            card: trueUnknowns[0], 
            type: "🔬 Scientist", 
            desc: "Massimizza l'acquisizione di informazioni." 
        };
    }

    // CASO 2: CATEGORIA RISOLTA (Sappiamo chi è il colpevole)
    if (confirmedSolution) {
        // Sottocaso A: Ho delle carte mie in questa categoria?
        // Se sì, le uso per BLUFFARE. Chiedendo una carta mia, non rivelo agli altri che so la soluzione.
        if (shields.length > 0) {
            const shield = shields[Math.floor(Math.random() * shields.length)];
            return {
                card: shield,
                type: "🛡️ Bluff Segreto",
                desc: "Categoria risolta. Usa una tua carta per nascondere la soluzione agli avversari."
            };
        }
        
        // Sottocaso B: Non ho carte mie. Sono costretto a chiedere la soluzione.
        // Questo è rischioso (svela info), ma è l'unica mossa legale intelligente (non posso chiedere carte di avversari noti).
        return {
            card: confirmedSolution,
            type: "🔨 Hammer",
            desc: "Soluzione nota e nessun scudo disponibile. Attacco diretto."
        };
    }

    // CASO 3: FALLBACK (Situazioni anomale o late-game con configurazioni strane)
    // Se non ci sono unknowns e non c'è una soluzione marcata (improbabile), usiamo uno scudo o random safe.
    if (shields.length > 0) {
        return { card: shields[0], type: "🛡️ Shield", desc: "Fallback difensivo." };
    }
    
    // Random tra quelle non scartate da altri (evitiamo di chiedere carte che sappiamo avere gli avversari)
    const valid = list.filter(c => grid[c].SOL !== 1);
    if(valid.length > 0) return { card: valid[Math.floor(Math.random() * valid.length)], type: "❓ Random", desc: "Fallback." };

    return { card: list[0], type: "💀 Panic", desc: "Nessuna opzione valida." };
}

function generateHypothesisForRoom(room, allProbs) {
    // Sospettato
    const bestS = getSmartSelection(suspects, allProbs);
    // Arma
    const bestW = getSmartSelection(weapons, allProbs);

    // Calcolo probabilità combinate per la UI
    const pS = allProbs.solution[bestS.card] || 0;
    const pW = allProbs.solution[bestW.card] || 0;

    let stratName = bestS.type;
    // Semplificazione nome strategia combinata
    if (bestS.type.includes("Bluff") || bestW.type.includes("Bluff")) stratName = "🎭 Deception";
    if (bestS.type.includes("Hammer") && bestW.type.includes("Hammer")) stratName = "👑 Checkmate";
    if (bestS.type.includes("Scientist") && bestW.type.includes("Scientist")) stratName = "🔬 Indagine";

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
        
        // Calcolo Turni Stimati (Media roll 7)
        let turnsEst = 1;
        if (!isCurrent && !isSecret) {
            turnsEst = Math.ceil(dist / 7);
            if (turnsEst < 1) turnsEst = 1;
        }

        // Reachability immediata (per UI dadi)
        let reachability = isCurrent || isSecret ? 1.0 : getReachability(dist);
        
        // --- CALCOLO PUNTEGGIO (SCORE) ---
        let utility = 0;

        if (isReadyToWin) {
            // FASE FINALE: Corri alla soluzione
            if (room === rSol) utility = 10000;
            else utility = -1000;
            
            // Penalità distanza (meglio arrivare prima)
            utility -= turnsEst * 100;
        } else {
            // FASE INVESTIGATIVA
            
            // 1. Valore della Stanza (Potenziale soluzione?)
            utility += pRoom * 800; 
            if (!isKnownNo && !isMyRoom) utility += shannonEntropy(pRoom) * 300;

            // 2. Valore dell'Ipotesi possibile
            const hypo = generateHypothesisForRoom(room, allProbs);
            if (hypo.type.includes("Scientist") || hypo.type.includes("Indagine")) utility += 150;
            if (hypo.type.includes("Bluff") || hypo.type.includes("Deception")) utility += 80; // Utile per non svelare info
            if (hypo.type.includes("Checkmate")) utility += 500;

            // 3. Penalità Stanze Inutili (Note o Mie)
            if ((isMyRoom || isKnownNo) && !isCurrent) {
                // Se la stanza è inutile, ci andiamo solo se l'ipotesi è MOLTO forte o se serve per muoversi
                utility -= 150; 
            }

            // 4. COSTO MOVIMENTO (TURNI)
            if (isCurrent) {
                // Bonus pigrizia, ma non se stiamo camperando in una stanza inutile
                if (pRoom < 0.05 && (isMyRoom || isKnownNo)) utility -= 250; // VATTENE!
                else utility += 50; 
            } else {
                // Penalità basata sul tempo (turni) e non sull'impossibilità immediata
                // Un viaggio di 2 turni verso una stanza ottima è meglio di 1 turno verso una stanza inutile
                utility -= (turnsEst - 1) * 200; // -200 per ogni turno extra di attesa
                
                // Penalità minore per distanza elevata anche nel singolo turno (rischio dadi)
                if (turnsEst === 1 && dist > 7) utility -= (dist - 7) * 20;
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
        
        return {
            room, 
            score: utility, 
            pRoom: Math.round(pRoom * 100),
            dist, 
            turnsEst,
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
    
    // Filtro anti-camper
    if (!canStay) {
        rankedMoves = rankedMoves.filter(m => m.room !== currentLoc);
    }

    const top3 = rankedMoves.slice(0, 3);
    
    let html = "";
    if (top3.length === 0) html = "<div class='suggestions-placeholder'>Nessuna mossa utile.</div>";

    top3.forEach((s, idx) => {
        let barColor = s.pRoom > 60 ? "var(--success)" : (s.pRoom > 20 ? "var(--accent)" : "var(--text-muted)");
        let rankClass = idx === 0 ? 'is-top' : 'is-standard';
        
        // Logica etichetta movimento
        let moveInfo;
        if (s.isCurrent) moveInfo = "📍 QUI";
        else if (s.isSecret) moveInfo = "🚇 PASSAGGIO";
        else if (s.turnsEst > 1) moveInfo = `⏱️ ~${s.turnsEst} turni`;
        else moveInfo = `🎲 ${Math.round(s.reachability*100)}%`;
        
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
