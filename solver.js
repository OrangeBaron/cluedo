// --- CONFIGURATION ---
const suspects = ["Scarlett", "Mustard", "White", "Green", "Peacock", "Plum"];
const weapons = ["Candeliere", "Pugnale", "Tubo", "Rivoltella", "Corda", "Chiave"];
const rooms = ["Ingresso", "Veranda", "Pranzo", "Cucina", "Ballo", "Serra", "Biliardo", "Biblioteca", "Studio"];
const allCards = [...suspects, ...weapons, ...rooms];
const CARDS_IN_DECK = suspects.length + weapons.length + rooms.length - 3;

// --- STATE VARIABLES ---
let players = [];
let grid = {};
let constraints = [];
let limits = {};
let history = [];
let isSimulating = false; // Flag per DeepScan

// --- CORE LOGIC & STATE MANAGEMENT ---

function setFact(card, player, status) {
    const currentStatus = grid[card][player];

    if (currentStatus !== 0 && currentStatus !== status) {
        if (isSimulating) throw "SIM_CONTRADICTION";
        log(`⚠️ <span class ="log-error">CONTRADDIZIONE: ${player} ${currentStatus === 1 ? 'non può' : 'deve'} avere ${card}.</span>`);
        return;
    }
    if (currentStatus === status) return;

    grid[card][player] = status;

    // Se è SI (2), tutti gli altri sono NO (1)
    if (status === 2) {
        players.forEach(p => { if (p !== player) setFact(card, p, 1); });
        grid[card].SOL = 1;
    }

    if (!isSimulating && typeof updateTacticalSuggestions === 'function') updateTacticalSuggestions();
}

function addConstraint(player, cards) {
    const possible = cards.filter(c => {
        let ownedByOther = false;
        players.forEach(p => { if(p !== player && grid[c][p] === 2) ownedByOther = true; });
        return !ownedByOther && grid[c][player] !== 1;
    });

    if(possible.length === 0) {
        log(`⚠️ <span class="log-error">CONTRADDIZIONE: ${player} non può avere nessuna di queste carte.</span>`);
        return;
    }

    if (possible.length === 1) {
        setFact(possible[0], player, 2);
        log(`⚡️ Deduzione Immediata: ${player} ha ${possible[0]}`);
        return;
    }
    
    const sortedPossible = [...possible].sort();
    const exists = constraints.some(con => 
        con.player === player && 
        JSON.stringify([...con.cards].sort()) === JSON.stringify(sortedPossible)
    );

    if (!exists) {
        constraints.push({ player: player, cards: possible });
        runSolver(); 
    }
}

function undoLastTurn() {
    if (history.length === 0) return alert("Nulla da annullare");
    const last = history.pop();
    grid = last.grid;
    constraints = last.constraints;
    currentTurnIndex = last.turnIndex;
    log(`⏪ UNDO eseguito.`);
    updateTurnUI();
    renderGrid();
}

// --- SOLVER ENGINE ---

function runSolver(fromSimulation = false) {
    let changed = true;
    let loops = 0;
    const maxLoops = fromSimulation ? 20 : 50; 

    try {
        while(changed && loops < maxLoops) {
            changed = false;
            const snap = JSON.stringify(grid);

            // 1. Pulizia vincoli soddisfatti
            const nCons = constraints.length;
            constraints = constraints.filter(con => !con.cards.some(c => grid[c][con.player] === 2));
            if (constraints.length !== nCons) changed = true;

            // 2. Matematica & Pigeonhole (Conteggi)
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
                if (found === limits[p] && unknown.length > 0) {
                    unknown.forEach(c => setFact(c, p, 1)); changed = true;
                }
                if (found < limits[p] && (found + unknown.length === limits[p]) && unknown.length > 0) {
                    unknown.forEach(c => setFact(c, p, 2)); changed = true;
                }
                if (limits[p] - found === 1) {
                    const pCons = constraints.filter(c => c.player === p);
                    if(pCons.length > 0) {
                        const valid = new Set();
                        pCons.forEach(con => con.cards.forEach(c => valid.add(c)));
                        unknown.forEach(u => {
                            if(!valid.has(u)) { setFact(u, p, 1); changed = true; }
                        });
                    }
                }
            });

            // 3. Risoluzione Vincoli Diretti
            constraints.forEach(con => {
                const possible = con.cards.filter(c => grid[c][con.player] !== 1);
                if (possible.length === 0 && isSimulating) throw "SIM_IMPOSSIBLE_CONSTRAINT";
                
                if (possible.length === 1 && grid[possible[0]][con.player] !== 2) {
                    setFact(possible[0], con.player, 2);
                    if(!isSimulating) log(`⚡️ Deduzione: ${con.player} ha ${possible[0]}`);
                    changed = true;
                }
            });

            // 4. Intersezione Vincoli
            players.forEach(p => {
                let knownHeld = 0;
                allCards.forEach(c => { if(grid[c][p] === 2) knownHeld++; });
                
                if ((limits[p] - knownHeld) === 1) {
                    const pCons = constraints.filter(c => c.player === p);
                    if (pCons.length >= 2) {
                        let intersection = pCons[0].cards.filter(c => grid[c][p] !== 1);
                        for (let i = 1; i < pCons.length; i++) {
                            intersection = intersection.filter(c => pCons[i].cards.includes(c));
                        }
                        if (intersection.length === 1 && grid[intersection[0]][p] !== 2) {
                            setFact(intersection[0], p, 2);
                            if(!isSimulating) log(`⚡️ Deduzione (Intersezione): ${p} ha ${intersection[0]}`);
                            changed = true;
                        }
                    }
                }
            });

            // 5. Global Solution Check
            allCards.forEach(c => {
                let allNo = true;
                players.forEach(p => { if (grid[c][p] !== 1) allNo = false; });
                if (allNo && grid[c].SOL !== 2) {
                    grid[c].SOL = 2;
                    if(!isSimulating) log(`🏆 SOLUZIONE TROVATA: ${c}`);
                    changed = true;
                }
            });
            
             // Categorie Eliminazione (Se ne restano 1 solo possibile, è la soluzione)
            [suspects, weapons, rooms].forEach(list => {
                let owned = 0, unk = [];
                list.forEach(c => { if(grid[c].SOL === 1) owned++; else if(grid[c].SOL === 0) unk.push(c); });
                if (owned === list.length - 1 && unk.length === 1 && grid[unk[0]].SOL !== 2) {
                    grid[unk[0]].SOL = 2;
                    if(!isSimulating) log(`🏆 SOLUZIONE (Eliminazione): ${unk[0]}`);
                    changed = true;
                }
            });

            // 6. ESCLUSIVITÀ SOLUZIONE
            [suspects, weapons, rooms].forEach(list => {
                const solution = list.find(c => grid[c].SOL === 2);
                if (solution) {
                    list.forEach(c => {
                        if (c !== solution && grid[c].SOL !== 1) {
                            grid[c].SOL = 1;
                            changed = true;
                        }
                    });
                }
            });

            // 7. PRINCIPIO DI ESISTENZA ("L'ultimo rimasto")
            allCards.forEach(c => {
                if (grid[c].SOL === 1) {
                    let possibleOwners = [];
                    players.forEach(p => {
                        if (grid[c][p] !== 1) possibleOwners.push(p);
                    });

                    if (possibleOwners.length === 1) {
                        const owner = possibleOwners[0];
                        if (grid[c][owner] !== 2) {
                            setFact(c, owner, 2);
                            if(!isSimulating) log(`⚡️ Deduzione (Esistenza): ${owner} ha ${c}`);
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
        console.error(e);
    }

    if (!fromSimulation && !isSimulating) {
        runDeepScan();
        renderGrid();
    }
}

function runDeepScan() {
    isSimulating = true;
    const candidates = [];
    allCards.forEach(c => {
        players.forEach(p => { if (grid[c][p] === 0) candidates.push({card: c, player: p}); });
    });

    for (const cand of candidates) {
        const savedGrid = JSON.stringify(grid);
        const savedConstraints = JSON.stringify(constraints);

        try {
            grid[cand.card][cand.player] = 2; // Ipotesi
            runSolver(true); 
            // Se ok, ripristina e continua
            grid = JSON.parse(savedGrid);
            constraints = JSON.parse(savedConstraints);
        } catch (e) {
            // Se crasha, l'ipotesi era impossibile
            grid = JSON.parse(savedGrid);
            constraints = JSON.parse(savedConstraints);
            isSimulating = false; 
            
            log(`🧠 Deep Scan: ${cand.player} NON può avere ${cand.card}`);
            setFact(cand.card, cand.player, 1); 
            
            runSolver(); // Rilancia solver reale
            return; 
        }
    }
    isSimulating = false;
}
