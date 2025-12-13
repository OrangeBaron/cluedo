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
 * Genera l'ipotesi migliore per una specifica stanza.
 * INTEGRAZIONI UTENTE:
 * 1. Mix di scudi (Carte Mie + Soluzioni) per non svelare la soluzione.
 * 2. Logica Cecchino in Late Game (Doppio Scudo).
 */
function generateHypothesisForRoom(targetRoom, isLateGame = false) {
    const pickRandom = (arr) => arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    
    // --- 1. ANALISI CARTE E POOL ---
    // Carte Ignote (Target dell'indagine)
    const unknownS = suspects.filter(c => grid[c].SOL === 0);
    const unknownW = weapons.filter(c => grid[c].SOL === 0);
    
    // Carte "Sicure" (Scudi validi) = Le mie carte (2) OR Le soluzioni già trovate (SOL=2)
    // Nota: Usare una soluzione come scudo è potentissimo (nessuno può smentire), 
    // ma mischiarla con le mie carte evita di far capire agli altri che so la soluzione.
    const safeS = suspects.filter(c => grid[c][myName] === 2 || grid[c].SOL === 2);
    const safeW = weapons.filter(c => grid[c][myName] === 2 || grid[c].SOL === 2);

    // --- 2. LOGICA DI SELEZIONE ---
    let bestS, bestW;

    // Helper: Seleziona uno scudo dal pool sicuro, o fallback su ignoto se non ho scudi
    const pickShield = (safeList, unknownList, allList) => {
        if (safeList.length > 0) return pickRandom(safeList);
        if (unknownList.length > 0) return pickRandom(unknownList);
        return pickRandom(allList);
    };

    // Helper: Seleziona un target da indagare
    const pickTarget = (unknownList, allList) => {
        if (unknownList.length > 0) return pickRandom(unknownList);
        return pickRandom(allList); // Se tutto noto, spara a caso
    };

    // Stanza Risolta o Mia? (Funziona da scudo?)
    const isRoomSafe = (grid[targetRoom][myName] === 2 || grid[targetRoom].SOL === 2);

    // A) LOGICA "CECCHINO" (LATE GAME)
    // Obiettivo: Bloccare tutte le vie di fuga tranne una specifica carta ignota.
    if (isLateGame) {
        const needS = unknownS.length > 0;
        const needW = unknownW.length > 0;

        if (needS && needW) {
            // Mi mancano entrambi: Se la stanza è sicura, spara su entrambi (risparmia scudi carte).
            // Se la stanza NON è sicura, usa uno scudo su S o W per garantire info sull'altro.
            if (isRoomSafe) {
                bestS = pickTarget(unknownS, suspects);
                bestW = pickTarget(unknownW, weapons);
            } else {
                // Alternativa casuale: Scuda S o Scuda W
                if (Math.random() < 0.5 && safeS.length > 0) {
                    bestS = pickShield(safeS, unknownS, suspects);
                    bestW = pickTarget(unknownW, weapons);
                } else {
                    bestS = pickTarget(unknownS, suspects);
                    bestW = pickShield(safeW, unknownW, weapons);
                }
            }
        } 
        else if (needS) {
            // Mi manca solo il Sospettato: BLINDA TUTTO IL RESTO.
            // Usa scudo Arma + Stanza (se possibile) per forzare risposta su Sospettato.
            bestS = pickTarget(unknownS, suspects);
            bestW = pickShield(safeW, unknownW, weapons); // Usa scudo Arma (Mio o Soluzione)
        } 
        else if (needW) {
            // Mi manca solo l'Arma: BLINDA TUTTO IL RESTO.
            bestS = pickShield(safeS, unknownS, suspects); // Usa scudo Sospettato
            bestW = pickTarget(unknownW, weapons);
        } 
        else {
            // Tutto risolto (o quasi): Spara a caso o bluff totale
            bestS = pickShield(safeS, unknownS, suspects);
            bestW = pickShield(safeW, unknownW, weapons);
        }
    } 
    
    // B) LOGICA "ESPLORAZIONE" (EARLY GAME)
    // Obiettivo: Scoprire più bit possibili (anche risposte generiche vanno bene).
    else {
        // In Early Game, se la stanza è sicura, è un'ottima occasione per indagare su 
        // DUE carte ignote (S+W) contemporaneamente.
        // Se la stanza è ignota, usiamo uno scudo per bilanciare.
        
        if (isRoomSafe) {
            bestS = pickTarget(unknownS, suspects);
            bestW = pickTarget(unknownW, weapons);
        } else {
            // Stanza ignota: rischioso chiedere 3 ignote (troppo vago). 
            // Meglio metterne 1 sicura.
            if (Math.random() < 0.5) {
                bestS = pickShield(safeS, unknownS, suspects);
                bestW = pickTarget(unknownW, weapons);
            } else {
                bestS = pickTarget(unknownS, suspects);
                bestW = pickShield(safeW, unknownW, weapons);
            }
        }
    }

    // Fallback finale per null pointers (raro)
    if (!bestS) bestS = suspects[0];
    if (!bestW) bestW = weapons[0];

    // Calcolo Tipo Strategia per UI
    const isSafeS = (grid[bestS][myName] === 2 || grid[bestS].SOL === 2);
    const isSafeW = (grid[bestW][myName] === 2 || grid[bestW].SOL === 2);
    const isSafeR = (grid[targetRoom][myName] === 2 || grid[targetRoom].SOL === 2);

    const safeCount = (isSafeS ? 1 : 0) + (isSafeW ? 1 : 0) + (isSafeR ? 1 : 0);
    let strategyType = "";

    if (safeCount === 3) strategyType = "Bluff Totale (0 Rischi)";
    else if (safeCount === 2) strategyType = "Cecchino (Doppio Scudo)";
    else if (safeCount === 1) strategyType = "Bilanciata (1 Scudo)";
    else strategyType = "Aggressiva (3 Ignote)";

    return { 
        suspect: bestS, 
        weapon: bestW, 
        text: `<b>${bestS}</b> + <b>${bestW}</b>`, 
        type: strategyType 
    };
}

/**
 * Calcola i punteggi tattici per tutte le stanze.
 * UPDATE: Rimosso penalità stanza nota in early game.
 */
function calculateTacticalMoves(currentLoc) {
    if (!currentLoc || !ROOM_DISTANCES[currentLoc]) return [];

    const unknownCount = allCards.filter(c => grid[c].SOL === 0).length;
    const isLateGame = unknownCount <= 8; // Soglia leggermente alzata
    const isGameSolved = grid[suspects.find(c=>grid[c].SOL===2)] && grid[weapons.find(c=>grid[c].SOL===2)] && grid[rooms.find(c=>grid[c].SOL===2)];

    let moves = rooms.map(room => {
        let score = 0, reasons = [];
        let hypothesis;

        if (isGameSolved) {
            hypothesis = { suspect: null, weapon: null, text: "🏆 VAI AD ACCUSARE!", type: "Vittoria" };
        } else {
            hypothesis = generateHypothesisForRoom(room, isLateGame);
        }
        
        // Dati Posizione
        const isCurrent = room === currentLoc;
        const dist = isCurrent ? 0 : ROOM_DISTANCES[currentLoc][room];
        const isSecret = !isCurrent && dist === 0; 
        const trueTurns = isCurrent ? 0 : TURN_MATRIX[currentLoc][room];
        const diceReach = !isCurrent && !isSecret && (dist <= 10); // Assumiamo 9-10 col dado sia possibile
        const solStatus = grid[room].SOL; 
        const isMyRoom = grid[room][myName] === 2;

        // --- PUNTEGGIO DINAMICO ---
        
        // 1. Valore della Stanza
        if (solStatus === 2) { 
            score += 5000; reasons.push("🏆 DELITTO"); 
        } else if (solStatus === 0) { 
            score += 200; reasons.push("🔍 Ignota"); 
        } else if (isMyRoom) { 
            // FIX: Niente penalità early game. Una base sicura è sempre buona per testare S+W.
            score += 100; reasons.push("🛡️ Base"); 
        } else { 
            score -= 50; reasons.push("❌ Innocente"); // Stanza nota di altri (inutile)
        }

        // 2. Bonus Strategia (Dall'ipotesi)
        // Se l'ipotesi è "Cecchino" o "Bluff Totale", stiamo controllando il gioco.
        if (hypothesis.type && hypothesis.type.includes("Cecchino")) {
            score += 300; reasons.push("🎯 Cecchino");
        }
        if (hypothesis.type && hypothesis.type.includes("Aggressiva")) {
            // Premia l'aggressività solo se costa poco movimento
            score += 150; reasons.push("🔥 Aggro");
        }

        // 3. Costo Movimento (Il vero nemico)
        if (isCurrent) {
            // Rimanere è gratis. Se la stanza è utile (Ignota o Mia Base), rimani!
            if (solStatus === 0 || isMyRoom || solStatus === 2) {
                score += 1000; reasons.push("✅ Resta qui");
            } else {
                score -= 200; reasons.push("💨 Vattene");
            }
        } else if (isSecret) {
            score += 800; reasons.push("🚇 Passaggio");
        } else if (diceReach) {
            score += 100; reasons.push("🎲 Dado");
        } else {
            // Penalità pesante per i turni spesi a camminare
            score -= (trueTurns * 80); 
        }

        return { 
            room, score, turns: trueTurns, dist, reasons, hypothesis, 
            isCurrent, isSecret, diceReach, isSol: solStatus === 2 
        };
    });

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
