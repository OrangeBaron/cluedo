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

    // Floyd-Warshall Algorithm for All-Pairs Shortest Paths
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

// --- STATISTICAL HELPERS ---

/**
 * Calcola la "Densità" di una carta ignota.
 * Punteggio alto = Molto probabile che sia in mano a un avversario (tanti slot liberi).
 * Punteggio basso = Probabile che sia nella Busta (o in mano a uno con pochi slot).
 */
function getCardDensity(card) {
    if (!card || !grid[card] || grid[card].SOL !== 0) return 0; // Solo per carte ignote
    
    let density = 0;
    players.forEach(p => {
        if (p === myName) return;
        
        // Se il giocatore PUÒ avere la carta (non c'è un 'NO' sicuro)
        if (grid[card][p] !== 1) {
            // Conta slot bui (Carte totali - Carte viste)
            const seen = allCards.filter(c => grid[c][p] === 2).length;
            const slots = (limits[p] || 0) - seen;
            
            // Ogni slot buio aumenta la probabilità che la carta sia qui
            if (slots > 0) density += slots;
        }
    });
    return density;
}

/**
 * Calcola il "Rejection Count" (Quanti giocatori hanno detto NO a questa carta).
 * Usato per la strategia "Ghost Protocol".
 */
function getRejectionCount(card) {
    if (!card || !grid[card]) return 0;
    let count = 0;
    players.forEach(p => {
        if (p !== myName && grid[card][p] === 1) count++; // 1 = NON CE L'HA
    });
    return count;
}

// --- TACTICAL ENGINE ---

function generateHypothesisForRoom(targetRoom, isLateGame = false) {
    const pickRandom = (arr) => arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    
    // Helper: Seleziona la carta con la Densità più alta (Massimizza info gain)
    const pickBestDensity = (arr) => {
        if (!arr || arr.length === 0) return null;
        // Ordina per densità decrescente
        const sorted = [...arr].sort((a, b) => getCardDensity(b) - getCardDensity(a));
        return sorted[0];
    };

    const unknownS = suspects.filter(c => grid[c].SOL === 0);
    const unknownW = weapons.filter(c => grid[c].SOL === 0);
    
    // Carte sicure da usare come "Scudo" (Shielding)
    const safeS = suspects.filter(c => grid[c][myName] === 2 || grid[c].SOL === 2);
    const safeW = weapons.filter(c => grid[c][myName] === 2 || grid[c].SOL === 2);

    let bestS, bestW, strategyType = "Standard";

    // --- GHOST PROTOCOL (NEW STRATEGY) ---
    // Cerca carte che sono già state smentite da molti giocatori ma non sono ancora risolte.
    // L'obiettivo è "chiudere il cerchio" (Intersection Targeting).
    
    const ghostS = unknownS.sort((a,b) => getRejectionCount(b) - getRejectionCount(a))[0];
    const ghostW = unknownW.sort((a,b) => getRejectionCount(b) - getRejectionCount(a))[0];
    
    const activeOpponents = players.length - 1; 
    const rejectionThreshold = Math.max(1, Math.floor(activeOpponents / 2)); 

    // CASO 1: GHOST SUSPECT FOUND
    // Se c'è un sospettato molto smentito e abbiamo un'arma sicura da usare come scudo
    if (ghostS && getRejectionCount(ghostS) >= rejectionThreshold && safeW.length > 0) {
        bestS = ghostS;
        bestW = safeW[Math.floor(Math.random() * safeW.length)]; // Usa scudo arma
        strategyType = "👻 Sospettato Fantasma";
    }
    // CASO 2: GHOST WEAPON FOUND
    // Se c'è un'arma molto smentita e abbiamo un sospettato sicuro da usare come scudo
    else if (ghostW && getRejectionCount(ghostW) >= rejectionThreshold && safeS.length > 0) {
        bestS = safeS[Math.floor(Math.random() * safeS.length)]; // Usa scudo sospettato
        bestW = ghostW;
        strategyType = "👻 Arma Fantasma";
    }
    // CASO 3: LOGICA CLASSICA (Fallback)
    else {
        const pickTarget = (unknownList, allList) => {
            if (unknownList.length > 0) return pickBestDensity(unknownList); // USA LA DENSITÀ
            return pickRandom(allList); 
        };

        const pickShield = (safeList, unknownList, allList) => {
            if (safeList.length > 0) return pickRandom(safeList);
            if (unknownList.length > 0) return pickBestDensity(unknownList);
            return pickRandom(allList);
        };

        const isRoomSafe = (grid[targetRoom][myName] === 2 || grid[targetRoom].SOL === 2);

        if (isLateGame) {
            const needS = unknownS.length > 0;
            const needW = unknownW.length > 0;

            if (needS && needW) {
                if (isRoomSafe) {
                    bestS = pickTarget(unknownS, suspects);
                    bestW = pickTarget(unknownW, weapons);
                    strategyType = "Aggressiva";
                } else {
                    // Mix difensivo
                    if (Math.random() < 0.5 && safeS.length > 0) {
                        bestS = pickShield(safeS, unknownS, suspects);
                        bestW = pickTarget(unknownW, weapons);
                        strategyType = "Bilanciata (S)";
                    } else {
                        bestS = pickTarget(unknownS, suspects);
                        bestW = pickShield(safeW, unknownW, weapons);
                        strategyType = "Bilanciata (W)";
                    }
                }
            } else if (needS) {
                bestS = pickTarget(unknownS, suspects);
                bestW = pickShield(safeW, unknownW, weapons);
                strategyType = "Cecchino (S)";
            } else if (needW) {
                bestS = pickShield(safeS, unknownS, suspects);
                bestW = pickTarget(unknownW, weapons);
                strategyType = "Cecchino (W)";
            } else {
                bestS = pickShield(safeS, unknownS, suspects);
                bestW = pickShield(safeW, unknownW, weapons);
                strategyType = "Bluff Totale";
            }
        } else {
            // EARLY GAME
            if (isRoomSafe) {
                bestS = pickTarget(unknownS, suspects);
                bestW = pickTarget(unknownW, weapons);
                strategyType = "Aggressiva (Early)";
            } else {
                if (Math.random() < 0.5) {
                    bestS = pickShield(safeS, unknownS, suspects);
                    bestW = pickTarget(unknownW, weapons);
                    strategyType = "Bilanciata";
                } else {
                    bestS = pickTarget(unknownS, suspects);
                    bestW = pickShield(safeW, unknownW, weapons);
                    strategyType = "Bilanciata";
                }
            }
        }
    }

    if (!bestS) bestS = suspects[0];
    if (!bestW) bestW = weapons[0];

    return { 
        suspect: bestS, 
        weapon: bestW, 
        text: `<b>${bestS}</b> + <b>${bestW}</b>`, 
        type: strategyType 
    };
}

function calculateTacticalMoves(currentLoc) {
    if (!currentLoc || !ROOM_DISTANCES[currentLoc]) return [];

    const unknownCount = allCards.filter(c => grid[c].SOL === 0).length;
    const isLateGame = unknownCount <= Math.ceil(allCards.length * 0.4); 
    const isGameSolved = grid[suspects.find(c=>grid[c].SOL===2)] && grid[weapons.find(c=>grid[c].SOL===2)] && grid[rooms.find(c=>grid[c].SOL===2)];

    let moves = rooms.map(room => {
        let score = 0, reasons = [];
        let hypothesis;

        if (isGameSolved) {
            hypothesis = { suspect: null, weapon: null, text: "🏆 VAI AD ACCUSARE!", type: "Vittoria" };
        } else {
            hypothesis = generateHypothesisForRoom(room, isLateGame);
        }
        
        const isCurrent = room === currentLoc;
        const dist = isCurrent ? 0 : ROOM_DISTANCES[currentLoc][room];
        const isSecret = !isCurrent && dist === 0; 
        const trueTurns = isCurrent ? 0 : (TURN_MATRIX[currentLoc] ? TURN_MATRIX[currentLoc][room] : 99);
        const diceReach = !isCurrent && !isSecret && (dist <= 10); 
        const solStatus = grid[room].SOL; 
        const isMyRoom = grid[room][myName] === 2;
        
        // Verifica se la stanza è posseduta da un avversario (Bruciata)
        let ownedByEnemy = false;
        players.forEach(p => {
             if (p !== myName && grid[room][p] === 2) ownedByEnemy = true;
        });

        // --- 1. VALORE BASE ---
        if (solStatus === 2) { 
            score += 5000; reasons.push("🏆 DELITTO"); 
        } else if (solStatus === 0) { 
            score += 200; reasons.push("🔍 Ignota"); 
        } else if (isMyRoom) { 
            score += 100; reasons.push("🛡️ Base"); 
        } else if (ownedByEnemy) { 
            score -= 1000; reasons.push("💩 Bruciata");
        } else { 
            score -= 50; reasons.push("❌ Innocente"); 
        }

        // --- 2. BONUS STRATEGIA ---
        if (hypothesis.type.includes("Ghost")) {
            score += 500; reasons.push("👻 Fantasma");
        }
        if (hypothesis.type.includes("Cecchino")) {
            score += 300; reasons.push("🎯 Cecchino");
        }
        if (hypothesis.type.includes("Aggressiva")) {
            score += 150; reasons.push("🔥 Aggro");
        }

        // --- 3. COSTO MOVIMENTO ---
        if (isCurrent) {
            if (ownedByEnemy) {
                score -= 500; reasons.push("⚠️ Bruciata");
            } else if (solStatus === 0 || isMyRoom || solStatus === 2) {
                score += 1200; reasons.push("✅ Resta"); 
            } else {
                score -= 200; reasons.push("💨 Via!");
            }
        } else if (isSecret) {
            score += 900; reasons.push("🚇 Segreto"); 
        } else {
            if (dist <= 7) {
                score -= (trueTurns * 80); 
                reasons.push("🎲 Facile");
            } else if (dist <= 9) {
                score -= 300; 
                reasons.push("⚠️ Rischio");
            } else {
                score -= (trueTurns * 100); 
            }
        }

        // --- 4. BONUS DENSITÀ STATISTICA ---
        if (!isGameSolved) {
            const dSuspect = getCardDensity(hypothesis.suspect);
            const dWeapon = getCardDensity(hypothesis.weapon);
            const dRoom = getCardDensity(room);

            let multiplier = ownedByEnemy ? 5 : 20; 
            const totalDensity = (dSuspect + dWeapon + dRoom) * multiplier;
            
            if (totalDensity > 0) {
                const finalDensity = Math.min(totalDensity, 400);
                score += finalDensity;
                reasons.push(`📊 Stat:${finalDensity}`);
            }
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

    const rankedMoves = calculateTacticalMoves(currentLoc);
    const top3 = rankedMoves.filter(s => s.score > -2000).slice(0, 3);

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
