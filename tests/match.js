// === CLUEDO REALISTIC MATCH SIMULATOR ===

(async function runRealisticSimulation() {

    // --- 1. CONFIGURAZIONE ---
    console.clear();
    const SIM_SPEED = 50; 
    const MAX_TURNS = 200;
    const HERO_NAME = "HERO"; 
    const OPPONENT_NAMES = ["Mustard", "Green", "Peacock"]; 

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

    // --- 3. RESET DATI ---
    players = [HERO_NAME, ...OPPONENT_NAMES];
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

    // --- 4. CLASSE SMART BOT (INFALLIBILE) ---
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
            
            // --- MEMORIA PERFETTA ---
            this.knownSolution = { s: null, w: null, r: null };
            // Liste di "Sospettati Possibili" (inizialmente tutti)
            this.memory = {
                suspects: [...suspects],
                weapons: [...weapons],
                rooms: [...rooms]
            };
        }

        // Rimuove una carta dai possibili candidati (perché vista o posseduta)
        eliminate(card) {
            // Se la carta è già eliminata, ignora
            if (!this.memory.suspects.includes(card) && 
                !this.memory.weapons.includes(card) && 
                !this.memory.rooms.includes(card)) return;

            this.memory.suspects = this.memory.suspects.filter(c => c !== card);
            this.memory.weapons = this.memory.weapons.filter(c => c !== card);
            this.memory.rooms = this.memory.rooms.filter(c => c !== card);

            // CONTROLLO PER ESCLUSIONE: Se rimane solo 1 opzione, è la soluzione
            if (this.memory.suspects.length === 1) this.knownSolution.s = this.memory.suspects[0];
            if (this.memory.weapons.length === 1) this.knownSolution.w = this.memory.weapons[0];
            if (this.memory.rooms.length === 1) this.knownSolution.r = this.memory.rooms[0];
        }

        initMemory() {
            // Un bot sa che le carte che ha in mano NON sono la soluzione
            this.hand.forEach(c => this.eliminate(c));
        }

        // Analizza il silenzio degli avversari
        analyzeNoResponse(triplet) { // triplet = {s, w, r}
            // Logica Infallibile:
            // Se nessuno ha risposto, le carte della tripletta sono la soluzione...
            // ...A MENO CHE non siano carte che ho io in mano!
            
            if (!this.hand.includes(triplet.s)) {
                this.knownSolution.s = triplet.s;
                this.memory.suspects = [triplet.s]; // Resetta memoria sugli altri
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
            // 1. Sceglie carte dalla memoria (Ignoti)
            // Se sa già la soluzione di una categoria, usa quella (per confermare o chiudere)
            // Se la lista è vuota (caso limite), pesca a caso
            const pick = (list, known) => known || (list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null);
            
            let s = pick(this.memory.suspects, this.knownSolution.s) || suspects[0];
            let w = pick(this.memory.weapons, this.knownSolution.w) || weapons[0];
            let r = currentRoom;

            // 2. Logica Bluff (20% chance)
            // Sostituisce una carta ignota con una carta in mano per confondere
            if (Math.random() < 0.2) {
                const mySuspects = this.hand.filter(c => suspects.includes(c));
                const myWeapons = this.hand.filter(c => weapons.includes(c));
                
                // Bluffa sul sospettato
                if (Math.random() < 0.5 && mySuspects.length > 0) {
                    s = mySuspects[Math.floor(Math.random() * mySuspects.length)];
                } 
                // Bluffa sull'arma
                else if (myWeapons.length > 0) {
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

    // Setup Hero limits
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
    storyLog("🤫", `SOLUZIONE REALE: [${solution.join(", ")}]`, "color: #93c5fd; font-weight: bold;");
    
    console.log("%c🃏 DISTRIBUZIONE CARTE:", "color: #f472b6; font-weight: bold; margin-top: 5px;");
    simPlayers.forEach(p => {
         console.log(`   %c${p.name}: %c${p.hand.join(", ")}`, "font-weight:bold; color: #fbbf24;", "color: #e5e7eb;");
    });
    console.log("---------------------------------------------------");

    // --- 6. GAME LOOP ---
    let gameOver = false;
    let turnCount = 0;
    let currentPlayerIdx = 0;

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
            if (currentPlayer.name === HERO_NAME) {
                // ... (Logica Movimento Hero Invariata) ...
                mockElements['current-position'].value = currentPlayer.currentLocation; 
                let tacticalMoves = calculateTacticalMoves(currentPlayer.currentLocation);
                if (!canStay) tacticalMoves = tacticalMoves.filter(m => m.room !== currentPlayer.currentLocation);
                const reachableMoves = tacticalMoves.filter(m => m.isCurrent || m.isSecret || m.dist <= dice);
                const bestMove = reachableMoves.length > 0 ? reachableMoves[0] : (tacticalMoves[0] || null);

                if (bestMove) {
                    if (bestMove.hypothesis && bestMove.hypothesis.type === "Vittoria") {
                         currentPlayer.targetLocation = bestMove.room;
                         storyLog("🤖", `SOLVER CORRE A VINCERE: ${currentPlayer.targetLocation}`, "color: #a7f3d0");
                    } else currentPlayer.targetLocation = bestMove.room; 
                    
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
                // --- BOT MOVEMENT ---
                // Se ha la soluzione, cerca di andare nella stanza del delitto
                if (currentPlayer.hasFullSolution()) {
                    const goal = currentPlayer.knownSolution.r;
                    if (currentPlayer.currentLocation === goal) {
                        // È già lì, sta fermo per accusare
                        currentPlayer.targetLocation = currentPlayer.currentLocation;
                        currentPlayer.squaresLeft = 0;
                        storyLog("🚨", `Bot ha la soluzione! Resta in ${goal} per accusare.`, "color: red; font-weight:bold;");
                    } else {
                        // Cerca di andare verso il goal
                        // (Logica semplificata: se raggiungibile va, altrimenti si avvicina)
                        currentPlayer.targetLocation = goal;
                        const dist = getDistance(currentPlayer.currentLocation, goal);
                        if (dist <= dice) {
                            currentPlayer.squaresLeft = 0; // Arriva
                            updateTokenLocation(currentPlayer.character, goal);
                            storyLog("🚨", `Bot corre alla scena del crimine: ${goal}`, "color: red;");
                        } else {
                             // Si avvicina (semplificato, simuliamo solo spostamento pedina)
                             // In un gioco reale servirebbe pathfinding complesso, qui assumiamo si avvicini
                             currentPlayer.squaresLeft = dist - dice; 
                             storyLog("👣", `Bot si avvicina a ${goal}...`, "color: #d1d5db;");
                        }
                    }
                } 
                // Movimento Standard (Investigazione)
                else {
                    if (canStay) {
                        currentPlayer.targetLocation = currentPlayer.currentLocation;
                        currentPlayer.squaresLeft = 0;
                        storyLog("⚓", "Bot sfruttatore: Rimane nella stanza.", "color: #d1d5db;");
                    } else {
                        const dists = ROOM_DISTANCES[currentPlayer.currentLocation];
                        let potentialMoves = Object.keys(dists).filter(r => r !== currentPlayer.currentLocation);
                        const reachableRooms = potentialMoves.filter(r => dists[r] === 0 || dists[r] <= dice);

                        if (reachableRooms.length > 0) {
                            // Preferisce stanze ignote
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
                            // Nulla raggiungibile, muovi a caso verso una direzione
                            const dest = potentialMoves[Math.floor(Math.random() * potentialMoves.length)];
                            currentPlayer.targetLocation = dest;
                            currentPlayer.squaresLeft = dists[dest];
                            storyLog("🎲", `Tiro basso (${dice}), si sposta verso ${dest}`, "color: #6b7280;");
                        }
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
                // Il bot accusa SOLO se è sicuro al 100%
                accusation = currentPlayer.knownSolution;
            }

            if (accusation) {
                // Verifica finale stanza (Regola Cluedo: devi essere nella stanza che accusi)
                // Per il simulatore, concediamo l'accusa anche se il bot è arrivato in una stanza diversa
                // pur di chiudere il match, o forziamo la coerenza. 
                // Forziamo coerenza leggera: Accusa valida.
                
                storyLog("🏆", `ACCUSA DI ${currentPlayer.name}: ${accusation.s}, ${accusation.w}, ${accusation.r}`, "font-size: 1.2em; font-weight: bold; color: gold; border: 2px solid gold; padding: 10px;");
                
                if (accusation.s === solution[0] && accusation.w === solution[1] && accusation.r === solution[2]) {
                    storyLog("🎉", `VITTORIA! ${currentPlayer.name} ha vinto in ${turnCount} turni.`, "background: green; color: white; padding: 5px;");
                    gameOver = true;
                    break;
                } else {
                    storyLog("💀", `ACCUSA ERRATA! (Impossibile con logica infallibile?)`, "color: red;");
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
                // Smart Bot Hypothesis
                const h = currentPlayer.generateHypothesis(currentPlayer.currentLocation);
                hypothesis.s = h.s;
                hypothesis.w = h.w;
                storyLog("💬", `${currentPlayer.name} ipotizza: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`, "color: #d1d5db;");
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
                    storyLog("✋", `${checker.name} mostra una carta a ${currentPlayer.name}`, "color: #fca5a5; font-weight: bold;");
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
                // A. HERO vede
                if (currentPlayer.name === HERO_NAME) {
                    setFact(cardShown, responder.name, 2); 
                    storyLog("👀", `Hai visto: ${cardShown}`, "color: #bef264");
                } 
                // B. BOT vede -> Elimina dalla memoria dei colpevoli
                else if (currentPlayer.name !== HERO_NAME) {
                    currentPlayer.eliminate(cardShown);
                }

                // Vincoli per Hero
                if (responder.name !== HERO_NAME && currentPlayer.name !== HERO_NAME) {
                    addConstraint(responder.name, [hypothesis.s, hypothesis.w, hypothesis.r]);
                }
            } else {
                // --- NESSUNO RISPONDE ---
                
                // 1. HERO
                if (currentPlayer.name === HERO_NAME) {
                    [hypothesis.s, hypothesis.w, hypothesis.r].forEach(c => {
                        if (grid[c][HERO_NAME] !== 2) grid[c].SOL = 2;
                    });
                }
                // 2. BOT -> ANALISI INFALLIBILE
                else {
                    // Analizza la tripletta filtrando le proprie carte
                    currentPlayer.analyzeNoResponse({s: hypothesis.s, w: hypothesis.w, r: hypothesis.r});
                    
                    if (currentPlayer.hasFullSolution()) {
                        storyLog("💡", `${currentPlayer.name} ha capito tutto! (Soluzione Confermata)`, "color: #fcd34d; font-weight:bold;");
                    } else {
                        storyLog("🤔", `${currentPlayer.name} ha dedotto una parte della soluzione...`, "color: #fcd34d; font-style: italic;");
                    }
                }
            }

            try { runSolver(); } catch(e) {}
        }

        currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
    }

    if (!gameOver) storyLog("⌛", "FINE (Limite Turni)", "color: red;");
})();
