// === CLUEDO REALISTIC MATCH SIMULATOR ===

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
    const SIM_SPEED = 1200; 
    const MAX_TURNS = 200;
    const HERO_NAME = "Hero"; 
    const OPPONENT_POOL = ["Alice", "Bob", "Charlie", "Dave", "Eve"];
    const DESIRED_OPPONENTS = 3; 

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
            this.currentLocation = rooms[Math.floor(Math.random() * rooms.length)]; 
            this.targetLocation = null;
            this.wasDragged = false; 
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

    // Posizioni Pedine
    let tokenPositions = {}; 
    suspects.forEach(s => {
        const owner = simPlayers.find(p => p.character === s);
        tokenPositions[s] = owner ? owner.currentLocation : rooms[Math.floor(Math.random() * rooms.length)];
    });

    function updateTokenLocation(character, newRoom, isForcedDrag = false) {
        tokenPositions[character] = newRoom;
        const player = simPlayers.find(p => p.character === character);
        if (player) {
            player.currentLocation = newRoom;
            if (isForcedDrag) {
                player.wasDragged = true;
                console.log(`${player.name} (${player.character}) è stato trascinato in ${newRoom}.`);
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
        await sleep(100);
    }
    selectOption('who-am-i', HERO_NAME);
    await sleep(200);
    clickButton('goToHandSelection');
    await sleep(300);

    const checkboxes = document.querySelectorAll('.init-card-check');
    checkboxes.forEach(chk => {
        if (heroPlayer.hand.includes(chk.value)) chk.click();
    });
    await sleep(300);
    clickButton('finalizeSetup');
    console.log("--- PARTITA INIZIATA ---");
    await sleep(800);

    // ======================================================
    // 4. LOGICA ACCUSA & LOOP
    // ======================================================
    function checkAndPerformAccusation(player) {
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
        const canStay = !currentPlayer.wasDragged;
        currentPlayer.wasDragged = false;
        
        console.log(`\n--- TURNO ${turnCount}: ${currentPlayer.name} (in ${currentPlayer.currentLocation}${canStay ? ", può restare" : ""}) ---`);
        if (checkAndPerformAccusation(currentPlayer)) { gameOver = true; break; }

        await sleep(SIM_SPEED);

        let finalRoom = currentPlayer.currentLocation;
        let moved = false;
        let dice = 0;

        // >>> LOGICA EROE <<<
        if (currentPlayer.name === HERO_NAME) {
            // 1. Aggiorna UI affinché tactics.js legga lo stato corretto
            selectOption('current-position', currentPlayer.currentLocation);
            
            setCheckbox('can-stay-check', canStay); 
            
            // Forza aggiornamento suggerimenti basato sulla nuova UI
            if (typeof updateTacticalSuggestions === 'function') updateTacticalSuggestions();
            
            // 2. Leggi le opzioni tattiche
            const suggestions = calculateTacticalMoves(currentPlayer.currentLocation);
            
            // Il "bestMove" teorico (senza considerare i dadi per ora)
            // tactics.js ordina già per punteggio. 
            let topWish = suggestions[0];

            // 3. PRENDI UNA DECISIONE
            
            // OPZIONE A: RESTARE
            if (topWish.room === currentPlayer.currentLocation && canStay) {
                console.log(`Tactic: Decido di RESTARE in ${topWish.room}.`);
                moved = true; // È considerato "essere in stanza" per fare ipotesi
                finalRoom = currentPlayer.currentLocation;
            }
            // OPZIONE B: PASSAGGIO SEGRETO
            else if (topWish.isSecret) {
                console.log(`Tactic: Uso il PASSAGGIO SEGRETO per ${topWish.room}.`);
                updateTokenLocation(currentPlayer.character, topWish.room);
                finalRoom = topWish.room;
                moved = true;
                selectOption('current-position', finalRoom);
            }
            // OPZIONE C: LANCIARE I DADI
            else {
                dice = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
                console.log(`Tactic: Lancio i dadi: ${dice}`);
                
                const reachableMoves = suggestions.filter(m => 
                    m.dist <= dice && 
                    !m.isSecret && 
                    m.room !== currentPlayer.currentLocation
                );

                if (reachableMoves.length > 0) {
                    const bestMove = reachableMoves[0];
                    console.log(`Tactic: Vado in ${bestMove.room}.`);
                    updateTokenLocation(currentPlayer.character, bestMove.room);
                    finalRoom = bestMove.room;
                    moved = true;
                    selectOption('current-position', finalRoom);
                } else {
                    console.log(`Nessuna stanza raggiungibile con ${dice}. Resto in corridoio.`);
                    moved = false;
                }
            }
        } 
        // >>> LOGICA BOT <<<
        else {            
            let choice = "roll";
            
            // Se può restare, piccola chance di farlo (se non è stupido)
            if (canStay && Math.random() > 0.3) {
                choice = "stay";
            }

            if (choice === "stay") {
                console.log(`${currentPlayer.name} decide di RESTARE in ${finalRoom}.`);
                moved = true;
            } else {
                dice = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
                // Logica semplificata: cerca stanze raggiungibili
                const dists = ROOM_DISTANCES[currentPlayer.currentLocation];
                const possible = Object.keys(dists).filter(r => 
                   (dists[r] <= dice || dists[r] === 0) && r !== currentPlayer.currentLocation
                );

                if (possible.length > 0) {
                    const smart = possible.filter(r => currentPlayer.memory.rooms.includes(r));
                    const dest = (smart.length > 0) 
                       ? smart[Math.floor(Math.random() * smart.length)]
                       : possible[Math.floor(Math.random() * possible.length)];
                       
                    updateTokenLocation(currentPlayer.character, dest);
                    finalRoom = dest;
                    console.log(`${currentPlayer.name} va in ${dest} (Dadi: ${dice})`);
                    moved = true;
                } else {
                    console.log(`${currentPlayer.name} resta in corridoio (Dadi: ${dice}).`);
                    moved = false;
                }
            }
        }

        // --- FASE 2: AZIONE (IPOTESI) ---
        if (moved) { 
            if (checkAndPerformAccusation(currentPlayer)) { gameOver = true; break; }

            const currentRoom = currentPlayer.currentLocation;
            let hypothesis;
            
            if (currentPlayer.name === HERO_NAME) {
                // Recupera l'ipotesi suggerita per la stanza in cui siamo effettivamente finiti
                const suggestions = calculateTacticalMoves(currentRoom);
                const currentSpotData = suggestions.find(m => m.room === currentRoom);
                
                if (currentSpotData && currentSpotData.hypothesis) {
                    hypothesis = {
                        s: currentSpotData.hypothesis.suspect,
                        w: currentSpotData.hypothesis.weapon,
                        r: currentRoom
                    };
                    console.log(`Ipotesi Tattica: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`);
                } else {
                    hypothesis = currentPlayer.generateHypothesis(currentRoom);
                }
            } else {
                hypothesis = currentPlayer.generateHypothesis(currentRoom);
                console.log(`${currentPlayer.name} ipotizza: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`);
            }

            if (tokenPositions[hypothesis.s] !== currentRoom) {
                updateTokenLocation(hypothesis.s, currentRoom, true);
            }

            // Sync UI Taccuino
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

            await sleep(500);
            clickButton('submitTurn'); 
        }

        if (checkAndPerformAccusation(currentPlayer)) { gameOver = true; break; }
        
        currentPlayerIdx = (currentPlayerIdx + 1) % simPlayers.length;
    }

    console.log("Simulazione Terminata.");

})();
