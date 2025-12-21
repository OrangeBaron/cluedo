// === CLUEDO REALISTIC MATCH SIMULATOR ===
// (Versione corretta: Bot intelligenti sulle distanze)

await (async function runRealisticSimulation() {

    // ======================================================
    // 0. UTILITIES DI INTERAZIONE UI
    // ======================================================
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function selectOption(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = value;
        el.dispatchEvent(new Event('change'));
    }

    function setCheckbox(id, checked) {
        const el = document.getElementById(id);
        if (!el) return;
        el.checked = checked;
        el.dispatchEvent(new Event('change'));
    }

    function clickButton(selector) {
        let btn;
        if (!selector.includes('[') && !selector.includes('#') && !selector.includes('.')) {
             const allBtns = Array.from(document.querySelectorAll('button'));
             btn = allBtns.find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(selector));
        } else {
            btn = document.querySelector(selector);
        }
        if (btn) btn.click();
        else console.warn(`Bottone non trovato: ${selector}`);
    }

    function typeInput(id, text) {
        const el = document.getElementById(id);
        if (el) el.value = text;
    }

    // ======================================================
    // 1. CONFIGURAZIONE
    // ======================================================
    console.clear();
    const SIM_SPEED = 1000; 
    const MAX_TURNS = 200;
    const HERO_NAME = "Hero"; 
    const OPPONENT_POOL = ["Alice", "Bob", "Charlie", "Dave", "Eve"];
    const DESIRED_OPPONENTS = 2 + Math.floor(Math.random() * 4); 

    if (typeof initPathfinding === 'function') initPathfinding();
    else return console.error("tactics.js mancante.");

    // ======================================================
    // 2. SETUP STATO INTERNO
    // ======================================================
    const selectedOpponents = OPPONENT_POOL.slice(0, DESIRED_OPPONENTS);
    const playersList = [HERO_NAME, ...selectedOpponents];
    
    // Setup Mazzo e Soluzione Reale
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
            // Location logica (ultimo punto noto)
            this.currentLocation = rooms[Math.floor(Math.random() * rooms.length)]; 
            this.wasDragged = false; 
            
            // Stato di viaggio per simulare i corridoi
            this.travelState = {
                active: false,
                destination: null,
                stepsLeft: 0
            };

            this.memory = { suspects: [...suspects], weapons: [...weapons], rooms: [...rooms] };
        }

        eliminate(card) {
            this.memory.suspects = this.memory.suspects.filter(c => c !== card);
            this.memory.weapons = this.memory.weapons.filter(c => c !== card);
            this.memory.rooms = this.memory.rooms.filter(c => c !== card);
        }

        hasSolution() {
            return this.memory.suspects.length === 1 && 
                   this.memory.weapons.length === 1 && 
                   this.memory.rooms.length === 1;
        }
        
        getSolution() {
            return [this.memory.suspects[0], this.memory.weapons[0], this.memory.rooms[0]];
        }

        generateHypothesis(currentRoom) {
            const s = this.memory.suspects[Math.floor(Math.random() * this.memory.suspects.length)] || suspects[0];
            const w = this.memory.weapons[Math.floor(Math.random() * this.memory.weapons.length)] || weapons[0];
            return { s, w, r: currentRoom };
        }
    }

    const characterPool = shuffle([...suspects]); 
    const simPlayers = playersList.map((p, i) => new SimPlayer(p, characterPool[i]));

    let pIdx = 0;
    while(deck.length > 0) {
        simPlayers[pIdx].hand.push(deck.pop());
        simPlayers[pIdx].eliminate(simPlayers[pIdx].hand[simPlayers[pIdx].hand.length - 1]);
        pIdx = (pIdx + 1) % simPlayers.length;
    }

    const heroPlayer = simPlayers.find(p => p.name === HERO_NAME);

    // Posizioni Pedine (per log visivo e verifica coerenza)
    let tokenPositions = {}; 
    suspects.forEach(s => {
        const owner = simPlayers.find(p => p.character === s);
        tokenPositions[s] = owner ? owner.currentLocation : rooms[Math.floor(Math.random() * rooms.length)];
    });

    function updateTokenLocation(character, newRoom, isForcedDrag = false) {
        if (!rooms.includes(newRoom)) return;
        tokenPositions[character] = newRoom;
        const player = simPlayers.find(p => p.character === character);
        if (player) {
            // Se vengo trascinato, resetto il mio viaggio e la posizione
            if (isForcedDrag) {
                player.currentLocation = newRoom;
                player.wasDragged = true;
                player.travelState = { active: false, destination: null, stepsLeft: 0 };
                console.log(`${player.name} (${player.character}) è stato trascinato in ${newRoom}.`);
            } else {
                player.currentLocation = newRoom;
            }
        }
    }

    // ======================================================
    // 3. ESECUZIONE SETUP UI
    // ======================================================
    console.log("--- AVVIO SETUP AUTOMATICO ---");
    document.getElementById('view-game').classList.add('hidden');
    document.getElementById('view-setup').classList.remove('hidden');
    document.getElementById('player-list').innerHTML = ""; 
    if(typeof players !== 'undefined') players = [];

    for (const pName of playersList) {
        typeInput('new-player', pName);
        clickButton('addPlayer'); 
        await sleep(50);
    }
    selectOption('who-am-i', HERO_NAME);
    await sleep(100);
    clickButton('goToHandSelection');
    await sleep(200);

    const checkboxes = document.querySelectorAll('.init-card-check');
    checkboxes.forEach(chk => {
        if (heroPlayer.hand.includes(chk.value)) chk.click();
    });
    await sleep(200);
    clickButton('finalizeSetup');
    console.log("--- PARTITA INIZIATA ---");
    await sleep(500);

    // ======================================================
    // 4. LOGICA ACCUSA & LOOP
    // ======================================================
    function checkAndPerformAccusation(player) {
        if (player.travelState.active) return false;

        let solS, solW, solR;
        let hasSol = false;

        if (player.name === HERO_NAME) {
            solS = suspects.find(c => grid[c].SOL === 2);
            solW = weapons.find(c => grid[c].SOL === 2);
            solR = rooms.find(c => grid[c].SOL === 2);
            if (solS && solW && solR) hasSol = true;
        } else {
            if (player.hasSolution()) {
                [solS, solW, solR] = player.getSolution();
                hasSol = true;
            }
        }

        if (hasSol) {
            console.log(`%cACCUSA DI ${player.name.toUpperCase()}: ${solS.toUpperCase()}, ${solW.toUpperCase()}, ${solR.toUpperCase()}`, "background:red; color:white;");
            const isCorrect = (solS === solution[0] && solW === solution[1] && solR === solution[2]);
            if (isCorrect) {
                console.log(`%cVITTORIA DI ${player.name.toUpperCase()}!`, "background:gold; color:black;");
                return true; 
            } else {
                console.log(`%cACCUSA ERRATA!`, "color:red;");
                return false; 
            }
        }
        return false;
    }

    console.log(`%cSOLUZIONE: ${solution.join(", ").toUpperCase()}`, "background:darkgreen; color:white;");
    console.log(`%cMANO: ${heroPlayer.hand.join(", ")}`, "background:darkblue; color:white;");
    
    let turnCount = 0;
    let currentPlayerIdx = Math.floor(Math.random() * simPlayers.length);
    let gameOver = false;

    while (!gameOver && turnCount < MAX_TURNS) {
        turnCount++;
        const currentPlayer = simPlayers[currentPlayerIdx];
        
        // --- GESTIONE STATO CORRENTE ---
        const inHallway = currentPlayer.travelState.active;
        const canStay = currentPlayer.wasDragged && !inHallway;
        currentPlayer.wasDragged = false; 
        
        // Log Intestazione Turno
        let locationMsg = inHallway 
            ? `In corridoio per ${currentPlayer.travelState.destination}`
            : currentPlayer.currentLocation;
        
        if (canStay) locationMsg += ", può restare";

        console.log(`\n--- TURNO ${turnCount}: ${currentPlayer.name} (in ${locationMsg}) ---`);

        await sleep(SIM_SPEED);

        // --- FASE 1: MOVIMENTO ---
        let arrivedInRoom = false;
        let canHypothesize = false;
        
        // CASO A: GIOCATORE GIÀ IN CORRIDOIO
        if (inHallway) {
            const dice = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
            let currentSteps = currentPlayer.travelState.stepsLeft;
            if (isNaN(currentSteps)) { currentSteps = 0; } 

            console.log(`Dadi (Corridoio): ${dice} (Mancano: ${currentSteps})`);
            
            currentPlayer.travelState.stepsLeft = currentSteps - dice;
            
            if (currentPlayer.travelState.stepsLeft <= 0) {
                const dest = currentPlayer.travelState.destination;
                updateTokenLocation(currentPlayer.character, dest);
                currentPlayer.travelState = { active: false, destination: null, stepsLeft: 0 };
                console.log(`Arrivato in ${dest}.`);
                arrivedInRoom = true;
                canHypothesize = true;
                if (currentPlayer.name === HERO_NAME) selectOption('current-position', dest);
            } else {
                console.log(`Resta in corridoio. Passi rimanenti: ${currentPlayer.travelState.stepsLeft}`);
                canHypothesize = false;
            }
        } 
        // CASO B: GIOCATORE IN UNA STANZA (Inizio Movimento)
        else {
            if (checkAndPerformAccusation(currentPlayer)) { gameOver = true; break; }

            // Scelta Destinazione
            let targetRoom = null;
            let useSecret = false;
            
            if (currentPlayer.name === HERO_NAME) {
                // Logica Hero: Usa i suggerimenti tattici
                selectOption('current-position', currentPlayer.currentLocation);
                setCheckbox('can-stay-check', canStay);
                if (typeof updateTacticalSuggestions === 'function') updateTacticalSuggestions();
                
                let moves = calculateTacticalMoves(currentPlayer.currentLocation);
                if (!canStay) moves = moves.filter(m => m.room !== currentPlayer.currentLocation);

                const bestMove = moves[0]; 
                
                if (bestMove && bestMove.room === currentPlayer.currentLocation && canStay) {
                    console.log(`Tactic: Decido di RESTARE in ${currentPlayer.currentLocation}.`);
                    arrivedInRoom = true;
                    canHypothesize = true;
                } else if (bestMove) {
                    targetRoom = bestMove.room;
                    useSecret = bestMove.isSecret;
                }
            } 
            else {
                // >>> LOGICA BOT AGGIORNATA <<<
                // Priorità: Restare (se utile) > Stanza Ignota Vicina > Stanza Ignota Lontana > Random
                
                let decidedToStay = false;
                if (canStay && currentPlayer.memory.rooms.includes(currentPlayer.currentLocation)) {
                    // Se la stanza è ancora ignota, c'è una buona probabilità di restare per fare un'ipotesi
                    if (Math.random() > 0.3) {
                         console.log(`${currentPlayer.name} decide di RESTARE in ${currentPlayer.currentLocation}.`);
                         decidedToStay = true;
                         arrivedInRoom = true;
                         canHypothesize = true;
                    }
                }

                if (!decidedToStay) {
                    const potentialTargets = rooms.filter(r => r !== currentPlayer.currentLocation);
                    // Filtra solo le stanze che il bot non ha ancora escluso (Candidate)
                    const smartTargets = potentialTargets.filter(r => currentPlayer.memory.rooms.includes(r));
                    
                    if (smartTargets.length > 0) {
                        // Ordina le stanze candidate per distanza (Passaggi segreti = dist 0)
                        smartTargets.sort((a, b) => {
                            const distA = (ROOM_DISTANCES[currentPlayer.currentLocation] && ROOM_DISTANCES[currentPlayer.currentLocation][a]) || 99;
                            const distB = (ROOM_DISTANCES[currentPlayer.currentLocation] && ROOM_DISTANCES[currentPlayer.currentLocation][b]) || 99;
                            return distA - distB;
                        });

                        // Prende una delle 2 più vicine per evitare di andare dall'altra parte del tabellone
                        // se c'è una stanza ignota a due passi.
                        const candidates = smartTargets.slice(0, 2);
                        targetRoom = candidates[Math.floor(Math.random() * candidates.length)];
                    } else {
                        // Se tutte le stanze sono note (o innocenti), va a caso
                        targetRoom = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                    }

                    // Check passaggi segreti per il target scelto
                    const distCheck = (ROOM_DISTANCES[currentPlayer.currentLocation] && ROOM_DISTANCES[currentPlayer.currentLocation][targetRoom]) || 99;
                    if (distCheck === 0) useSecret = true;
                }
            }

            // Esecuzione Movimento verso targetRoom
            if (targetRoom) {
                if (useSecret) {
                    console.log(`Usa Passaggio Segreto per ${targetRoom}.`);
                    updateTokenLocation(currentPlayer.character, targetRoom);
                    arrivedInRoom = true;
                    canHypothesize = true;
                    if (currentPlayer.name === HERO_NAME) selectOption('current-position', targetRoom);
                } else {
                    const dice = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
                    let dist = 99;
                    if (currentPlayer.currentLocation === targetRoom) {
                        dist = 0;
                    } else if (ROOM_DISTANCES[currentPlayer.currentLocation] && typeof ROOM_DISTANCES[currentPlayer.currentLocation][targetRoom] !== 'undefined') {
                        dist = ROOM_DISTANCES[currentPlayer.currentLocation][targetRoom];
                    }

                    console.log(`Dadi: ${dice} (Target: ${targetRoom}, Distanza: ${dist})`);
                    
                    if (dice >= dist) {
                        console.log(`Raggiunge direttamente ${targetRoom}.`);
                        updateTokenLocation(currentPlayer.character, targetRoom);
                        arrivedInRoom = true;
                        canHypothesize = true;
                        if (currentPlayer.name === HERO_NAME) selectOption('current-position', targetRoom);
                    } else {
                        const remaining = dist - dice;
                        currentPlayer.travelState = {
                            active: true,
                            destination: targetRoom,
                            stepsLeft: remaining
                        };
                        console.log(`Si ferma in corridoio. Passi rimanenti: ${remaining}`);
                        canHypothesize = false;
                        if (currentPlayer.name === HERO_NAME) {
                             const posEl = document.getElementById('current-position');
                             if(posEl) posEl.value = ""; 
                        }
                    }
                }
            }
        }

        // --- FASE 2: AZIONE (IPOTESI) ---
        if (canHypothesize) { 
            if (checkAndPerformAccusation(currentPlayer)) { gameOver = true; break; }

            const currentRoom = currentPlayer.currentLocation;
            let hypothesis;
            
            if (currentPlayer.name === HERO_NAME) {
                const suggestions = calculateTacticalMoves(currentRoom);
                const currentSpotData = suggestions.find(m => m.room === currentRoom);
                if (currentSpotData && currentSpotData.hypothesis) {
                    hypothesis = {
                        s: currentSpotData.hypothesis.suspect,
                        w: currentSpotData.hypothesis.weapon,
                        r: currentRoom
                    };
                } else {
                    hypothesis = currentPlayer.generateHypothesis(currentRoom);
                }
            } else {
                hypothesis = currentPlayer.generateHypothesis(currentRoom);
            }
            
            console.log(`Ipotizza: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`);

            if (tokenPositions[hypothesis.s] !== currentRoom) {
                updateTokenLocation(hypothesis.s, currentRoom, true);
            }

            selectOption('turn-asker', currentPlayer.name);
            selectOption('turn-suspect', hypothesis.s);
            selectOption('turn-weapon', hypothesis.w);
            selectOption('turn-room', hypothesis.r);
            
            await sleep(SIM_SPEED / 2);

            let responderName = "none";
            let cardShown = null;

            for (let i = 1; i < simPlayers.length; i++) {
                const checkIdx = (currentPlayerIdx + i) % simPlayers.length;
                const checker = simPlayers[checkIdx];
                const matches = checker.hand.filter(c => c === hypothesis.s || c === hypothesis.w || c === hypothesis.r);
                
                if (matches.length > 0) {
                    responderName = checker.name;
                    cardShown = matches[Math.floor(Math.random() * matches.length)];
                    console.log(`${responderName} smentisce.`);
                    break;
                }
            }

            selectOption('turn-responder', responderName);

            if (currentPlayer.name === HERO_NAME && responderName !== "none") {
                console.log(`Hai visto: ${cardShown}`);
                await sleep(200);
                selectOption('turn-card-shown', cardShown);
            }

            await sleep(200);
            clickButton('submitTurn'); 
        }

        if (checkAndPerformAccusation(currentPlayer)) { gameOver = true; break; }
        
        currentPlayerIdx = (currentPlayerIdx + 1) % simPlayers.length;
    }

    console.log("Simulazione Terminata.");

})();
