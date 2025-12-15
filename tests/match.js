// === CLUEDO REALISTIC MATCH SIMULATOR ===

(async function runRealisticSimulation() {

    // --- 1. CONFIGURAZIONE ---
    console.clear();
    const SIM_SPEED = 50; 
    const MAX_TURNS = 200;

    const HERO_NAME = "HERO";
    const OPPONENT_POOL = ["Alice", "Bob", "Charlie", "David", "Eve"];

    const DESIRED_OPPONENTS = 3; // NUMERO TOTALE DI AVVERSARI DESIDERATI

    function storyLog(icon, text, style = "") {
        console.log(`%c${icon} ${text}`, style || "color: #e5e7eb; border-left: 2px solid #333; padding-left: 8px;");
    }

    // --- 2. MOCK DOM ---
    const mockElements = {
        'current-position': { value: 'Ingresso' },
        'tactical-suggestions': { innerHTML: '' },
        'turn-asker': { value: '' },
        'turn-suspect': { value: '' },
        'turn-weapon': { value: '' },
        'turn-room': { value: '' },
        'turn-responder': { value: '' },
        'bluff-indicator': { style: {}, innerHTML: '' },
        'hand-counter-badge': { classList: { add:()=>{}, remove:()=>{} } },
        'log-area': { innerHTML: '' }
    };

    document.getElementById = function(id) {
        return mockElements[id] || { 
            value: '', innerHTML: '', style: {}, 
            classList: { add:()=>{}, remove:()=>{}, toggle:()=>{} },
            appendChild: ()=>{}, focus: ()=>{} 
        };
    };

    window.updateTurnUI = () => {}; window.renderGrid = () => {}; window.log = () => {}; 

    if (typeof initPathfinding === 'function') {
        initPathfinding();
        if (!TURN_MATRIX || Object.keys(TURN_MATRIX).length === 0) return console.error("❌ TURN_MATRIX vuota.");
    } else return console.error("❌ tactics.js mancante.");

    // --- 3. SETUP PARTITA ---
    const selectedOpponents = OPPONENT_POOL.slice(0, DESIRED_OPPONENTS);
    let seatOrder = [HERO_NAME, ...selectedOpponents].sort(() => Math.random() - 0.5);

    players = seatOrder;
    myName = HERO_NAME;
    grid = {};
    constraints = [];
    history = [];
    limits = {};
    isSimulating = false;

    allCards.forEach(c => { 
        grid[c] = { SOL: 0 }; 
        players.forEach(p => grid[c][p] = 0); 
    });

    // --- 4. CLASSE BOT & LOGICA ---
    let deck = [...allCards];
    const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
    const solution = [shuffle([...suspects])[0], shuffle([...weapons])[0], shuffle([...rooms])[0]];
    deck = deck.filter(c => !solution.includes(c));
    shuffle(deck);

    class SimPlayer {
        constructor(name, characterName) {
            this.name = name;
            this.character = characterName;
            this.hand = [];
            this.isEliminated = false;
            this.currentLocation = rooms[Math.floor(Math.random() * rooms.length)]; 
            this.targetLocation = null;
            this.squaresLeft = 0;
            this.inRoom = true; 
            this.wasDragged = false;
            
            this.knownSolution = { s: null, w: null, r: null };
            this.memory = { suspects: [...suspects], weapons: [...weapons], rooms: [...rooms] };
        }

        eliminate(card) {
            if (!this.memory.suspects.includes(card) && 
                !this.memory.weapons.includes(card) && 
                !this.memory.rooms.includes(card)) return;

            this.memory.suspects = this.memory.suspects.filter(c => c !== card);
            this.memory.weapons = this.memory.weapons.filter(c => c !== card);
            this.memory.rooms = this.memory.rooms.filter(c => c !== card);

            if (this.memory.suspects.length === 1) this.knownSolution.s = this.memory.suspects[0];
            if (this.memory.weapons.length === 1) this.knownSolution.w = this.memory.weapons[0];
            if (this.memory.rooms.length === 1) this.knownSolution.r = this.memory.rooms[0];
        }

        initMemory() { this.hand.forEach(c => this.eliminate(c)); }

        analyzeNoResponse(triplet) { 
            if (!this.hand.includes(triplet.s)) { this.knownSolution.s = triplet.s; this.memory.suspects = [triplet.s]; }
            if (!this.hand.includes(triplet.w)) { this.knownSolution.w = triplet.w; this.memory.weapons = [triplet.w]; }
            if (!this.hand.includes(triplet.r)) { this.knownSolution.r = triplet.r; this.memory.rooms = [triplet.r]; }
        }

        hasFullSolution() {
            return this.knownSolution.s && this.knownSolution.w && this.knownSolution.r;
        }

        getSolutionAttempt() {
            if (this.name === HERO_NAME) {
                const s = suspects.find(c => grid[c].SOL === 2);
                const w = weapons.find(c => grid[c].SOL === 2);
                const r = rooms.find(c => grid[c].SOL === 2);
                return (s && w && r) ? { s, w, r } : null;
            }
            return this.hasFullSolution() ? this.knownSolution : null;
        }

        // GENERAZIONE IPOTESI
        generateHypothesis(currentRoom) {
            const pick = (list, known) => known || (list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null);
            
            let s = pick(this.memory.suspects, this.knownSolution.s) || suspects[0];
            let w = pick(this.memory.weapons, this.knownSolution.w) || weapons[0];
            let r = currentRoom;

            // Bluff (20%)
            if (Math.random() < 0.2) {
                const mySuspects = this.hand.filter(c => suspects.includes(c));
                const myWeapons = this.hand.filter(c => weapons.includes(c));
                
                if (Math.random() < 0.5 && mySuspects.length > 0) {
                    s = mySuspects[Math.floor(Math.random() * mySuspects.length)];
                } else if (myWeapons.length > 0) {
                    w = myWeapons[Math.floor(Math.random() * myWeapons.length)];
                }
            }
            return { s, w, r };
        }
    }

    const simPlayers = players.map((p, i) => new SimPlayer(p, suspects[i] || "Unknown"));

    // Distribuzione
    let pIdx = 0;
    while(deck.length > 0) {
        simPlayers[pIdx].hand.push(deck.pop());
        pIdx = (pIdx + 1) % simPlayers.length;
    }
    simPlayers.forEach(p => p.initMemory());

    // Setup Solver
    const baseCount = Math.floor((allCards.length - 3) / players.length);
    const remainder = (allCards.length - 3) % players.length;
    players.forEach((p, index) => { limits[p] = baseCount + (index < remainder ? 1 : 0); });

    const heroPlayer = simPlayers.find(p => p.name === HERO_NAME);
    heroPlayer.hand.forEach(c => setFact(c, HERO_NAME, 2));

    let tokenPositions = {}; 
    suspects.forEach(s => {
        const owner = simPlayers.find(p => p.character === s);
        tokenPositions[s] = owner ? owner.currentLocation : rooms[Math.floor(Math.random() * rooms.length)];
    });

    function getDistance(from, to) { return ROOM_DISTANCES[from][to] || 99; }

    function updateTokenLocation(character, newRoom, isForcedDrag = false) {
        tokenPositions[character] = newRoom;
        const player = simPlayers.find(p => p.character === character);
        if (player && player.currentLocation !== newRoom) {
            player.currentLocation = newRoom;
            player.inRoom = true;
            player.squaresLeft = 0;
            if (isForcedDrag) {
                player.wasDragged = true;
                player.targetLocation = null; 
            } else if (player.targetLocation && newRoom !== player.targetLocation) {
                player.squaresLeft = getDistance(newRoom, player.targetLocation);
                player.inRoom = false; 
            }
        }
    }

    // --- 5. LOG AVVIO ---
    storyLog("🕵️", "CLUEDO MATCH SIMULATOR", "font-size: 1.2em; font-weight: bold; background: #333; color: #4ade80;");
    storyLog("🤫", `SOLUZIONE REALE: [${solution.join(", ")}]`, "color: #93c5fd; font-weight: bold;");
    storyLog("🃏", "DISTRIBUZIONE CARTE:", "color: #f472b6; font-weight: bold; margin-top: 5px;");
    simPlayers.forEach(p => {
        const isHero = p.name === HERO_NAME;
        const style = isHero ? "font-weight:bold; color: #10b981;" : "font-weight:bold; color: #fbbf24;";
        console.log(`   %c${p.name} (${p.hand.length}): %c${p.hand.join(", ")}`, style, "color: #e5e7eb;");
    });
    console.log("---------------------------------------------------");

    // --- HELPER DI GIOCO ---
    
    // Gestione Accusa
    function handleAccusation(player, accusation, turnCount) {
        if (!accusation) return false;

        storyLog("❗️", `ACCUSA DI ${player.name}: ${accusation.s}, ${accusation.w}, ${accusation.r}`, "background: #000; color: white; font-weight: bold; border: 2px solid red; padding: 4px;");
        
        const isWin = (accusation.s === solution[0] && accusation.w === solution[1] && accusation.r === solution[2]);
        
        if (isWin) {
            if (player.name === HERO_NAME) {
                storyLog("🏆", `VITTORIA! ${player.name} ha vinto in ${turnCount} turni.`, "background: green; color: white; font-weight: bold; border: 2px solid white; padding: 4px;");
            } else {
                storyLog("💥", `SCONFITTA! ${player.name} ha risolto il caso in ${turnCount} turni.`, "background: red; color: white; font-weight: bold; border: 2px solid white; padding: 4px;");
            }
            return { gameOver: true };
        } else {
            storyLog("💀", `ACCUSA ERRATA!`, "color: red;");
            player.isEliminated = true;
            return { gameOver: false };
        }
    }

    // --- 6. GAME LOOP ---
    let gameOver = false;
    let turnCount = 0;
    let currentPlayerIdx = Math.floor(Math.random() * players.length);
    let foundParts = { s: false, w: false, r: false };
    let solverWonLog = false;

    storyLog("🎲", `Dadi lanciati! Inizia: ${players[currentPlayerIdx]}`, "color: #a5b4fc;");

    while (!gameOver && turnCount < MAX_TURNS) {
        turnCount++;
        const currentPlayer = simPlayers[currentPlayerIdx];
        if (currentPlayer.isEliminated) {
            currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
            continue;
        }

        if (SIM_SPEED > 0) await new Promise(r => setTimeout(r, SIM_SPEED));

        const canStay = currentPlayer.wasDragged;
        currentPlayer.wasDragged = false;
        
        let moveLogTxt = `(Start: ${currentPlayer.currentLocation})`;
        if (canStay) moveLogTxt += " [DRAGGED]";
        storyLog("▶️", `T${turnCount}: ${currentPlayer.name} ${moveLogTxt}`, "font-weight: bold; color: #fbbf24; margin-top: 10px; border:none;");

        // 1. CHECK SOLUZIONE PRE-MOVE
        const preMoveSol = currentPlayer.getSolutionAttempt();
        if (preMoveSol) {
            currentPlayer.targetLocation = currentPlayer.currentLocation;
            currentPlayer.squaresLeft = 0;
            storyLog("🚨", `${currentPlayer.name} conosce la soluzione e procede con l'accusa.`, "color: cyan; font-weight:bold;");
        } else {
            // 2. MOVIMENTO
            const dice = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
            
            // --- CASO A: SEI NEL CORRIDOIO (Stai viaggiando) ---
            if (!currentPlayer.inRoom) {
                currentPlayer.squaresLeft -= dice;

                if (currentPlayer.squaresLeft <= 0) {
                    // ARRIVATO A DESTINAZIONE
                    updateTokenLocation(currentPlayer.character, currentPlayer.targetLocation);
                    storyLog("🏃", `Arriva in ${currentPlayer.targetLocation} (Dadi: ${dice})`, "color: #d1d5db;");
                    // Nota: Essendo arrivato, inRoom diventa true, ma siamo dentro l'IF del corridoio,
                    // quindi saltiamo il blocco "ELSE" qui sotto. Niente turno extra!
                } else {
                    // ANCORA IN VIAGGIO
                    storyLog("👣", `Prosegue verso ${currentPlayer.targetLocation} (Dadi: ${dice}, Mancano: ${currentPlayer.squaresLeft})`, "color: #6b7280;");
                }
            } 
            
            // --- CASO B: SEI IN UNA STANZA (Decidi dove andare) ---
            else {
                // LOGICA HERO
                if (currentPlayer.name === HERO_NAME) {
                    mockElements['current-position'].value = currentPlayer.currentLocation; 
                    let moves = calculateTacticalMoves(currentPlayer.currentLocation);
                    if (!canStay) moves = moves.filter(m => m.room !== currentPlayer.currentLocation);
                    
                    // Filtra solo le mosse valide col dado attuale
                    const valid = moves.filter(m => m.isCurrent || m.isSecret || m.dist <= dice);
                    
                    // Se non raggiungo nulla, prendo la mossa migliore ma vado in corridoio
                    const best = valid.length > 0 ? valid[0] : (moves[0] || null);

                    if (best) {
                        const isReachableNow = best.isCurrent || best.isSecret || best.dist <= dice;

                        if (isReachableNow) {
                            // Raggiungo subito la destinazione
                            currentPlayer.targetLocation = best.room;
                            updateTokenLocation(currentPlayer.character, best.room);
                            if (best.isSecret) storyLog("🚇", `Usa passaggio segreto -> ${best.room}`, "color: #9ca3af;");
                            else if (!best.isCurrent) storyLog("🏃", `Raggiunge ${best.room} (Dadi: ${dice})`, "color: #d1d5db;");
                            else storyLog("⚓️", "Resta nella stanza.", "color: #d1d5db;");
                        } else {
                            // Tiro insufficiente: Esco in corridoio
                            currentPlayer.targetLocation = best.room;
                            currentPlayer.inRoom = false; // Esco dalla stanza
                            currentPlayer.squaresLeft = best.dist - dice; // Sottraggo il dado
                            storyLog("🎲", `Tiro basso (${dice}), esce verso  ${best.room} (Mancano: ${currentPlayer.squaresLeft})`, "color: #6b7280;");
                        }
                    }
                } 
                // LOGICA BOT
                else {
                    if (canStay) {
                        currentPlayer.targetLocation = currentPlayer.currentLocation;
                        currentPlayer.squaresLeft = 0;
                        storyLog("⚓️", "Resta nella stanza.", "color: #d1d5db;");
                    } else {
                        const dists = ROOM_DISTANCES[currentPlayer.currentLocation];
                        let potential = Object.keys(dists).filter(r => r !== currentPlayer.currentLocation);
                        
                        // Stanze raggiungibili SUBITO
                        const reachable = potential.filter(r => dists[r] === 0 || dists[r] <= dice);

                        if (reachable.length > 0) {
                            // Il bot sceglie una stanza raggiungibile (priorità alla memoria)
                            const useful = reachable.filter(r => currentPlayer.memory.rooms.includes(r));
                            const dest = useful.length > 0 
                                ? useful[Math.floor(Math.random() * useful.length)] 
                                : reachable[Math.floor(Math.random() * reachable.length)];
                            
                            currentPlayer.squaresLeft = 0;
                            currentPlayer.targetLocation = dest;
                            updateTokenLocation(currentPlayer.character, dest);

                            if (dists[dest] === 0) storyLog("🚇", `Usa passaggio segreto -> ${dest}`, "color: #9ca3af;");
                            else storyLog("🏃", `Raggiunge ${dest} (Dadi: ${dice})`, "color: #d1d5db;");
                        } else {
                            // TIRO BASSO: Deve uscire nel corridoio
                            const dest = potential[Math.floor(Math.random() * potential.length)];
                            currentPlayer.targetLocation = dest;
                            
                            currentPlayer.inRoom = false; // Esco!
                            currentPlayer.squaresLeft = dists[dest] - dice; // Sottraggo il dado
                            
                            storyLog("🎲", `Tiro basso (${dice}), esce verso ${dest} (Mancano: ${currentPlayer.squaresLeft})`, "color: #6b7280;");
                        }
                    }
                }
            }
        }

        // 3. AZIONE
        if (currentPlayer.inRoom) {
            
            // ACCUSA
            const solAttempt = currentPlayer.getSolutionAttempt();
            const res = handleAccusation(currentPlayer, solAttempt, turnCount);
            if (res && res.gameOver) { gameOver = true; break; }

            // IPOTESI
            let hypothesis = { s: null, w: null, r: currentPlayer.currentLocation };
            if (currentPlayer.name === HERO_NAME) {
                const sug = generateHypothesisForRoom(currentPlayer.currentLocation);
                hypothesis.s = sug.suspect; hypothesis.w = sug.weapon;
                storyLog("🧠", `Indagine Hero: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`, "color: #93c5fd");
            } else {
                const h = currentPlayer.generateHypothesis(currentPlayer.currentLocation);
                hypothesis.s = h.s; hypothesis.w = h.w;
                storyLog("💬", `${currentPlayer.name} ipotizza: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`, "color: #93c5fd;");
            }

            if (tokenPositions[hypothesis.s] !== currentPlayer.currentLocation) {
                updateTokenLocation(hypothesis.s, currentPlayer.currentLocation, true);
            }

            // RISPOSTE
            let responder = null;
            let cardShown = null;
            
            for (let i = 1; i < players.length; i++) {
                const checkIdx = (currentPlayerIdx + i) % players.length;
                const checker = simPlayers[checkIdx];
                const matches = checker.hand.filter(c => c === hypothesis.s || c === hypothesis.w || c === hypothesis.r);

                if (matches.length > 0) {
                    responder = checker;
                    cardShown = matches[0]; 
                    storyLog("✋", `${responder.name} mostra ${cardShown} a ${currentPlayer.name}`, "color: #fca5a5;");
                    break;
                } else {
                    storyLog("❌", `${checker.name} passa`, "color: #4b5563;");
                    setFact(hypothesis.s, checker.name, 1);
                    setFact(hypothesis.w, checker.name, 1);
                    setFact(hypothesis.r, checker.name, 1);
                }
            }

            if (responder) {
                if (currentPlayer.name === HERO_NAME) {
                    setFact(cardShown, responder.name, 2); 
                    storyLog("👀", `Hai visto: ${cardShown}`, "color: #bef264");
                } else {
                    currentPlayer.eliminate(cardShown);
                }
                
                if (responder.name !== HERO_NAME && currentPlayer.name !== HERO_NAME) {
                    addConstraint(responder.name, [hypothesis.s, hypothesis.w, hypothesis.r]);
                }
            } else {
                storyLog("😱", `Nessuno può smentire!`, "color: #f472b6");
                if (currentPlayer.name === HERO_NAME) {
                    [hypothesis.s, hypothesis.w, hypothesis.r].forEach(c => {
                        if (grid[c][HERO_NAME] !== 2) grid[c].SOL = 2;
                    });
                } else {
                    currentPlayer.analyzeNoResponse(hypothesis);
                    if (currentPlayer.hasFullSolution()) {
                        storyLog("💡", `${currentPlayer.name} ha capito tutto! (Soluzione Confermata)`, "color: #fcd34d;");
                    } else {
                        storyLog("🤔", `${currentPlayer.name} ha dedotto una parte della soluzione...`, "color: #fcd34d;");
                    }
                }
            }

            try { runSolver(); } catch(e) {}

            // CHECK VISIVO SOLVER
            const solS = suspects.find(c => grid[c] && grid[c].SOL === 2);
            const solW = weapons.find(c => grid[c] && grid[c].SOL === 2);
            const solR = rooms.find(c => grid[c] && grid[c].SOL === 2);

            if (solS && !foundParts.s) { foundParts.s = true; storyLog("🧩", `IL SOLVER HA DEDOTTO IL COLPEVOLE: ${solS}`, "color: #10b981; font-weight: bold;"); }
            if (solW && !foundParts.w) { foundParts.w = true; storyLog("🧩", `IL SOLVER HA DEDOTTO L'ARMA: ${solW}`, "color: #10b981; font-weight: bold;"); }
            if (solR && !foundParts.r) { foundParts.r = true; storyLog("🧩", `IL SOLVER HA DEDOTTO LA STANZA: ${solR}`, "color: #10b981; font-weight: bold;"); }

            if (!solverWonLog && foundParts.s && foundParts.w && foundParts.r) {
                solverWonLog = true;
                storyLog("✅", `IL SOLVER HA RISOLTO IL CASO: ${solS}, ${solW}, ${solR}`, "background: #fff; color: #000; font-weight: bold; border: 2px solid #10b981; padding: 4px;");
            }

            // CHECK EPIFANIA IMMEDIATA
            const postMoveSol = currentPlayer.getSolutionAttempt();
            if (postMoveSol) {
                storyLog("⚡️", `${currentPlayer.name} ha trovato la soluzione e procede con l'accusa.`, "color: cyan; font-weight: bold;");
                const res = handleAccusation(currentPlayer, postMoveSol, turnCount);
                if (res && res.gameOver) { gameOver = true; break; }
            }
        }

        currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
    }

    if (!gameOver) storyLog("⌛", "FINE (Limite Turni)", "color: red;");
})();
