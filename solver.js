// ==========================================
// CONFIGURAZIONE GLOBALE
// ==========================================
const suspects = ["Scarlett", "Mustard", "White", "Green", "Peacock", "Plum"];
const weapons = ["Candeliere", "Pugnale", "Tubo", "Rivoltella", "Corda", "Chiave"];
const rooms = ["Ingresso", "Veranda", "Pranzo", "Cucina", "Ballo", "Serra", "Biliardo", "Biblioteca", "Studio"];
const allCards = [...suspects, ...weapons, ...rooms];
const CARDS_IN_DECK = suspects.length + weapons.length + rooms.length - 3;

// ==========================================
// STATO DEL GIOCO
// ==========================================
let players = [];
let grid = {};       // 0=Ignoto, 1=No, 2=Sì
let constraints = []; 
let limits = {};     
let history = [];    
let isSimulating = false; 

// Cache delle probabilità
let probabilityCache = null; 

// ==========================================
// 1. GESTIONE FATTI
// ==========================================

function resetGameVars() {
    grid = {};
    constraints = [];
    history = [];
    probabilityCache = null;
    allCards.forEach(c => { 
        grid[c] = { SOL: 0 }; 
        players.forEach(p => grid[c][p] = 0); 
    });
}

function setFact(card, player, status) {
    const currentStatus = grid[card][player];

    if (currentStatus !== 0 && currentStatus !== status) {
        if (isSimulating) throw "SIM_CONTRADICTION"; 
        log(`⚠️ <span class ="log-error">CONTRADDIZIONE: ${player} ${currentStatus === 1 ? 'non può' : 'deve'} avere ${card}.</span>`);
        return;
    }
    if (currentStatus === status) return;

    grid[card][player] = status;

    if (status === 2) {
        players.forEach(p => { if (p !== player) setFact(card, p, 1); });
        grid[card].SOL = 1; 
    }
    probabilityCache = null; 
}

function addConstraint(player, cards) {
    const possible = cards.filter(c => grid[c][player] !== 1);

    if(possible.length === 0) {
        if (isSimulating) throw "SIM_EMPTY_CONSTRAINT";
        log(`⚠️ <span class="log-error">CONTRADDIZIONE: ${player} non può avere nessuna di queste carte.</span>`);
        return;
    }

    if (possible.length === 1) {
        setFact(possible[0], player, 2);
        if (!isSimulating) log(`⚡️ Deduzione Immediata: ${player} ha ${possible[0]}`);
        return;
    }

    const sortedPossible = [...possible].sort();
    const exists = constraints.some(con => 
        con.player === player && 
        JSON.stringify([...con.cards].sort()) === JSON.stringify(sortedPossible)
    );

    if (!exists) {
        constraints.push({ player: player, cards: possible });
        probabilityCache = null; 
    }
}

function undoLastTurn() {
    if (history.length === 0) return alert("Nulla da annullare");
    const last = history.pop();
    grid = last.grid;
    constraints = last.constraints;
    currentTurnIndex = last.turnIndex;
    probabilityCache = null; 
    log(`⏪ UNDO eseguito.`);
    updateTurnUI();
    renderGrid();
}

// ==========================================
// 2. MOTORE LOGICO (DETERMINISTICO)
// ==========================================

function runSolver(fromSimulation = false) {
    let changed = true;
    let loops = 0;
    const MAX_LOOPS = 50;
    
    try {
        while(changed && loops < MAX_LOOPS) {
            changed = false;
            const snap = JSON.stringify(grid);

            // A. Pulizia vincoli
            const initialLen = constraints.length;
            constraints = constraints.filter(con => !con.cards.some(c => grid[c][con.player] === 2));
            if (constraints.length !== initialLen) changed = true;

            // B. Logica Limiti
            players.forEach(p => {
                let found = 0, unknown = [];
                allCards.forEach(c => {
                    if(grid[c][p] === 2) found++;
                    if(grid[c][p] === 0) unknown.push(c);
                });

                if (found > limits[p]) {
                    if (isSimulating) throw "SIM_LIMIT_EXCEEDED";
                    log(`⚠️ Errore: ${p} ha troppe carte!`);
                }
                // Check cruciale: Hand Underflow
                if (found + unknown.length < limits[p]) {
                    if (isSimulating) throw "SIM_HAND_UNDERFLOW";
                    log(`⚠️ Errore: Impossibile che ${p} abbia ${limits[p]} carte.`);
                }
                if (found === limits[p] && unknown.length > 0) {
                    unknown.forEach(c => setFact(c, p, 1)); changed = true;
                }
                if (found < limits[p] && (found + unknown.length === limits[p]) && unknown.length > 0) {
                    unknown.forEach(c => setFact(c, p, 2)); changed = true;
                }
            });

            // C. Risoluzione Vincoli
            constraints.forEach(con => {
                const stillPossible = con.cards.filter(c => grid[c][con.player] !== 1);
                if (stillPossible.length === 0) { if (isSimulating) throw "SIM_EMPTY_CONSTRAINT"; }
                if (stillPossible.length === 1 && grid[stillPossible[0]][con.player] !== 2) {
                    setFact(stillPossible[0], con.player, 2);
                    changed = true;
                }
            });

            // D. Esclusione Totale (Se nessuno ce l'ha -> SOLUZIONE)
            allCards.forEach(c => {
                if (grid[c].SOL !== 2) { 
                    let allNo = true;
                    players.forEach(p => { if (grid[c][p] !== 1) allNo = false; });
                    if (allNo) {
                        grid[c].SOL = 2;
                        if (!isSimulating) log(`🏆 SOLUZIONE (Tutti scartati): ${c}`);
                        changed = true;
                    }
                }
            });

            // E. Categorie
            [suspects, weapons, rooms].forEach(list => {
                let owned = 0, unk = [];
                list.forEach(c => { if(grid[c].SOL === 1) owned++; else if(grid[c].SOL === 0) unk.push(c); });
                
                if (owned === list.length - 1 && unk.length === 1 && grid[unk[0]].SOL !== 2) {
                    grid[unk[0]].SOL = 2;
                    if (!isSimulating) log(`🏆 SOLUZIONE LOGICA: ${unk[0]}`);
                    changed = true;
                }
                if (list.some(c => grid[c].SOL === 2)) {
                    list.forEach(c => {
                        if (grid[c].SOL !== 2 && grid[c].SOL !== 1) {
                            grid[c].SOL = 1;
                            changed = true;
                        }
                    });
                }
            });

            // F. Esistenza
            allCards.forEach(c => {
                if (grid[c].SOL === 1) {
                    let possibleOwners = [];
                    players.forEach(p => { if (grid[c][p] !== 1) possibleOwners.push(p); });
                    if (possibleOwners.length === 0) { if (isSimulating) throw "SIM_NO_OWNER"; }
                    if (possibleOwners.length === 1) {
                        const owner = possibleOwners[0];
                        if (grid[c][owner] !== 2) {
                            setFact(c, owner, 2);
                            changed = true;
                        }
                    }
                }
            });

            if (JSON.stringify(grid) !== snap) changed = true;
            loops++;
        }
    } catch (e) {
        if (isSimulating) throw e;
        console.error("Errore Solver:", e);
    }

    if (!fromSimulation && !isSimulating) {
        runDeepScan();
        // FORCE RENDER: Assicura che la UI si aggiorni sempre
        if (typeof renderGrid === 'function') renderGrid();
    }
}

// ==========================================
// 3. DEEP SCAN
// ==========================================
function runDeepScan() {
    isSimulating = true;
    let deduzioniFatte = false;
    const candidates = [];
    allCards.forEach(c => {
        players.forEach(p => { if (grid[c][p] === 0) candidates.push({card: c, player: p}); });
    });

    const backupGrid = JSON.stringify(grid);
    const backupConstraints = JSON.stringify(constraints);

    for (const cand of candidates) {
        let possibleYes = true;
        try { grid[cand.card][cand.player] = 2; runSolver(true); } catch (e) { possibleYes = false; }
        
        grid = JSON.parse(backupGrid); constraints = JSON.parse(backupConstraints);

        let possibleNo = true;
        try { grid[cand.card][cand.player] = 1; runSolver(true); } catch (e) { possibleNo = false; }

        grid = JSON.parse(backupGrid); constraints = JSON.parse(backupConstraints);

        if (!possibleYes && possibleNo) {
            setFact(cand.card, cand.player, 1);
            if (!isSimulating) log(`🧠 Deep Scan: ${cand.player} NON ha ${cand.card}`);
            deduzioniFatte = true;
            break; 
        }
        if (possibleYes && !possibleNo) {
            setFact(cand.card, cand.player, 2); 
            if (!isSimulating) log(`🧠 Deep Scan: ${cand.player} HA ${cand.card}`);
            deduzioniFatte = true;
            break;
        }
    }
    isSimulating = false;
    if (deduzioniFatte) runSolver();
}

// ==========================================
// 4. MOTORE MONTE CARLO (PROBABILISTICO)
// ==========================================

function getProbabilities(minValidSamples = 500) {
    if (probabilityCache !== null) return probabilityCache;

    const solCounts = {};
    const playerCounts = {}; 
    
    allCards.forEach(c => { 
        solCounts[c] = 0; 
        playerCounts[c] = {};
        players.forEach(p => playerCounts[c][p] = 0);
    });
    
    let validWorlds = 0;
    const fixedGrid = grid; const fixedLimits = limits; const fixedConstraints = constraints;
    
    const potentialS = suspects.filter(c => fixedGrid[c].SOL !== 1);
    const potentialW = weapons.filter(c => fixedGrid[c].SOL !== 1);
    const potentialR = rooms.filter(c => fixedGrid[c].SOL !== 1);

    // ANTI-CRASH: Se contraddizione totale, ritorna fallback
    if (potentialS.length === 0 || potentialW.length === 0 || potentialR.length === 0) {
        return createFallbackProbabilities(true);
    }

    // === MODIFICA CORE: Target su Mondi Validi, non Iterazioni ===
    let attempts = 0;
    const MAX_ATTEMPTS = 100000; // Limite sicurezza per evitare freeze infiniti
    const MAX_TIME_MS = 150;     // Non bloccare la UI per più di 150ms
    const startTime = performance.now();
    
    // Continua finché non abbiamo abbastanza dati statisticamente significativi
    while (validWorlds < minValidSamples && attempts < MAX_ATTEMPTS) {
        attempts++;
        
        // Safety Break temporale (ogni 1000 tentativi controlla l'orologio)
        if (attempts % 1000 === 0 && (performance.now() - startTime > MAX_TIME_MS)) {
            break; 
        }

        const s = potentialS[Math.floor(Math.random() * potentialS.length)];
        const w = potentialW[Math.floor(Math.random() * potentialW.length)];
        const r = potentialR[Math.floor(Math.random() * potentialR.length)];
        const hypothesis = [s, w, r];

        let possible = true;
        
        // Quick fail check
        players.forEach(p => {
             if (fixedGrid[s][p] === 2 || fixedGrid[w][p] === 2 || fixedGrid[r][p] === 2) possible = false;
        });
        if (!possible) continue;

        // Build deck
        let deck = [];
        allCards.forEach(c => {
            if (!hypothesis.includes(c)) {
                let owned = false;
                players.forEach(p => { if (fixedGrid[c][p] === 2) owned = true; });
                if (!owned) {
                    let rejectedByAll = true;
                    players.forEach(p => { if (fixedGrid[c][p] !== 1) rejectedByAll = false; });
                    if (rejectedByAll) { possible = false; }
                    deck.push(c);
                }
            }
        });
        if (!possible) continue;

        // Shuffle (Fisher-Yates)
        for (let k = deck.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            [deck[k], deck[j]] = [deck[j], deck[k]];
        }

        // Deal logic
        const handSlots = {};
        players.forEach(p => {
            let held = 0;
            allCards.forEach(c => { if (fixedGrid[c][p] === 2) held++; });
            handSlots[p] = fixedLimits[p] - held;
        });

        const tempAssignments = {}; 
        let dealValid = true;
        
        for (const card of deck) {
            const startIdx = Math.floor(Math.random() * players.length);
            let assigned = false;
            for (let offset = 0; offset < players.length; offset++) {
                const pIdx = (startIdx + offset) % players.length;
                const p = players[pIdx];
                if (handSlots[p] > 0 && fixedGrid[card][p] !== 1) {
                    tempAssignments[card] = p;
                    handSlots[p]--;
                    assigned = true;
                    break;
                }
            }
            if (!assigned) { dealValid = false; break; }
        }
        if (!dealValid) continue;

        // Constraints Check
        let constraintsMet = true;
        for (const con of fixedConstraints) {
            let satisfies = false;
            for (const c of con.cards) {
                if (fixedGrid[c][con.player] === 2 || tempAssignments[c] === con.player) {
                    satisfies = true;
                    break;
                }
            }
            if (!satisfies) { constraintsMet = false; break; }
        }
        if (!constraintsMet) continue;

        // Success: Questo è un mondo valido!
        validWorlds++;
        solCounts[s]++; solCounts[w]++; solCounts[r]++;
        
        allCards.forEach(c => {
            if (fixedGrid[c].SOL !== 2 && !hypothesis.includes(c)) {
                if (tempAssignments[c]) playerCounts[c][tempAssignments[c]]++;
                else players.forEach(p => { if (fixedGrid[c][p] === 2) playerCounts[c][p]++; });
            }
        });
    }

    // FALLBACK
    if (validWorlds === 0) {
        // Se non ne troviamo nemmeno uno in MAX_ATTEMPTS, allora sì, usiamo fallback
        return createFallbackProbabilities(false);
    }

    // Normalizzazione
    const solResults = {};
    const distResults = {};
    const safeDiv = validWorlds; // Ora dividiamo per i mondi VALIDI trovati

    allCards.forEach(c => {
        if (grid[c].SOL === 2) solResults[c] = 1.0;
        else if (grid[c].SOL === 1) solResults[c] = 0.0;
        else solResults[c] = solCounts[c] / safeDiv;
        
        distResults[c] = {};
        players.forEach(p => {
            if (grid[c][p] === 2) distResults[c][p] = 1.0;
            else if (grid[c][p] === 1) distResults[c][p] = 0.0;
            else distResults[c][p] = playerCounts[c][p] / safeDiv;
        });
    });

    probabilityCache = { solution: solResults, distribution: distResults };
    return probabilityCache;
}

// Helper per evitare celle vuote quando MC fallisce
function createFallbackProbabilities(isZero) {
    const solRes = {};
    const distRes = {};
    
    allCards.forEach(c => {
        // Solution Fallback
        if (grid[c].SOL === 2) solRes[c] = 1.0;
        else if (grid[c].SOL === 1) solRes[c] = 0.0;
        else solRes[c] = isZero ? 0 : 0.01; // Marker value

        // Distribution Fallback
        distRes[c] = {};
        let possiblePlayers = [];
        players.forEach(p => {
            if (grid[c][p] === 2) distRes[c][p] = 1.0;
            else if (grid[c][p] === 1) distRes[c][p] = 0.0;
            else possiblePlayers.push(p);
        });
        
        if (possiblePlayers.length > 0 && !isZero) {
            const uniform = 1.0 / possiblePlayers.length;
            possiblePlayers.forEach(p => distRes[c][p] = uniform);
        } else {
            possiblePlayers.forEach(p => distRes[c][p] = 0);
        }
    });
    
    probabilityCache = { solution: solRes, distribution: distRes };
    return probabilityCache;
}