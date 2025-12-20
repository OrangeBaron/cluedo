// === CLUEDO REALISTIC MATCH SIMULATOR V4 (UI INTERACTION) ===

await (async function runRealisticSimulation() {

    // ======================================================
    // 0. UTILITIES DI INTERAZIONE UI
    // ======================================================
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Helper per selezionare un valore in una <select> e scatenare l'evento change
    function selectOption(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = value;
        el.dispatchEvent(new Event('change'));
    }

    // Helper per cliccare un bottone dato il suo attributo onclick (o selettore CSS)
    function clickButton(selector) {
        let btn;
        // Se il selettore non contiene parentesi o #, assumiamo sia una ricerca per attributo onclick
        if (!selector.includes('[') && !selector.includes('#') && !selector.includes('.')) {
             // Cerca bottoni che contengono la funzione nell'onclick
             const allBtns = Array.from(document.querySelectorAll('button'));
             btn = allBtns.find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(selector));
        } else {
            btn = document.querySelector(selector);
        }
        
        if (btn) {
            btn.click();
        } else {
            console.warn(`Bottone non trovato: ${selector}`);
        }
    }

    // Helper per inserire testo
    function typeInput(id, text) {
        const el = document.getElementById(id);
        if (el) el.value = text;
    }

    // ======================================================
    // 1. CONFIGURAZIONE
    // ======================================================
    console.clear();
    const SIM_SPEED = 1500; 
    const MAX_TURNS = 200;
    const HERO_NAME = "Hero"; 
    const OPPONENT_POOL = ["Alice", "Bob", "Charlie", "Dave", "Eve"];
    const DESIRED_OPPONENTS = 2 + Math.floor(Math.random() * 4); // 2-5 avversari casuali

    if (typeof initPathfinding === 'function') initPathfinding();
    else return console.error("tactics.js mancante.");

    // ======================================================
    // 2. SETUP STATO INTERNO (LA VERITÀ DEL GIOCO)
    // ======================================================
    // Questo stato serve solo ai bot per sapere cosa rispondere.
    // L'app (Solver) non ha accesso a questo, deve dedurlo.
    
    const selectedOpponents = OPPONENT_POOL.slice(0, DESIRED_OPPONENTS);
    const playersList = [HERO_NAME, ...selectedOpponents];
    
    // Setup Mazzo e Soluzione Reale
    let deck = [...allCards];
    const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
    const solution = [shuffle([...suspects])[0], shuffle([...weapons])[0], shuffle([...rooms])[0]];
    deck = deck.filter(c => !solution.includes(c));
    shuffle(deck);

    // Classe Giocatore Virtuale (solo per gestire la verità nascosta)
    class SimPlayer {
        constructor(name, characterName) {
            this.name = name;
            this.character = characterName;
            this.hand = [];
            this.currentLocation = rooms[Math.floor(Math.random() * rooms.length)]; 
            this.targetLocation = null;
            this.squaresLeft = 0;
            this.inRoom = true; 
            this.wasDragged = false;
            // Memoria tattica per i bot
            this.memory = { suspects: [...suspects], weapons: [...weapons], rooms: [...rooms] };
            this.knownSolution = { s: null, w: null, r: null };
        }

        // Logica semplice per generare ipotesi credibili
        generateHypothesis(currentRoom) {
            // Sceglie a caso tra ciò che non conosce ancora
            const s = this.memory.suspects[Math.floor(Math.random() * this.memory.suspects.length)] || suspects[0];
            const w = this.memory.weapons[Math.floor(Math.random() * this.memory.weapons.length)] || weapons[0];
            return { s, w, r: currentRoom };
        }
    }

    // Assegnazione carte
    const characterPool = shuffle([...suspects]); 
    const simPlayers = playersList.map((p, i) => new SimPlayer(p, characterPool[i]));

    let pIdx = 0;
    while(deck.length > 0) {
        simPlayers[pIdx].hand.push(deck.pop());
        pIdx = (pIdx + 1) % simPlayers.length;
    }

    const heroPlayer = simPlayers.find(p => p.name === HERO_NAME);

    // Posizioni Pedine
    let tokenPositions = {}; 
    suspects.forEach(s => {
        const owner = simPlayers.find(p => p.character === s);
        tokenPositions[s] = owner ? owner.currentLocation : rooms[Math.floor(Math.random() * rooms.length)];
    });

    function getDistance(from, to) { return ROOM_DISTANCES[from][to] || 99; }

    function updateTokenLocation(character, newRoom, isForcedDrag = false) {
        tokenPositions[character] = newRoom;
        const player = simPlayers.find(p => p.character === character);
        if (player) {
            if (player.currentLocation !== newRoom) {
                player.currentLocation = newRoom;
                player.inRoom = true;
                player.squaresLeft = 0;
            }
            if (isForcedDrag) {
                player.wasDragged = true;
                player.targetLocation = null; 
            } else if (player.targetLocation && newRoom !== player.targetLocation) {
                player.squaresLeft = getDistance(newRoom, player.targetLocation);
                player.inRoom = false; 
            }
            
            // SE È L'EROE, AGGIORNIAMO LA UI DEL NAVIGATORE
            if (player.name === HERO_NAME) {
                selectOption('current-position', newRoom);
            }
        }
    }

    // ======================================================
    // 3. ESECUZIONE SETUP UI (AUTOMAZIONE)
    // ======================================================
    console.log("--- AVVIO SETUP AUTOMATICO ---");
    
    // Reset view (nel caso fossimo già in game)
    document.getElementById('view-game').classList.add('hidden');
    document.getElementById('view-setup').classList.remove('hidden');
    document.getElementById('player-list').innerHTML = ""; 
    // Reset variabili globali app (se esposte)
    if(typeof players !== 'undefined') players = [];

    // 1. Inserimento Giocatori
    for (const pName of playersList) {
        typeInput('new-player', pName);
        clickButton('addPlayer'); // Clicca il tasto "+"
        await sleep(200);
    }

    // 2. Chi sono io?
    selectOption('who-am-i', HERO_NAME);
    await sleep(300);

    // 3. Avanti
    clickButton('goToHandSelection');
    await sleep(500);

    // 4. Selezione Carte Mano
    // Dobbiamo trovare le checkbox giuste e cliccarle
    const checkboxes = document.querySelectorAll('.init-card-check');
    checkboxes.forEach(chk => {
        if (heroPlayer.hand.includes(chk.value)) {
            chk.click();
        }
    });
    await sleep(500);

    // 5. Inizia Indagine
    clickButton('finalizeSetup');
    console.log("--- PARTITA INIZIATA ---");
    await sleep(1000);

    // ======================================================
    // 4. GAME LOOP
    // ======================================================
    
    // Log Soluzione in console (per debug "Truth")
    console.group("Soluzione Reale (Nascosta all'App)");
    console.log(`[${solution.join(", ")}]`);
    console.groupEnd();

    let turnCount = 0;
    let currentPlayerIdx = Math.floor(Math.random() * simPlayers.length);
    let gameOver = false;

    console.log(`Dadi lanciati! Inizia: ${simPlayers[currentPlayerIdx].name}`);

    while (!gameOver && turnCount < MAX_TURNS) {
        turnCount++;
        const currentPlayer = simPlayers[currentPlayerIdx];
        
        // Simula ritardo riflessione
        await sleep(SIM_SPEED);

        // --- FASE 1: MOVIMENTO ---
        // (Gestito internamente, ma aggiorna la UI se è l'eroe)
        
        const dice = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
        let moveLog = `T${turnCount}: ${currentPlayer.name} `;

        if (currentPlayer.wasDragged) {
            moveLog += `resta nella stanza (Trascinato).`;
            currentPlayer.wasDragged = false;
        } else if (currentPlayer.inRoom) {
            // Logica semplificata movimento
            // Se è l'eroe, il navigatore tattico (tactics.js) è già attivo nella UI perché abbiamo settato current-position
            // Scegliamo una destinazione sensata
            if (Math.random() > 0.3) { // 70% chance di muoversi
                 const dists = ROOM_DISTANCES[currentPlayer.currentLocation];
                 const possible = Object.keys(dists).filter(r => dists[r] <= dice && r !== currentPlayer.currentLocation);
                 if (possible.length > 0) {
                     const dest = possible[Math.floor(Math.random() * possible.length)];
                     updateTokenLocation(currentPlayer.character, dest);
                     moveLog += `va in ${dest} (Dadi: ${dice})`;
                 } else {
                     moveLog += `non raggiunge nulla (Dadi: ${dice})`;
                     currentPlayer.inRoom = false; // Uscito ma non arrivato (semplificazione)
                 }
            } else {
                moveLog += `resta in ${currentPlayer.currentLocation}`;
            }
        } else {
            // Era in corridoio
            moveLog += `continua a muoversi...`;
        }

        console.log(moveLog); // Log "Fisico" in console

        // --- FASE 2: AZIONE ---
        if (currentPlayer.inRoom) {
            const currentRoom = currentPlayer.currentLocation;

            // 1. Formula Ipotesi
            let hypothesis;
            if (currentPlayer.name === HERO_NAME) {
                // L'eroe legge il suggerimento dal Navigatore Tattico (se volessimo simulare lettura)
                // Per ora usa la logica interna del simPlayer che è comunque "smart"
                // Ma per realismo, usiamo il solver UI per decidere? 
                // Semplifichiamo: L'eroe chiede carte che non ha.
                hypothesis = currentPlayer.generateHypothesis(currentRoom);
                console.log(`🧠 ${HERO_NAME} decide di chiedere: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`);
            } else {
                hypothesis = currentPlayer.generateHypothesis(currentRoom);
                console.log(`💬 ${currentPlayer.name} ipotizza: ${hypothesis.s}, ${hypothesis.w}, ${hypothesis.r}`);
            }

            // Dragging (sposta pedina sospettato)
            if (tokenPositions[hypothesis.s] !== currentRoom) {
                updateTokenLocation(hypothesis.s, currentRoom, true);
            }

            // 2. Compilazione Taccuino UI (AZIONE UTENTE)
            // Simula l'utente che inserisce i dati nel taccuino
            selectOption('turn-asker', currentPlayer.name);
            selectOption('turn-suspect', hypothesis.s);
            selectOption('turn-weapon', hypothesis.w);
            selectOption('turn-room', hypothesis.r);
            
            await sleep(SIM_SPEED / 2);

            // 3. Risposte (Chi smentisce?)
            let responderName = "none";
            let cardShown = null;

            // Calcolo risposta reale
            for (let i = 1; i < simPlayers.length; i++) {
                const checkIdx = (currentPlayerIdx + i) % simPlayers.length;
                const checker = simPlayers[checkIdx];
                const matches = checker.hand.filter(c => c === hypothesis.s || c === hypothesis.w || c === hypothesis.r);
                
                if (matches.length > 0) {
                    responderName = checker.name;
                    cardShown = matches[0]; // Mostra la prima che trova
                    console.log(`✋ ${responderName} smentisce.`);
                    break;
                }
            }

            // Aggiorna UI Risponditore
            selectOption('turn-responder', responderName);

            // Se sono io a chiedere e qualcuno risponde, devo dire CHE carta ho visto
            if (currentPlayer.name === HERO_NAME && responderName !== "none") {
                console.log(`👁️ Hai visto la carta: ${cardShown}`);
                // Il box appare automaticamente grazie al change event su turn-responder
                await sleep(200);
                selectOption('turn-card-shown', cardShown);
            }

            // 4. Click Registra Turno
            await sleep(500);
            clickButton('submitTurn'); 
            // A questo punto script.js farà il log nel log-area e aggiornerà la griglia
            
            // Check Vittoria (semplificato basato sulla UI grid)
            // Se nel DOM appaiono messaggi di vittoria o la griglia è completa
            // Possiamo controllare la griglia interna del SimPlayer Hero o leggere il DOM.
            // Per ora lasciamo girare finché max turni.
        }

        currentPlayerIdx = (currentPlayerIdx + 1) % simPlayers.length;
    }

    console.log("🏁 Simulazione Terminata.");

})();
