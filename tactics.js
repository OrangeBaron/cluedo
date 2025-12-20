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
 * Logica:
 * 1. Se la soluzione è nota -> USA LA SOLUZIONE (Hammer Strategy).
 * 2. Se non è nota -> Cerca carta con max Entropia (incertezza).
 * 3. Se non ci sono candidati -> Usa una carta in mano (Shield).
 */
function getSmartSelection(list, allProbs) {
    // 1. Cerca se abbiamo già la soluzione matematica
    const knownSolution = list.find(c => grid[c].SOL === 2);
    if (knownSolution) {
        return { 
            card: knownSolution, 
            type: "🔨 Hammer", 
            desc: "Soluzione nota: forza risposte sulle altre carte." 
        };
    }

    // Filtra: escludi carte che ho io o che sono sicuramente scartate
    const candidates = list.filter(c => grid[c].SOL !== 1 && grid[c][myName] !== 2);
    
    // Filtra: carte che ho in mano (Scudi)
    const shields = list.filter(c => grid[c][myName] === 2);

    // 2. Se ci sono candidati ignoti, prendi il migliore (Information Gain)
    if (candidates.length > 0) {
        // Ordina per utilità (Probabilità alta + Entropia alta)
        candidates.sort((a, b) => {
            const pA = allProbs.solution[a] || 0;
            const pB = allProbs.solution[b] || 0;
            // Pesa leggermente di più la probabilità pura per trovare la soluzione
            return (pB + shannonEntropy(pB)) - (pA + shannonEntropy(pA));
        });
        return { 
            card: candidates[0], 
            type: "🔬 Scientist", 
            desc: "Massimizza l'acquisizione di informazioni." 
        };
    }

    // 3. Se non ci sono candidati (tutti scartati tranne la soluzione che forse non è ancora marcata SOL=2 ma è logica),
    // oppure siamo costretti a bluffare per mancanza di opzioni.
    if (shields.length > 0) {
        return { 
            card: shields[0], 
            type: "🛡️ Shield", 
            desc: "Nessun candidato utile. Usa una tua carta." 
        };
    }

    // Fallback estremo (es. errore logico o inizio partita strano)
    return { card: list[0], type: "❓ Random", desc: "Fallback." };
}

function generateHypothesisForRoom(room, allProbs) {
    // Sospettato
    const bestS = getSmartSelection(suspects, allProbs);
    // Arma
    const bestW = getSmartSelection(weapons, allProbs);

    // Check combinato per dare un nome alla strategia globale
    let stratName = "Indagine Standard";
    if (bestS.type.includes("Hammer") || bestW.type.includes("Hammer")) stratName = "🔨 Pressing";
    if (bestS.type.includes("Hammer") && bestW.type.includes("Hammer")) stratName = "👑 Checkmate";
    if (bestS.type.includes("Shield") || bestW.type.includes("Shield")) stratName = "🛡️ Difensiva";

    // Calcolo probabilità combinate per la UI
    const pS = allProbs.solution[bestS.card] || 0;
    const pW = allProbs.solution[bestW.card] || 0;

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
    // Abbiamo trovato tutto?
    const sSol = suspects.find(c => grid[c].SOL === 2);
    const wSol = weapons.find(c => grid[c].SOL === 2);
    const rSol = rooms.find(c => grid[c].SOL === 2);
    const isReadyToWin = sSol && wSol && rSol;

    let moves = rooms.map(room => {
        const pRoom = solProbs[room] || 0;
        const isMyRoom = grid[room][myName] === 2;
        const isKnownNo = grid[room].SOL === 1; // Sappiamo che NON è la stanza
        
        const isCurrent = room === currentLoc;
        const dist = isCurrent ? 0 : ROOM_DISTANCES[currentLoc][room];
        const isSecret = !isCurrent && dist === 0;
        let reachability = isCurrent || isSecret ? 1.0 : getReachability(dist);
        
        // --- CALCOLO PUNTEGGIO (SCORE) ---
        let utility = 0;

        if (isReadyToWin) {
            // FASE FINALE: L'unica cosa che conta è andare nella stanza del delitto
            if (room === rSol) {
                utility = 10000; // Priorità assoluta
            } else {
                utility = -1000; // Le altre stanze sono inutili
            }
        } else {
            // FASE INVESTIGATIVA
            
            // 1. Valore della Stanza in sé (Possibile soluzione?)
            utility += pRoom * 800; 
            if (!isKnownNo && !isMyRoom) utility += shannonEntropy(pRoom) * 300;

            // 2. Valore dell'Ipotesi che posso fare qui
            // Se la stanza è "bruciata" (nota come NO), vale comunque la pena andarci
            // se mi permette di chiedere di un Sospettato/Arma cruciale?
            // Sì, ma meno di una stanza che è ANCHE possibile soluzione.
            
            const hypo = generateHypothesisForRoom(room, allProbs);
            // Se l'ipotesi contiene carte "Hammer" (soluzioni note), è molto forte
            if (hypo.type.includes("Pressing")) utility += 200;
            if (hypo.type.includes("Checkmate")) utility += 500;

            // Malus per stanze inutili (mie o note NO) se non servono per muoversi
            if ((isMyRoom || isKnownNo) && !isCurrent) utility -= 150;

            // Penalità movimento
            if (isCurrent) {
                // Leggero bonus per non muoversi (risparmio dadi), ma non se la stanza è inutile
                if (pRoom < 0.05 && (isMyRoom || isKnownNo)) utility -= 200; 
                else utility += 50; 
            } else {
                utility *= reachability; // Se è difficile arrivarci, riduci utility
                if (dist > 12) utility -= 2000; // Irraggiungibile
            }
        }
        
        const hypo = generateHypothesisForRoom(room, allProbs);
        
        let reasons = [];
        if (isReadyToWin && room === rSol) reasons.push("🏆 VITTORIA");
        else {
            if (pRoom > 0.8) reasons.push("🔥 Hotspot");
            else if (isKnownNo) reasons.push("❌ Scartata");
            else reasons.push("❓ Incerta");
            
            if (hypo.type.includes("Hammer")) reasons.push("🔨 Hammer");
        }
        
        if (isSecret) reasons.push("🚇 Segreto");
        if (dist > 0 && dist <= 12) reasons.push(`🎲 ${Math.round(reachability*100)}%`);

        return {
            room, 
            score: utility, 
            pRoom: Math.round(pRoom * 100),
            dist, 
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
    
    const rankedMoves = calculateTacticalMoves(currentLoc);
    // Mostriamo top 3, ma se la prima è Vittoria mostriamo chiaramente
    const top3 = rankedMoves.slice(0, 3);
    
    let html = "";
    if (top3.length === 0) html = "<div class='suggestions-placeholder'>Nessuna mossa utile.</div>";

    top3.forEach((s, idx) => {
        let barColor = s.pRoom > 60 ? "var(--success)" : (s.pRoom > 20 ? "var(--accent)" : "var(--text-muted)");
        let rankClass = idx === 0 ? 'is-top' : 'is-standard';
        let moveInfo = s.isCurrent ? "QUI" : (s.isSecret ? "🚇 PASSAGGIO" : `🎲 ${Math.round(s.reachability*100)}%`);
        
        if (s.reasons.includes("🏆 VITTORIA")) {
            rankClass = "is-top";
            barColor = "#FFD700"; // Oro
            moveInfo = "🏆 VAI QUI";
        } else if (s.dist > 12) {
            moveInfo = "🏃 >1 turno";
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
