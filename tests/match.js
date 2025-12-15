// === CLUEDO REALISTIC MATCH SIMULATOR ===

await (async function runRealisticSimulation() {

    // ======================================================
    // 1. CONFIGURAZIONE & TEMI LOG
    // ======================================================
    console.clear();
    const SIM_SPEED = 50; 
    const MAX_TURNS = 200;
    const HERO_NAME = "HERO";
    const OPPONENT_POOL = ["Alice", "Bob", "Charlie", "David", "Eve"];
    const DESIRED_OPPONENTS = 3; // Numero di avversari da simulare (max 5)

    // Palette Colori Semantica per la Console
    const LogTheme = {
        HEADER:     "color: #fbbf24; font-weight: bold;", // Ambra
        MOVE:       "color: #38bdf8;", // Ciano
        DICE:       "color: #94a3b8;", // Grigio bluastro
        HYPOTHESIS: "color: #c084fc;", // Viola chiaro
        RESPONSE:   "color: #f472b6;", // Rosa
        PASS:       "color: #6b7280;", // Grigio scuro
        HERO:       "color: #10b981; font-weight: bold;", // Smeraldo
        SOLVER:     "color: #bef264; font-weight: bold;", // Lime
        WIN:        "background: #065f46; color: white; font-weight: bold; padding: 4px; border: 1px solid #34d399;",
        FAIL:       "background: #991b1b; color: white; font-weight: bold; padding: 4px; border: 1px solid #f87171;",
        WARN:       "color: #fcd34d;", // Giallo allerta
        ERROR:      "color: #ef4444; font-weight: bold;" // Rosso
    };

    function storyLog(icon, text, style) {
        // Se non viene passato uno stile specifico, usa un default neutro
        const finalStyle = style || "color: #e5e7eb;";
        console.log(`%c${icon} ${text}`, finalStyle);
    }

    // ======================================================
    // 2. MOCK DOM & VALIDAZIONE AMBIENTE
    // ======================================================
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

    // Disabilita funzioni UI reali
    window.updateTurnUI = () => {}; window.renderGrid = () => {}; window.log = () => {}; 

    if (typeof initPathfinding === 'function') {
        initPathfinding();
        if (!TURN_MATRIX || Object.keys(TURN_MATRIX).length === 0) return console.error("❌ TURN_MATRIX vuota.");
    } else return console.error("❌ tactics.js mancante.");


    // ======================================================
    // 3. STATO DELLA SIMULAZIONE
    // ======================================================
    const selectedOpponents = OPPONENT_POOL.slice(0, DESIRED_OPPONENTS);
    let seatOrder = [HERO_NAME, ...selectedOpponents].sort(() => Math.random() - 0.5);

    players = seatOrder;
    myName = HERO_NAME;
    grid = {};
    constraints = [];
    history = [];
    limits = {};
    isSimulating = false;

    // Init Griglia Solver
    allCards.forEach(c => { 
        grid[c] = { SOL: 0 }; 
        players.forEach(p => grid[c][p] = 0); 
    });

    // Setup Mazzo e Soluzione
    let deck = [...allCards];
    const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
    const solution = [shuffle([...suspects])[0], shuffle([...weapons])[0], shuffle([...rooms])[0]];
    deck = deck.filter(c => !solution.includes(c));
    shuffle(deck);


    // ======================================================
    // 4. CLASSE SIM PLAYER
    // ======================================================
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
            // Rimuove carta dalle possibilità
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
            // Se nessuno risponde, le carte sono la soluzione (a meno che non le abbia io)
            if (!this.hand.includes(triplet.s)) { this.knownSolution.s = triplet.s; this.memory.suspects = [triplet.s]; }
            if (!this.hand.includes(triplet.w)) { this.knownSolution.w = triplet.w; this.memory.weapons = [triplet.w]; }
            if (!this.hand.includes(triplet.r)) { this.knownSolution.r = triplet.r; this.memory.rooms = [triplet.r]; }
        }

        hasFullSolution() {
            return this.knownSolution.s && this.knownSolution.w && this.knownSolution.r;
        }

        getSolutionAttempt() {
            // HERO usa il solver globale, BOT usa la memoria locale
            if (this.name === HERO_NAME) {
                const s = suspects.find(c => grid[c].SOL === 2);
                const w = weapons.find(c => grid[c].SOL === 2);
                const r = rooms.find(c => grid[c].SOL === 2);
                return (s && w && r) ? { s, w, r } : null;
            }
            return this.hasFullSolution() ? this.knownSolution : null;
        }

        generateHypothesis(currentRoom) {
            const pick = (list, known) => known || (list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null);
            
            let s = pick(this.memory.suspects, this.knownSolution.s) || suspects[0];
            let w = pick(this.memory.weapons, this.knownSolution.w) || weapons[0];
            let r = currentRoom;

            // Bluff (20% chance)
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

    // Inizializzazione Giocatori
    const simPlayers = players.map((p, i) => new SimPlayer(p, suspects[i] || "Unknown"));

    // Distribuzione Carte
    let pIdx = 0;
    while(deck.length > 0) {
        simPlayers[pIdx].hand.push(deck.pop());
        pIdx = (pIdx + 1) % simPlayers.length;
    }
    simPlayers.forEach(p => p.initMemory());

    // Configurazione Limiti Solver e Mano Eroe
    const baseCount = Math.floor((allCards.length - 3) / players.length);
    const remainder = (allCards.length - 3) % players.length;
    players.forEach((p, index) => { limits[p] = baseCount + (index < remainder ? 1 : 0); });

    const heroPlayer = simPlayers.find(p => p.name === HERO_NAME);
    heroPlayer.hand.forEach(c => setFact(c, HERO_NAME, 2));

    // Gestione Posizione Pedine (Token)
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


    // ======================================================
    // 5. START LOG
    // ======================================================
    storyLog("🕵️", "CLUEDO MATCH SIMULATOR", "font-size: 1.4em; font-weight: bold; background: #111; color: #4ade80; padding: 4px; border: 1px solid #4ade80;");

    console.groupCollapsed("🤫 Soluzione %c(Clicca per mostrare)", "color:#6b7280;");
    console.log(`%c[${solution.join(", ")}]`, "color: #93c5fd; font-weight: bold;");
    console.groupEnd();
    
    console.group("🃏 Distribuzione Carte");
    console.log(`%c${HERO_NAME} (${heroPlayer.hand.length}): %c${heroPlayer.hand.join(", ")}`, LogTheme.HERO, "color: #e5e7eb;");
    console.groupCollapsed("Altri Giocatori %c(Clicca per mostrare)", "color:#6b7280;");
    simPlayers.forEach(p => {
        if (p.name === HERO_NAME) return;
        console.log(`%c${p.name} (${p.hand.length}): %c${p.hand.join(", ")}`, LogTheme.HEADER, "color: #e5e7eb;");
    });
    console.groupEnd();
    console.groupEnd();


    // ======================================================
    // 6. HELPER FASI DI GIOCO
    // ======================================================

    function handleAccusation(player, accusation, turnCount) {
        if (!accusation) return false;

        storyLog("🫵", `ACCUSA DI ${player.name}: ${accusation.s}, ${accusation.w}, ${accusation.r}`, "color: #f87171; font-weight: bold;");
        
        const isWin = (accusation.s === solution[0] && accusation.w === solution[1] && accusation.r === solution[2]);
        
        if (isWin) {
            if (player.name === HERO_NAME) {
                storyLog("🏆", `VITTORIA! ${player.name} ha vinto in ${turnCount} turni.`, LogTheme.WIN);
            } else {
                storyLog("💥", `SCONFITTA! ${player.name} ha risolto il caso in ${turnCount} turni.`, LogTheme.FAIL);
            }
            return { gameOver: true };
        } else {
            storyLog("💀", `ACCUSA ERRATA! ${player.name} eliminato.`, LogTheme.ERROR);
            player.isEliminated = true;
            return { gameOver: false };
        }
    }

    // FASE 1: MOVIMENTO
    function handleMovementPhase(player) {
        const canStay = player.wasDragged;
        player.wasDragged = false; // Reset flag
        
        // Log inizio turno
        let style = (player.name === HERO_NAME) ? LogTheme.HERO : LogTheme.HEADER;
        let headerTxt = `(Posizione: ${player.currentLocation}${canStay ? ", può restare" : ""})`;
        storyLog("▶️", `T${turnCount}: ${player.name} ${headerTxt}`, style);

        // Check Epifania Pre-Movimento (se so già la soluzione, non mi muovo, accuso)
        const preMoveSol = player.getSolutionAttempt();
        if (preMoveSol) {
            player.targetLocation = player.currentLocation;
            player.squaresLeft = 0;
            storyLog("🚨", `${player.name} conosce la soluzione e procede con l'accusa.`, LogTheme.WARN);
            return; // Salta il movimento fisico
        }

        const dice = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
        
        // --- CASO A: IN VIAGGIO (Corridoio) ---
        if (!player.inRoom) {
            player.squaresLeft -= dice;
            if (player.squaresLeft <= 0) {
                // Arrivato
                updateTokenLocation(player.character, player.targetLocation);
                storyLog("🏃", `Arriva in ${player.targetLocation} (Dadi: ${dice})`, LogTheme.MOVE);
            } else {
                // Ancora in viaggio
                storyLog("👣", `Prosegue verso ${player.targetLocation} (Dadi: ${dice}, Mancano: ${player.squaresLeft})`, LogTheme.DICE);
            }
            return;
        }

        // --- CASO B: SCELTA STANZA ---
        
        // LOGICA HERO
        if (player.name === HERO_NAME) {
            mockElements['current-position'].value = player.currentLocation; 
            let moves = calculateTacticalMoves(player.currentLocation);
            
            // Se sono stato trascinato, posso stare, altrimenti devo muovermi
            if (!canStay) moves = moves.filter(m => m.room !== player.currentLocation);
            
            // Filtro mosse valide col dado
            const valid = moves.filter(m => m.isCurrent || m.isSecret || m.dist <= dice);
            const best = valid.length > 0 ? valid[0] : (moves[0] || null);

            if (best) {
                const isReachableNow = best.isCurrent || best.isSecret || best.dist <= dice;

                if (isReachableNow) {
                    player.targetLocation = best.room;
                    updateTokenLocation(player.character, best.room);
                    if (best.isSecret) storyLog("🚇", `Usa passaggio segreto -> ${best.room}`, LogTheme.MOVE);
                    else if (!best.isCurrent) storyLog("🏃", `Raggiunge ${best.room} (Dadi: ${dice})`, LogTheme.MOVE);
                    else storyLog("⚓️", "Resta nella stanza.", LogTheme.MOVE);
                } else {
                    // Tiro insufficiente: esco in corridoio
                    player.targetLocation = best.room;
                    player.inRoom = false;
                    player.squaresLeft = best.dist - dice;
                    storyLog("🎲", `Tiro basso (${dice}), esce verso ${best.room} (Mancano: ${player.squaresLeft})`, LogTheme.DICE);
                }
            }
        } 
        // LOGICA BOT
        else {
            if (canStay) {
                player.targetLocation = player.currentLocation;
                player.squaresLeft = 0;
                storyLog("⚓️", "Resta nella stanza.", LogTheme.MOVE);
            } else {
                const dists = ROOM_DISTANCES[player.currentLocation];
                let potential = Object.keys(dists).filter(r => r !== player.currentLocation);
                const reachable = potential.filter(r => dists[r] === 0 || dists[r] <= dice);

                if (reachable.length > 0) {
                    // Bot sceglie a caso tra le raggiungibili (o preferisce quelle utili alla memoria)
                    const useful = reachable.filter(r => player.memory.rooms.includes(r));
                    const dest = useful.length > 0 
                        ? useful[Math.floor(Math.random() * useful.length)] 
                        : reachable[Math.floor(Math.random() * reachable.length)];
                    
                    player.squaresLeft = 0;
                    player.targetLocation = dest;
                    updateTokenLocation(player.character, dest);

                    if (dists[dest] === 0) storyLog("🚇", `Usa passaggio segreto -> ${dest}`, LogTheme.MOVE);
                    else storyLog("🏃", `Raggiunge ${dest} (Dadi: ${dice})`, LogTheme.MOVE);
                } else {
                    // Tiro basso -> Corridoio
                    const dest = potential[Math.floor(Math.random() * potential.length)];
                    player.targetLocation = dest;
                    player.inRoom = false;
                    player.squaresLeft = dists[dest] - dice;
                    storyLog("🎲", `Tiro basso (${dice}), esce verso ${dest} (Mancano: ${player.squaresLeft})`, LogTheme.DICE);
                }
            }
        }
    }

    // FASE 2: RISPOSTE AGLI INTERROGATORI
    function handleResponsePhase(asker, hypothesis, askerIdx) {
        let responder = null;
        let cardShown = null;
        
        // Iteriamo sui giocatori in senso orario
        for (let i = 1; i < players.length; i++) {
            const checkIdx = (askerIdx + i) % players.length;
            const checker = simPlayers[checkIdx];
            const matches = checker.hand.filter(c => c === hypothesis.s || c === hypothesis.w || c === hypothesis.r);

            if (matches.length > 0) {
                responder = checker;
                cardShown = matches[0];
                console.groupCollapsed(`✋ %c${responder.name} mostra una carta a ${asker.name} %c(Mostra)`, LogTheme.RESPONSE, "color:#6b7280;");
                console.log(`%cCarta mostrata: %c${cardShown}`, LogTheme.RESPONSE, "color: #e5e7eb;");
                console.groupEnd();
                break;
            } else {
                storyLog("❌", `${checker.name} passa`, LogTheme.PASS);
                setFact(hypothesis.s, checker.name, 1);
                setFact(hypothesis.w, checker.name, 1);
                setFact(hypothesis.r, checker.name, 1);
            }
        }

        if (responder) {
            if (asker.name === HERO_NAME) {
                setFact(cardShown, responder.name, 2); 
                storyLog("👀", `Hai visto: ${cardShown}`, LogTheme.HERO);
            } else {
                asker.eliminate(cardShown);
            }
            
            // Se nessuno dei due sono io, registro il vincolo
            if (responder.name !== HERO_NAME && asker.name !== HERO_NAME) {
                addConstraint(responder.name, [hypothesis.s, hypothesis.w, hypothesis.r]);
            }
        } else {
            storyLog("😱", `Nessuno può smentire!`, LogTheme.WARN);
            if (asker.name === HERO_NAME) {
                [hypothesis.s, hypothesis.w, hypothesis.r].forEach(c => {
                    if (grid[c][HERO_NAME] !== 2) grid[c].SOL = 2;
                });
            } else {
                asker.analyzeNoResponse(hypothesis);
                if (asker.hasFullSolution()) {
                    storyLog("💡", `${asker.name} ha capito tutto!`, LogTheme.WARN);
                } else {
                    storyLog("🤔", `${asker.name} ha dedotto una parte della soluzione...`, LogTheme.WARN);
                }
            }
        }
    }

    // CHECK VITTORIA SOLVER (Solo UI)
    let foundParts = { s: false, w: false, r: false };
    let solverWonLog = false;
    function checkSolverProgress() {
        try { runSolver(); } catch(e) {}

        const solS = suspects.find(c => grid[c] && grid[c].SOL === 2);
        const solW = weapons.find(c => grid[c] && grid[c].SOL === 2);
        const solR = rooms.find(c => grid[c] && grid[c].SOL === 2);

        if (solS && !foundParts.s) { foundParts.s = true; storyLog("🧩", `IL SOLVER HA DEDOTTO IL COLPEVOLE: ${solS}`, LogTheme.SOLVER); }
        if (solW && !foundParts.w) { foundParts.w = true; storyLog("🧩", `IL SOLVER HA DEDOTTO L'ARMA: ${solW}`, LogTheme.SOLVER); }
        if (solR && !foundParts.r) { foundParts.r = true; storyLog("🧩", `IL SOLVER HA DEDOTTO LA STANZA: ${solR}`, LogTheme.SOLVER); }

        if (!solverWonLog && foundParts.s && foundParts.w && foundParts.r) {
            solverWonLog = true;
            storyLog("✅", `IL SOLVER HA RISOLTO IL CASO: ${solS}, ${solW}, ${solR}`, LogTheme.WIN);
        }
    }


    // ======================================================
    // 7. GAME LOOP PRINCIPALE
    // ======================================================
    let gameOver = false;
    let turnCount = 0;
    let currentPlayerIdx = Math.floor(Math.random() * players.length);

    storyLog("🎲", `Dadi lanciati! Inizia: ${players[currentPlayerIdx]}`, "color: #a5b4fc;");

    while (!gameOver && turnCount < MAX_TURNS) {
        turnCount++;
        const currentPlayer = simPlayers[currentPlayerIdx];

        if (currentPlayer.isEliminated) {
            currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
            continue;
        }

        if (SIM_SPEED > 0) await new Promise(r => setTimeout(r, SIM_SPEED));

        // 1. MOVIMENTO
        handleMovementPhase(currentPlayer);

        // 2. AZIONE (Se in stanza)
        if (currentPlayer.inRoom) {
            
            // A. TENTATIVO ACCUSA (Epifania o calcolo)
            const solAttempt = currentPlayer.getSolutionAttempt();
            const res = handleAccusation(currentPlayer, solAttempt, turnCount);
            if (res && res.gameOver) { gameOver = true; break; }

            // B. FORMULAZIONE IPOTESI
            let hypothesis = { s: null, w: null, r: currentPlayer.currentLocation };
            
            if (currentPlayer.name === HERO_NAME) {
                const sug = generateHypothesisForRoom(currentPlayer.currentLocation);
                hypothesis.s = sug.suspect; hypothesis.w = sug.weapon;
                storyLog("🧠", `Indagine Hero: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`, LogTheme.HYPOTHESIS);
            } else {
                const h = currentPlayer.generateHypothesis(currentPlayer.currentLocation);
                hypothesis.s = h.s; hypothesis.w = h.w;
                storyLog("💬", `${currentPlayer.name} ipotizza: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`, LogTheme.HYPOTHESIS);
            }

            // Trascinamento del sospettato nella stanza corrente
            if (tokenPositions[hypothesis.s] !== currentPlayer.currentLocation) {
                updateTokenLocation(hypothesis.s, currentPlayer.currentLocation, true);
            }

            // C. FASE RISPOSTE
            handleResponsePhase(currentPlayer, hypothesis, currentPlayerIdx);

            // D. ESECUZIONE SOLVER
            checkSolverProgress();

            // E. CHECK EPIFANIA IMMEDIATA (Post-Risposta)
            // Se ho appena scoperto l'ultimo pezzo, accuso subito nello stesso turno
            const postMoveSol = currentPlayer.getSolutionAttempt();
            if (postMoveSol) {
                storyLog("⚡️", `${currentPlayer.name} ha trovato la soluzione e procede con l'accusa.`, LogTheme.WARN);
                const res = handleAccusation(currentPlayer, postMoveSol, turnCount);
                if (res && res.gameOver) { gameOver = true; break; }
            }
        }

        currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
    }

    if (!gameOver) storyLog("⌛", "FINE (Limite Turni)", LogTheme.FAIL);

})();
