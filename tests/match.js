// === CLUEDO REALISTIC MATCH SIMULATOR ===

(async function runRealisticSimulation() {

    // --- 1. CONFIGURAZIONE AVANZATA ---
    console.clear();
    const SIM_SPEED = 50; 
    const MAX_TURNS = 200;

    const HERO_NAME = "HERO";
    const OPPONENT_POOL = ["Alice", "Bob", "Charlie", "David", "Eve"];

    // NUMERO TOTALE DI AVVERSARI DESIDERATI
    const DESIRED_OPPONENTS = 3; 

    function storyLog(icon, text, style = "") {
        console.log(`%c${icon} ${text}`, style || "color: #e5e7eb; border-left: 2px solid #333; padding-left: 8px;");
    }

    // --- 2. MOCK DOM & INIT ---
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

    // --- 3. SETUP RANDOMIZZATO ---
    const selectedOpponents = OPPONENT_POOL.slice(0, DESIRED_OPPONENTS);
    let seatOrder = [HERO_NAME, ...selectedOpponents];
    seatOrder.sort(() => Math.random() - 0.5);

    players = seatOrder;
    myName = HERO_NAME;

    grid = {};
    constraints = [];
    history = [];
    limits = {};
    isSimulating = false;

    // Init Griglia
    allCards.forEach(c => { 
        grid[c] = { SOL: 0 }; 
        players.forEach(p => grid[c][p] = 0); 
    });

    // --- 4. CLASSE SMART BOT ---
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
            
            // Memoria
            this.knownSolution = { s: null, w: null, r: null };
            this.memory = {
                suspects: [...suspects],
                weapons: [...weapons],
                rooms: [...rooms]
            };
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

        initMemory() {
            this.hand.forEach(c => this.eliminate(c));
        }

        analyzeNoResponse(triplet) { 
            if (!this.hand.includes(triplet.s)) {
                this.knownSolution.s = triplet.s;
                this.memory.suspects = [triplet.s];
            }
            if (!this.hand.includes(triplet.w)) {
                this.knownSolution.w = triplet.w;
                this.memory.weapons = [triplet.w];
            }
            if (!this.hand.includes(triplet.r)) {
                this.knownSolution.r = triplet.r;
                this.memory.rooms = [triplet.r];
            }
        }

        hasFullSolution() {
            return this.knownSolution.s && this.knownSolution.w && this.knownSolution.r;
        }

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

    // Creazione Bot
    const simPlayers = players.map((p, i) => new SimPlayer(p, suspects[i] || "Unknown"));

    // Distribuzione Carte
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

    function getDistance(from, to) {
        if (!from || !to || from === "Corridoio") return 99;
        return ROOM_DISTANCES[from][to];
    }

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
            }
            if (!isForcedDrag && player.targetLocation && newRoom !== player.targetLocation) {
                player.squaresLeft = getDistance(newRoom, player.targetLocation);
                player.inRoom = false; 
            }
        }
    }

    // --- 5. LOG AVVIO ---
    storyLog("🕵️", "CLUEDO MATCH SIMULATOR", "font-size: 1.2em; font-weight: bold; background: #333; color: #4ade80;");
    console.log(`%cGiocatori (${players.length}): [${players.join(", ")}]`, "color: #9ca3af");
    storyLog("🤫", `SOLUZIONE REALE: [${solution.join(", ")}]`, "color: #93c5fd; font-weight: bold;");

    console.log("%c🃏 DISTRIBUZIONE CARTE:", "color: #f472b6; font-weight: bold; margin-top: 5px;");
    simPlayers.forEach(p => {
        const isHero = p.name === HERO_NAME;
        const style = isHero ? "font-weight:bold; color: #10b981;" : "font-weight:bold; color: #fbbf24;";
        console.log(`   %c${p.name} (${p.hand.length}): %c${p.hand.join(", ")}`, style, "color: #e5e7eb;");
    });
    console.log("---------------------------------------------------");

    // --- 6. GAME LOOP ---
    let gameOver = false;
    let turnCount = 0;
    let currentPlayerIdx = Math.floor(Math.random() * players.length);
    console.log(`%c🎲 Dadi lanciati! Inizia: ${players[currentPlayerIdx]}`, "color: #a5b4fc;");

    let solverHasFoundSolution = false;
    let foundParts = { s: false, w: false, r: false };

    while (!gameOver && turnCount < MAX_TURNS) {
        turnCount++;
        const currentPlayer = simPlayers[currentPlayerIdx];
        if (currentPlayer.isEliminated) {
            currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
            continue;
        }

        if (SIM_SPEED > 0) await new Promise(r => setTimeout(r, SIM_SPEED));

        // --- A. MOVIMENTO ---
        const canStay = currentPlayer.wasDragged;
        currentPlayer.wasDragged = false; 
        
        let moveLogInfo = `(Start: ${currentPlayer.currentLocation})`;
        if (canStay) moveLogInfo += " [DRAGGED]";
        storyLog("▶️", `T${turnCount}: ${currentPlayer.name} ${moveLogInfo}`, "font-weight: bold; color: #fbbf24; margin-top: 10px; border:none;");

        const dice = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
        
        if (currentPlayer.inRoom && currentPlayer.squaresLeft <= 0) {
            
            // CHECK SOLUZIONE PRIMA DI MUOVERE
            let knownBeforeMove = false;
            if (currentPlayer.name === HERO_NAME) {
                if (grid[suspects.find(c => grid[c].SOL === 2)] && grid[weapons.find(c => grid[c].SOL === 2)] && grid[rooms.find(c => grid[c].SOL === 2)]) {
                    knownBeforeMove = true;
                }
            } else if (currentPlayer.hasFullSolution()) {
                knownBeforeMove = true;
            }

            if (knownBeforeMove) {
                // STOP: Non muoverti, resta qui per accusare
                currentPlayer.targetLocation = currentPlayer.currentLocation;
                currentPlayer.squaresLeft = 0;
                storyLog("🚨", `${currentPlayer.name} conosce la soluzione e procede con l'accusa.`, "color: cyan; font-weight:bold;");
            } 
            else if (currentPlayer.name === HERO_NAME) {
                // --- HERO MOVEMENT (CLEANED) ---
                mockElements['current-position'].value = currentPlayer.currentLocation; 
                let tacticalMoves = calculateTacticalMoves(currentPlayer.currentLocation);
                if (!canStay) tacticalMoves = tacticalMoves.filter(m => m.room !== currentPlayer.currentLocation);
                const reachableMoves = tacticalMoves.filter(m => m.isCurrent || m.isSecret || m.dist <= dice);
                const bestMove = reachableMoves.length > 0 ? reachableMoves[0] : (tacticalMoves[0] || null);

                if (bestMove) {
                    currentPlayer.targetLocation = bestMove.room; // Niente più check "Vittoria" inutile
                    
                    if (bestMove.isSecret) {
                        currentPlayer.squaresLeft = 0;
                        updateTokenLocation(currentPlayer.character, currentPlayer.targetLocation);
                        storyLog("🚇", `Usa passaggio segreto -> ${currentPlayer.targetLocation}`, "color: #9ca3af;");
                    } else if (bestMove.isCurrent) {
                        currentPlayer.squaresLeft = 0;
                        storyLog("⚓", "Sfrutta il trascinamento: Rimane nella stanza.", "color: #d1d5db;");
                    } else {
                        if (currentPlayer.targetLocation === currentPlayer.currentLocation) currentPlayer.squaresLeft = 0;
                        else currentPlayer.squaresLeft = getDistance(currentPlayer.currentLocation, currentPlayer.targetLocation);
                    }
                }
            } else {
                // --- BOT MOVEMENT (CLEANED) ---
                // Qui arrivano solo i bot che NON hanno la soluzione (gestiti da knownBeforeMove sopra)
                if (canStay) {
                    currentPlayer.targetLocation = currentPlayer.currentLocation;
                    currentPlayer.squaresLeft = 0;
                    storyLog("⚓", "Bot sfruttatore: Rimane nella stanza.", "color: #d1d5db;");
                } else {
                    const dists = ROOM_DISTANCES[currentPlayer.currentLocation];
                    let potentialMoves = Object.keys(dists).filter(r => r !== currentPlayer.currentLocation);
                    const reachableRooms = potentialMoves.filter(r => dists[r] === 0 || dists[r] <= dice);

                    if (reachableRooms.length > 0) {
                        const usefulRooms = reachableRooms.filter(r => currentPlayer.memory.rooms.includes(r));
                        const dest = usefulRooms.length > 0 
                            ? usefulRooms[Math.floor(Math.random() * usefulRooms.length)] 
                            : reachableRooms[Math.floor(Math.random() * reachableRooms.length)];
                        
                        currentPlayer.squaresLeft = 0;
                        currentPlayer.targetLocation = dest;
                        updateTokenLocation(currentPlayer.character, dest);
                        
                        if (dists[dest] === 0) storyLog("🚇", `Usa passaggio segreto -> ${dest}`, "color: #9ca3af;");
                        else storyLog("👣", `Raggiunge: ${dest} (Dadi: ${dice})`, "color: #d1d5db;");
                    } else {
                        const dest = potentialMoves[Math.floor(Math.random() * potentialMoves.length)];
                        currentPlayer.targetLocation = dest;
                        currentPlayer.squaresLeft = dists[dest];
                        storyLog("🎲", `Tiro basso (${dice}), si sposta verso ${dest}`, "color: #6b7280;");
                    }
                }
            }
        }

        // --- B. AZIONE ---
        if (currentPlayer.inRoom) {
            
            // 1. ACCUSA
            let accusation = null;
            if (currentPlayer.name === HERO_NAME) {
                const s = suspects.find(c => grid[c].SOL === 2);
                const w = weapons.find(c => grid[c].SOL === 2);
                const r = rooms.find(c => grid[c].SOL === 2);
                if (s && w && r) accusation = { s, w, r };
            } else if (currentPlayer.hasFullSolution()) {
                accusation = currentPlayer.knownSolution;
            }

            if (accusation) {
                storyLog("❗️", `ACCUSA DI ${currentPlayer.name}: ${accusation.s}, ${accusation.w}, ${accusation.r}`, "background: #000; font-weight: bold; color: white; border: 2px solid red; padding: 4px;");
                
                if (accusation.s === solution[0] && accusation.w === solution[1] && accusation.r === solution[2]) {
                    if (currentPlayer.name === HERO_NAME) {
                        storyLog("🏆", `VITTORIA! ${currentPlayer.name} ha vinto in ${turnCount} turni.`, "background: green; color: white; font-weight: bold; border: 2px solid white; padding: 4px;");
                    } else {
                        storyLog("💥", `SCONFITTA! ${currentPlayer.name} ha risolto il caso in ${turnCount} turni.`, "background: red; color: white; font-weight: bold; border: 2px solid white; padding: 4px;");
                    }
                    gameOver = true;
                    break;
                } else {
                    storyLog("💀", `ACCUSA ERRATA!`, "color: red;");
                    currentPlayer.isEliminated = true;
                }
            }

            // 2. IPOTESI
            let hypothesis = { s: null, w: null, r: currentPlayer.currentLocation };
            
            if (currentPlayer.name === HERO_NAME) {
                const suggestion = generateHypothesisForRoom(currentPlayer.currentLocation);
                hypothesis.s = suggestion.suspect;
                hypothesis.w = suggestion.weapon;
                storyLog("🧠", `Indagine Hero: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`, "color: #93c5fd");
            } else {
                const h = currentPlayer.generateHypothesis(currentPlayer.currentLocation);
                hypothesis.s = h.s;
                hypothesis.w = h.w;
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
                    storyLog("❌", `${checker.name} passa`, "color: #4b5563; font-size: 0.9em;");
                    // Hero registra i passaggi
                    setFact(hypothesis.s, checker.name, 1);
                    setFact(hypothesis.w, checker.name, 1);
                    setFact(hypothesis.r, checker.name, 1);
                }
            }

            if (responder) {
                if (currentPlayer.name === HERO_NAME) {
                    setFact(cardShown, responder.name, 2); 
                    storyLog("👀", `Hai visto: ${cardShown}`, "color: #bef264");
                } 
                else {
                    currentPlayer.eliminate(cardShown);
                }

                if (responder.name !== HERO_NAME && currentPlayer.name !== HERO_NAME) {
                    addConstraint(responder.name, [hypothesis.s, hypothesis.w, hypothesis.r]);
                }
            } else {
                // NESSUNO RISPONDE
                storyLog("😱", `Nessuno può smentire!`, "color: #f472b6");
                if (currentPlayer.name === HERO_NAME) {
                    [hypothesis.s, hypothesis.w, hypothesis.r].forEach(c => {
                        if (grid[c][HERO_NAME] !== 2) grid[c].SOL = 2;
                    });
                }
                else {
                    currentPlayer.analyzeNoResponse({s: hypothesis.s, w: hypothesis.w, r: hypothesis.r});
                    if (currentPlayer.hasFullSolution()) {
                        storyLog("💡", `${currentPlayer.name} ha capito tutto! (Soluzione Confermata)`, "color: #fcd34d;");
                    } else {
                        storyLog("🤔", `${currentPlayer.name} ha dedotto una parte della soluzione...`, "color: #fcd34d;");
                    }
                }
            }

            try { runSolver(); } catch(e) {}

            // --- Logica di controllo scoperte parziali (VISUAL ONLY) ---
            
            // 1. Controlla Sospettato
            const solS = suspects.find(c => grid[c] && grid[c].SOL === 2);
            if (solS && !foundParts.s) {
                foundParts.s = true;
                storyLog("🧩", `IL SOLVER HA DEDOTTO IL COLPEVOLE: ${solS}`, "color: #10b981; font-weight: bold;");
            }

            // 2. Controlla Arma
            const solW = weapons.find(c => grid[c] && grid[c].SOL === 2);
            if (solW && !foundParts.w) {
                foundParts.w = true;
                storyLog("🧩", `IL SOLVER HA DEDOTTO L'ARMA: ${solW}`, "color: #10b981; font-weight: bold;");
            }

            // 3. Controlla Stanza
            const solR = rooms.find(c => grid[c] && grid[c].SOL === 2);
            if (solR && !foundParts.r) {
                foundParts.r = true;
                storyLog("🧩", `IL SOLVER HA DEDOTTO LA STANZA: ${solR}`, "color: #10b981; font-weight: bold;");
            }

            // 4. Controlla Soluzione Completa (se non è già stata loggata)
            if (!solverHasFoundSolution && foundParts.s && foundParts.w && foundParts.r) {
                solverHasFoundSolution = true;
                storyLog("✅", `IL SOLVER HA RISOLTO IL CASO: ${solS}, ${solW}, ${solR}`, "background: #fff; color: #000; font-weight: bold; border: 2px solid #10b981; padding: 4px;");
            }

            // CHECK EPIFANIA IMMEDIATA (Stesso turno)
            let finalAcc = null;
            if (currentPlayer.name === HERO_NAME) {
                const s = suspects.find(c => grid[c].SOL === 2);
                const w = weapons.find(c => grid[c].SOL === 2);
                const r = rooms.find(c => grid[c].SOL === 2);
                if (s && w && r) finalAcc = { s, w, r };
            } else if (currentPlayer.hasFullSolution()) {
                finalAcc = currentPlayer.knownSolution;
            }

            if (finalAcc) {
                storyLog("⚡️", `${currentPlayer.name} ha trovato la soluzione e procede con l'accusa.`, "color: cyan; font-weight: bold;");
                storyLog("❗️", `ACCUSA DI ${currentPlayer.name}: ${finalAcc.s}, ${finalAcc.w}, ${finalAcc.r}`, "background: #000; font-weight: bold; color: white; border: 2px solid red; padding: 4px;");
                if (finalAcc.s === solution[0] && finalAcc.w === solution[1] && finalAcc.r === solution[2]) {
                    if (currentPlayer.name === HERO_NAME) storyLog("🏆", `VITTORIA! ${currentPlayer.name} ha vinto in ${turnCount} turni.`, "background: green; color: white; font-weight: bold; border: 2px solid white; padding: 4px;");
                    else storyLog("💥", `SCONFITTA! ${currentPlayer.name} ha risolto il caso in ${turnCount} turni.`, "background: red; color: white; font-weight: bold; border: 2px solid white; padding: 4px;");
                    gameOver = true;
                    break;
                } else {
                    storyLog("💀", `ACCUSA ERRATA!`, "color: red;");
                    currentPlayer.isEliminated = true;
                }
            }
        }

        currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
    }

    if (!gameOver) storyLog("⌛", "FINE (Limite Turni)", "color: red;");
})();
