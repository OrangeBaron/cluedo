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
    // 1. Inizializzazione costi
    rooms.forEach(r1 => {
        TURN_MATRIX[r1] = {};
        rooms.forEach(r2 => {
            if (r1 === r2) TURN_MATRIX[r1][r2] = 0;
            else TURN_MATRIX[r1][r2] = Math.ceil(ROOM_DISTANCES[r1][r2] / 7);
        });
    });

    // 2. Floyd-Warshall
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

// --- TACTICAL ENGINE ---

function generateHypothesisForRoom(targetRoom) {
    const pickRandom = (arr) => arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    
    // Filtri carte
    const unknownS = suspects.filter(c => grid[c].SOL === 0);
    const unknownW = weapons.filter(c => grid[c].SOL === 0);
    const myS = suspects.filter(c => grid[c][myName] === 2);
    const myW = weapons.filter(c => grid[c][myName] === 2);
    const knownOtherS = suspects.filter(c => grid[c].SOL === 1 && !myS.includes(c));
    const knownOtherW = weapons.filter(c => grid[c].SOL === 1 && !myW.includes(c));

    const getBestShield = (my, other, all) => {
        if (my.length > 0) return pickRandom(my);
        if (other.length > 0) return pickRandom(other);
        return pickRandom(all); 
    };

    let bestS, bestW, strategyType;

    if (grid[targetRoom].SOL === 0) {
        // STRATEGIA A: Forzatura Stanza
        // Se la stanza è ignota, dobbiamo chiedere quella per capire se è la soluzione.
        // Usiamo carte sicure (Shield) per Sospettato e Arma per isolare la stanza.
        bestS = getBestShield(myS, knownOtherS, suspects);
        bestW = getBestShield(myW, knownOtherW, weapons);
        strategyType = "Forzatura Stanza";
    } else {
        // STRATEGIA B: Indagine Mirata (Sospettato vs Arma)
        const countS = unknownS.length;
        const countW = unknownW.length;
        
        // Punteggi fittizi per gestire il caso "Risolto" (0 ignoti)
        const scoreS = countS === 0 ? 999 : countS;
        const scoreW = countW === 0 ? 999 : countW;

        if (scoreS === 999 && scoreW === 999) return { text: "Vittoria!", type: "Risolto" };

        // LOGICA DI PRIORITÀ AGGIORNATA
        let huntSuspect = false;

        if (scoreS < scoreW) {
            // Se mancano meno Sospettati che Armi, priorità a chiudere i Sospettati
            huntSuspect = true;
        } else if (scoreW < scoreS) {
            // Se mancano meno Armi, priorità a chiudere le Armi
            huntSuspect = false;
        } else {
            // CASO DI PAREGGIO: 50% di probabilità
            huntSuspect = Math.random() < 0.5;
        }

        if (huntSuspect) {
            bestS = pickRandom(unknownS);
            bestW = getBestShield(myW, knownOtherW, weapons); // Uso arma sicura per testare il sospettato
            strategyType = `Indagine Sospettato (${countS} rimanenti)`;
        } else {
            bestS = getBestShield(myS, knownOtherS, suspects); // Uso sospettato sicuro per testare l'arma
            bestW = pickRandom(unknownW);
            strategyType = `Indagine Arma (${countW} rimanenti)`;
        }
    }
    return { text: `<b>${bestS}</b> + <b>${bestW}</b>`, type: strategyType };
}

function updateTacticalSuggestions() {
    const currentLoc = document.getElementById('current-position').value;
    const container = document.getElementById('tactical-suggestions');
    
    if (!currentLoc || !ROOM_DISTANCES[currentLoc]) {
        container.innerHTML = '<div class="suggestions-placeholder">📍 Seleziona posizione...</div>';
        return;
    }

    const isGameSolved = grid[suspects.find(c=>grid[c].SOL===2)] && grid[weapons.find(c=>grid[c].SOL===2)] && grid[rooms.find(c=>grid[c].SOL===2)];

    let suggestions = rooms.map(room => {
        let score = 0, reasons = [];
        
        let hypothesis = isGameSolved ? { text: "🏆 VAI AD ACCUSARE!", type: "Vittoria" } : generateHypothesisForRoom(room);
        
        // Analisi Posizione e Costi
        const isCurrent = room === currentLoc;
        const dist = isCurrent ? 0 : ROOM_DISTANCES[currentLoc][room];
        // Nota: dist === 0 assicura che sia un passaggio segreto standard
        const isSecret = !isCurrent && dist === 0; 
        const trueTurns = isCurrent ? 0 : TURN_MATRIX[currentLoc][room];
        const diceReach = !isCurrent && !isSecret && (dist <= 7);
        const solStatus = grid[room].SOL; 

        // 1. PUNTEGGIO STATO STANZA (Base)
        if (solStatus === 2) { 
            score += 5000; reasons.push("🏆 DELITTO"); 
        } else if (solStatus === 0) { 
            score += 200; reasons.push("🔍 Ignota"); 
        } else if (grid[room][myName] === 2) { 
            score += 50; reasons.push("🛡️ Base"); 
        } else { 
            score -= 50; reasons.push("❌ Innocente"); 
        }

        // 2. PUNTEGGIO VALORE STRATEGICO (La correzione chiave)
        // Se c'è un'indagine utile da fare (testare sospettato/arma), diamo valore
        // anche se la stanza è "Base" (nostra).
        const usefulMove = (hypothesis.type && (hypothesis.type.includes("Indagine") || hypothesis.type.includes("Forzatura")));
        if (usefulMove || solStatus === 2) {
            score += 300; // Bonus consistente per "C'è qualcosa da fare qui"
        }

        // 3. PUNTEGGIO MOVIMENTO
        if (isCurrent) {
            // Se sono qui e c'è qualcosa da fare (usefulMove), resto.
            if (usefulMove || solStatus === 2) {
                score += 1000; reasons.push("✅ Resta qui");
            } else { 
                score -= 200; reasons.push("💨 Muoviti"); 
            }
        } else if (isSecret) {
            // Il passaggio segreto è quasi buono come restare fermi
            score += 900; reasons.push("🚇 Passaggio");
        } else if (diceReach) {
            score += 150; reasons.push("🎲 Raggiungibile");
        } else {
            // Penalità per la distanza (turni stimati)
            score -= (trueTurns * 50);
        }

        return { room, score, turns: trueTurns, dist, reasons, hypothesis, isCurrent, isSecret, diceReach, isSol: solStatus === 2 };
    });

    suggestions.sort((a, b) => b.score - a.score);
    const top3 = suggestions.filter(s => s.score > -500).slice(0, 3);

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