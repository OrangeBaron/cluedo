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

    // --- 4. SETUP PARTITA ---
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
        }
    }

    const simPlayers = players.map((p, i) => new SimPlayer(p, suspects[i] || "Unknown"));

    let pIdx = 0;
    while(deck.length > 0) {
        simPlayers[pIdx].hand.push(deck.pop());
        pIdx = (pIdx + 1) % simPlayers.length;
    }

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
            if (isForcedDrag) player.wasDragged = true; 
            if (player.targetLocation && newRoom !== player.targetLocation) {
                 player.squaresLeft = getDistance(newRoom, player.targetLocation);
                 player.inRoom = false; 
            }
        }
    }

    // --- 5. LOG DISTRIBUZIONE (DEBUG) ---
    storyLog("🕵️", "CLUEDO MATCH SIM", "font-size: 1.2em; font-weight: bold; background: #333; color: #4ade80;");
    storyLog("🤫", `SOLUZIONE REALE: [${solution.join(", ")}]`, "color: #93c5fd; font-weight: bold;");
    
    console.log("%c🃏 DISTRIBUZIONE CARTE:", "color: #f472b6; font-weight: bold; margin-top: 5px;");
    simPlayers.forEach(p => {
         console.log(`   %c${p.name}: %c${p.hand.join(", ")}`, "font-weight:bold; color: #fbbf24;", "color: #e5e7eb;");
    });
    console.log("---------------------------------------------------");

    // --- 6. LOOP DI GIOCO ---
    
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
            // SELEZIONE TARGET
            if (currentPlayer.name === HERO_NAME) {
                mockElements['current-position'].value = currentPlayer.currentLocation; 
                let tacticalMoves = calculateTacticalMoves(currentPlayer.currentLocation);
                
                if (!canStay) tacticalMoves = tacticalMoves.filter(m => m.room !== currentPlayer.currentLocation);

                const bestMove = tacticalMoves.length > 0 ? tacticalMoves[0] : null;
                if (bestMove) {
                    if (bestMove.hypothesis && bestMove.hypothesis.type === "Vittoria") {
                         currentPlayer.targetLocation = bestMove.room;
                         storyLog("🤖", `SOLVER CORRE A VINCERE: ${currentPlayer.targetLocation}`, "color: #a7f3d0");
                    } else currentPlayer.targetLocation = bestMove.room; 
                    
                    if (bestMove.isSecret) {
                        currentPlayer.squaresLeft = 0;
                        updateTokenLocation(currentPlayer.character, currentPlayer.targetLocation);
                        storyLog("🚇", `Usa passaggio segreto -> ${currentPlayer.targetLocation}`, "color: #9ca3af;");
                    } else {
                        if (currentPlayer.targetLocation === currentPlayer.currentLocation) currentPlayer.squaresLeft = 0;
                        else currentPlayer.squaresLeft = getDistance(currentPlayer.currentLocation, currentPlayer.targetLocation);
                    }
                }
            } else {
                // BOT
                const dists = ROOM_DISTANCES[currentPlayer.currentLocation];
                let options = Object.keys(dists);
                if (!canStay) options = options.filter(r => r !== currentPlayer.currentLocation);

                const dest = options[Math.floor(Math.random() * options.length)];
                
                const isSecret = (dists[dest] === 0 || (dists[dest] === 1 && dest !== currentPlayer.currentLocation));
                if (isSecret && Math.random() > 0.3) { 
                    currentPlayer.targetLocation = dest;
                    currentPlayer.squaresLeft = 0;
                    updateTokenLocation(currentPlayer.character, dest);
                    storyLog("🚇", `Usa passaggio segreto -> ${currentPlayer.targetLocation}`, "color: #9ca3af;");
                } else {
                    currentPlayer.targetLocation = dest;
                    if (dest === currentPlayer.currentLocation) currentPlayer.squaresLeft = 0;
                    else currentPlayer.squaresLeft = dists[dest];
                }
            }
        }

        if (currentPlayer.squaresLeft > 0) {
            currentPlayer.squaresLeft -= dice;
            if (currentPlayer.squaresLeft <= 0) {
                updateTokenLocation(currentPlayer.character, currentPlayer.targetLocation);
                currentPlayer.inRoom = true;
                // LOG ARRIVO (FIXATO)
                storyLog("👣", `Raggiunge: ${currentPlayer.targetLocation} (Dadi: ${dice})`, "color: #d1d5db;");
            } else {
                currentPlayer.inRoom = false;
                currentPlayer.currentLocation = "Corridoio";
                // LOG FALLIMENTO (FIXATO)
                storyLog("🚫", `Resta in Corridoio (Dadi: ${dice}, mancano ${currentPlayer.squaresLeft})`, "color: #6b7280; font-size: 0.9em;");
            }
        } else if (currentPlayer.inRoom && currentPlayer.currentLocation === currentPlayer.targetLocation) {
             storyLog("⚓", "Rimane nella stanza.", "color: #6b7280;");
        }

        // --- B. AZIONE ---
        if (currentPlayer.inRoom) {
            
            // ACCUSA (SOLO HERO)
            if (currentPlayer.name === HERO_NAME) {
                const s = suspects.find(c => grid[c].SOL === 2);
                const w = weapons.find(c => grid[c].SOL === 2);
                const r = rooms.find(c => grid[c].SOL === 2);
                if (s && w && r) {
                    storyLog("🏆", `ACCUSA FINALE: ${s}, ${w}, ${r}`, "font-size: 1.2em; font-weight: bold; color: gold; border: 2px solid gold; padding: 10px;");
                    if (s === solution[0] && w === solution[1] && r === solution[2]) {
                        storyLog("🎉", `VITTORIA! Partita conclusa in ${turnCount} turni.`, "background: green; color: white; padding: 5px;");
                        gameOver = true;
                        break;
                    } else {
                        storyLog("💀", "ACCUSA ERRATA! Hero Eliminato.", "color: red;");
                        currentPlayer.isEliminated = true;
                    }
                }
            }

            // IPOTESI
            let hypothesis = { s: null, w: null, r: currentPlayer.currentLocation };
            
            if (currentPlayer.name === HERO_NAME) {
                const suggestion = generateHypothesisForRoom(currentPlayer.currentLocation);
                hypothesis.s = suggestion.suspect;
                hypothesis.w = suggestion.weapon;
                storyLog("🧠", `Indagine Hero: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`, "color: #93c5fd");
            } else {
                const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
                hypothesis.s = rand(suspects);
                hypothesis.w = rand(weapons);
                storyLog("💬", `${currentPlayer.name} ipotizza: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`, "color: #d1d5db;");
            }

            // DRAG
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
                    storyLog("✋", `${checker.name} mostra [${cardShown}] a ${currentPlayer.name}`, "color: #fca5a5; font-weight: bold;");
                    break;
                } else {
                    storyLog("❌", `${checker.name} passa`, "color: #4b5563; font-size: 0.9em;");
                    setFact(hypothesis.s, checker.name, 1);
                    setFact(hypothesis.w, checker.name, 1);
                    setFact(hypothesis.r, checker.name, 1);
                }
            }

            if (responder) {
                if (currentPlayer.name === HERO_NAME) {
                    setFact(cardShown, responder.name, 2); 
                } else if (responder.name !== HERO_NAME) {
                    addConstraint(responder.name, [hypothesis.s, hypothesis.w, hypothesis.r]);
                }
            } else {
                if (currentPlayer.name === HERO_NAME) {
                    [hypothesis.s, hypothesis.w, hypothesis.r].forEach(c => {
                        if (grid[c][HERO_NAME] !== 2) grid[c].SOL = 2;
                    });
                }
            }

            try { runSolver(); } catch(e) {}
        }

        currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
    }

    if (!gameOver) storyLog("⌛", "FINE (Limite Turni)", "color: red;");
})();