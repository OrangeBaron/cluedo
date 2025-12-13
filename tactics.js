// --- MAP DATA & CONSTANTS ---
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

// --- PATHFINDING INIT ---
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

    rooms.forEach(k => {
        rooms.forEach(i => {
            rooms.forEach(j => {
                const alternativePath = TURN_MATRIX[i][k] + TURN_MATRIX[k][j];
                if (alternativePath < TURN_MATRIX[i][j]) {
                    TURN_MATRIX[i][j] = alternativePath;
                }
            });
        });
    });
}

// --- TACTICAL ENGINE (PURE LOGIC) ---

/**
 * Genera l'ipotesi migliore per una specifica stanza data la conoscenza attuale.
 * Restituisce un oggetto strutturato con {suspect, weapon, text, type}
 */
function generateHypothesisForRoom(targetRoom) {
    const pickRandom = (arr) => arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    
    // Filtri carte
    const unknownS = suspects.filter(c => grid[c].SOL === 0);
    const unknownW = weapons.filter(c => grid[c].SOL === 0);
    const myS = suspects.filter(c => grid[c][myName] === 2);
    const myW = weapons.filter(c => grid[c][myName] === 2);

    const getBestShield = (my, other, all) => {
        if (my.length > 0) return pickRandom(my);
        if (other.length > 0) return pickRandom(other);
        return pickRandom(all); 
    };

    let bestS, bestW;

    if (grid[targetRoom].SOL === 0) {
        // Stanza ignota: forziamo scudi se possibile
        bestS = getBestShield(myS, unknownS, suspects);
        bestW = getBestShield(myW, unknownW, weapons);
    } else {
        // Stanza nota: indagine mirata
        const countS = unknownS.length;
        const countW = unknownW.length;
        
        // Se tutto risolto, fallback su random per evitare crash, ma type sarà "Vittoria" gestito dopo
        if (countS === 0 && countW === 0) {
            bestS = suspects[0]; 
            bestW = weapons[0];
        } else {
            const scoreS = countS === 0 ? 999 : countS;
            const scoreW = countW === 0 ? 999 : countW;

            const hasShieldS = myS.length > 0;
            const hasShieldW = myW.length > 0;
            
            let huntSuspect = false;

            if (hasShieldS && !hasShieldW) {
                huntSuspect = false; 
            }
            else if (!hasShieldS && hasShieldW) {
                huntSuspect = true;
            }
            else {
                if (scoreS < scoreW) huntSuspect = true;
                else if (scoreW < scoreS) huntSuspect = false;
                else huntSuspect = Math.random() < 0.5;
            }

            if (huntSuspect) {
                bestS = pickRandom(unknownS) || suspects[0];
                bestW = getBestShield(myW, unknownW, weapons);
            } else {
                bestS = getBestShield(myS, unknownS, suspects);
                bestW = pickRandom(unknownW) || weapons[0];
            }
        }
    }

    // Calcolo Tipo Strategia
    const isMyS = grid[bestS][myName] === 2;
    const isMyW = grid[bestW][myName] === 2;
    const isMyR = grid[targetRoom][myName] === 2;

    const myCount = (isMyS ? 1 : 0) + (isMyW ? 1 : 0) + (isMyR ? 1 : 0);
    let strategyType = "";

    if (myCount === 2) {
        if (!isMyS) strategyType = "Forzatura Sospettato";
        else if (!isMyW) strategyType = "Forzatura Arma";
        else strategyType = "Forzatura Stanza";
    } else if (myCount === 3) {
        strategyType = "Bluff Totale";
    } else {
        let targets = [];
        if (!isMyS) targets.push("Sospettato");
        if (!isMyW) targets.push("Arma");
        if (!isMyR) targets.push("Stanza");
        strategyType = "Indagine " + targets.join(", ");
    }

    return { 
        suspect: bestS, 
        weapon: bestW, 
        text: `<b>${bestS}</b> + <b>${bestW}</b>`, 
        type: strategyType 
    };
}

/**
 * Calcola i punteggi tattici per tutte le stanze basandosi sulla posizione corrente.
 * Restituisce un array ordinato di mosse.
 */
function calculateTacticalMoves(currentLoc) {
    if (!currentLoc || !ROOM_DISTANCES[currentLoc]) return [];

    const isGameSolved = grid[suspects.find(c=>grid[c].SOL===2)] && grid[weapons.find(c=>grid[c].SOL===2)] && grid[rooms.find(c=>grid[c].SOL===2)];

    let moves = rooms.map(room => {
        let score = 0, reasons = [];
        
        let hypothesis;
        if (isGameSolved) {
            hypothesis = { suspect: null, weapon: null, text: "🏆 VAI AD ACCUSARE!", type: "Vittoria" };
        } else {
            hypothesis = generateHypothesisForRoom(room);
        }
        
        // Analisi Posizione e Costi
        const isCurrent = room === currentLoc;
        const dist = isCurrent ? 0 : ROOM_DISTANCES[currentLoc][room];
        const isSecret = !isCurrent && dist === 0; 
        const trueTurns = isCurrent ? 0 : TURN_MATRIX[currentLoc][room];
        const diceReach = !isCurrent && !isSecret && (dist <= 7);
        const solStatus = grid[room].SOL; 

        const isForzatura = hypothesis.type && hypothesis.type.includes("Forzatura");
        const isIndagine = hypothesis.type && hypothesis.type.includes("Indagine");
        const usefulMove = isForzatura || isIndagine; 

        // 1. PUNTEGGIO STATO STANZA
        if (solStatus === 2) { 
            score += 5000; reasons.push("🏆 DELITTO"); 
        } else if (solStatus === 0) { 
            score += 200; reasons.push("🔍 Ignota"); 
        } else if (grid[room][myName] === 2) { 
            score += 50; reasons.push("🛡️ Base"); 
        } else { 
            score -= 50; reasons.push("❌ Innocente"); 
        }

        // 2. PUNTEGGIO STRATEGICO
        if (solStatus === 2) score += 300;
        else if (isForzatura) score += 800;
        else if (isIndagine) score += 300;

        // 3. PUNTEGGIO MOVIMENTO
        if (isCurrent) {
            if (usefulMove || solStatus === 2) { score += 1000; reasons.push("✅ Resta qui"); }
            else { score -= 200; reasons.push("💨 Muoviti"); }
        } else if (isSecret) {
            score += 900; reasons.push("🚇 Passaggio");
        } else if (diceReach) {
            score += 150; reasons.push("🎲 Raggiungibile");
        } else {
            score -= (trueTurns * 50);
        }

        return { 
            room, score, turns: trueTurns, dist, reasons, hypothesis, 
            isCurrent, isSecret, diceReach, isSol: solStatus === 2 
        };
    });

    // Ordina decrescente
    return moves.sort((a, b) => b.score - a.score);
}

// --- UI HANDLER ---

function updateTacticalSuggestions() {
    const currentLoc = document.getElementById('current-position').value;
    const container = document.getElementById('tactical-suggestions');
    
    if (!currentLoc) {
        container.innerHTML = '<div class="suggestions-placeholder">📍 Seleziona posizione...</div>';
        return;
    }

    // Usa la funzione pura per i calcoli
    const rankedMoves = calculateTacticalMoves(currentLoc);
    const top3 = rankedMoves.filter(s => s.score > -500).slice(0, 3);

    let html = "";
    if (top3.length === 0) html = "<div class='suggestions-placeholder'>Nessuna mossa utile.</div>";

    top3.forEach((s, idx) => {
        let rankClass = s.isSol ? 'is-top' : (idx === 0 ? 'is-good' : 'is-standard');
        let turnInfo = s.isCurrent ? "📍 QUI" : (s.isSecret ? "🚇 SEG" : (s.diceReach ? `🎲 ${s.dist}` : `🏃 ~${s.turns}`));

        html += `
        <div class="suggestion-item ${rankClass}">
            <div class="suggestion-header">
                <div><div class="suggestion-room-name">${s.room}</div><div class="suggestion-reasons">${s.reasons.join(', ')}</div></div>
                <div class="suggestion-score-box"><div class="suggestion-score-val">${s.score}</div><div class="suggestion-turn-info">${turnInfo}</div></div>
            </div>
            <div class="suggestion-insight">
                <span class="insight-icon">${s.isSol ? '🏆' : '💡'}</span>
                <div class="insight-content">
                    <div class="insight-text">${s.hypothesis.text} <span class="insight-type">${s.hypothesis.type || ''}</span></div>
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}
