// === CLUEDO MONTE CARLO SIMULATION ===

const ITERATIONS = 100; // Numero di simulazioni per configurazione

(async function runMonteCarlo() {
    // --- GESTIONE LOG & REDRAW SYSTEM ---
    const originalLog = console.log;
    const originalError = console.error;
    const originalTable = console.table;

    let persistentLogs = []; 

    function redrawConsole(progressBar = null) {
        console.clear();
        
        if (persistentLogs.length > 0) {
            originalLog(persistentLogs.join("\n"));
        }

        if (progressBar) {
            originalLog(progressBar);
        }
    }

    function logPermanent(msg) {
        const textOnly = msg.toString().replace(/%c/g, ''); 
        persistentLogs.push(textOnly);
        redrawConsole();
    }

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function setConsole(enabled) {
        if (!enabled) {
            console.log = () => {};
            console.group = () => {};
            console.error = () => {}; 
            console.table = () => {};
        } else {
            console.log = originalLog;
            console.error = originalError;
            console.table = originalTable;
        }
    }

    // --- DISABILITAZIONE UI E NAVIGATORE ---
    const originalUpdateTactics = window.updateTacticalSuggestions;
    const originalUpdateTurnUI = window.updateTurnUI;
    const originalRenderGrid = window.renderGrid;

    window.updateTacticalSuggestions = () => {};
    window.updateTurnUI = () => {};
    window.renderGrid = () => {};

    // --- SETUP DATI ---
    const PLAYER_COUNTS = [3, 4, 5, 6];
    const POOL_NAMES = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank"];

    // --- LOGICA PARTITA ---
    function playSingleGame(numPlayers) {
        const SIM_PLAYERS = POOL_NAMES.slice(0, numPlayers);
        const REAL_ME = SIM_PLAYERS[Math.floor(Math.random() * SIM_PLAYERS.length)];
        
        players = [...SIM_PLAYERS];
        myName = REAL_ME;
        grid = {};
        constraints = [];
        history = [];
        isSimulating = false; 
        currentTurnIndex = Math.floor(Math.random() * numPlayers);
        
        allCards.forEach(c => { 
            grid[c] = { SOL: 0 }; 
            players.forEach(p => grid[c][p] = 0); 
        });

        let deck = [...allCards];
        const shuffle = (array) => array.sort(() => Math.random() - 0.5);
        const solSuspect = shuffle([...suspects])[0];
        const solWeapon = shuffle([...weapons])[0];
        const solRoom = shuffle([...rooms])[0];
        const solution = [solSuspect, solWeapon, solRoom];
        
        deck = deck.filter(c => !solution.includes(c));
        shuffle(deck);

        const trueHands = {};
        SIM_PLAYERS.forEach(p => trueHands[p] = []);
        let pIdx = 0;
        while(deck.length > 0) {
            trueHands[SIM_PLAYERS[pIdx]].push(deck.pop());
            pIdx = (pIdx + 1) % SIM_PLAYERS.length;
        }

        const baseCount = Math.floor((allCards.length - 3) / players.length);
        const remainder = (allCards.length - 3) % players.length;
        players.forEach((p, index) => { limits[p] = baseCount + (index < remainder ? 1 : 0); });
        trueHands[myName].forEach(card => setFact(card, myName, 2));
        
        try { runSolver(); } catch(e) { return { win: false, turns: 0, error: e }; }

        let turnCount = 0;
        const MAX_TURNS = 100;

        while (turnCount < MAX_TURNS) {
            turnCount++;
            const currentPlayer = players[currentTurnIndex];

            const getCandidates = (categoryList) => {
                const valid = categoryList.filter(card => {
                    const knownOwner = players.find(p => p !== currentPlayer && grid[card][p] === 2);
                    return !knownOwner; 
                });
                return valid.length > 0 ? valid : [categoryList[0]]; 
            };

            // --- STRATEGIA "SCIENTIFIC BLUFF" ---
            
            // 1. Definiamo i pool di carte disponibili
            const myHand = trueHands[currentPlayer];
            
            // Funzione per ottenere candidati validi (Esclude solo chi sappiamo che ce l'ha)
            const getSmartCandidates = (list) => {
                return list.filter(card => {
                    // Escludiamo carte possedute da ALTRI giocatori noti
                    const knownOwner = players.find(p => p !== currentPlayer && grid[card][p] === 2);
                    return !knownOwner;
                });
            };
            
            // Pool di carte che potrebbero essere la soluzione (SOL == 0)
            // Queste sono i nostri "Bersagli"
            const unknownSuspects = suspects.filter(c => grid[c].SOL === 0);
            const unknownWeapons = weapons.filter(c => grid[c].SOL === 0);
            const unknownRooms    = rooms.filter(c => grid[c].SOL === 0);

            // Se non ci sono incognite (caso raro/finale), usiamo tutti i validi
            const targetS = unknownSuspects.length > 0 ? unknownSuspects : getSmartCandidates(suspects);
            const targetW = unknownWeapons.length > 0 ? unknownWeapons : getSmartCandidates(weapons);
            const targetR = unknownRooms.length > 0 ? unknownRooms : getSmartCandidates(rooms);

            let guess = [];
            let isValidBluff = false;
            let attempts = 0;

            // Tentiamo di costruire una mano "1 Ignoto + 2 Mie"
            while (!isValidBluff && attempts < 50) {
                
                // Scegliamo una categoria "Bersaglio" a caso (chi vogliamo testare oggi?)
                const focusType = Math.floor(Math.random() * 3); // 0=S, 1=W, 2=R
                
                let s, w, r;

                // LOGICA: Se ho una carta mia nella categoria, la uso come scudo.
                // Se è la categoria bersaglio, invece, prendo un'incognita.

                // SUSPECT
                if (focusType === 0) { // Questo è il bersaglio
                    s = targetS[Math.floor(Math.random() * targetS.length)];
                } else { // Uso una mia carta se ce l'ho, altrimenti un'incognita a caso
                    const myS = suspects.filter(c => myHand.includes(c));
                    s = myS.length > 0 ? myS[Math.floor(Math.random() * myS.length)] : targetS[Math.floor(Math.random() * targetS.length)];
                }

                // WEAPON
                if (focusType === 1) {
                    w = targetW[Math.floor(Math.random() * targetW.length)];
                } else {
                    const myW = weapons.filter(c => myHand.includes(c));
                    w = myW.length > 0 ? myW[Math.floor(Math.random() * myW.length)] : targetW[Math.floor(Math.random() * targetW.length)];
                }

                // ROOM
                if (focusType === 2) {
                    r = targetR[Math.floor(Math.random() * targetR.length)];
                } else {
                    const myR = rooms.filter(c => myHand.includes(c));
                    r = myR.length > 0 ? myR[Math.floor(Math.random() * myR.length)] : targetR[Math.floor(Math.random() * targetR.length)];
                }

                guess = [s, w, r];
                
                // Verifica validità standard (non chiedere 3 carte che ho già)
                const ownedCount = guess.filter(c => myHand.includes(c)).length;
                if (ownedCount < 3) isValidBluff = true;
                
                attempts++;
            }
            
            // Fallback disperato: se il loop sopra fallisce (raro), usa il random puro vecchio stile
            if (!isValidBluff) {
                 const candsS = getCandidates(suspects);
                 const candsW = getCandidates(weapons);
                 const candsR = getCandidates(rooms);
                 guess = [
                    candsS[Math.floor(Math.random() * candsS.length)],
                    candsW[Math.floor(Math.random() * candsW.length)],
                    candsR[Math.floor(Math.random() * candsR.length)]
                 ];
            }

            if (guess[0] === solution[0] && guess[1] === solution[1] && guess[2] === solution[2]) {
                return { win: (currentPlayer === myName), turns: turnCount, error: null };
            }

            let responder = null;
            let cardShown = null;
            let searchIdx = (currentTurnIndex + 1) % players.length;
            let loops = 0;
            while(loops < players.length - 1) { 
                const potentialResponder = players[searchIdx];
                const matches = guess.filter(c => trueHands[potentialResponder].includes(c));
                if (matches.length > 0) {
                    responder = potentialResponder;
                    cardShown = matches[Math.floor(Math.random() * matches.length)];
                    break;
                }
                searchIdx = (searchIdx + 1) % players.length;
                loops++;
            }

            try {
                if (!responder) {
                    let pIdx = (currentTurnIndex + 1) % players.length;
                    while (players[pIdx] !== currentPlayer) {
                        guess.forEach(c => setFact(c, players[pIdx], 1));
                        pIdx = (pIdx + 1) % players.length;
                    }
                } else {
                    let pIdx = (currentTurnIndex + 1) % players.length;
                    while(players[pIdx] !== responder) {
                        guess.forEach(c => setFact(c, players[pIdx], 1)); 
                        pIdx = (pIdx + 1) % players.length;
                    }
                    if (currentPlayer === myName) { setFact(cardShown, responder, 2); } 
                    else if (responder !== myName) { addConstraint(responder, guess); }
                }
                runSolver();
            } catch (e) { return { win: false, turns: turnCount, error: e }; }

            const foundS = suspects.find(c => grid[c].SOL === 2);
            const foundW = weapons.find(c => grid[c].SOL === 2);
            const foundR = rooms.find(c => grid[c].SOL === 2);
            if (foundS && foundW && foundR) return { win: true, turns: turnCount, error: null }; 
            currentTurnIndex = (currentTurnIndex + 1) % players.length;
        }
        return { win: false, turns: turnCount, error: null };
    }

    // --- MAIN EXECUTION ---
    console.clear();
    logPermanent(`🚀 AVVIO SIMULAZIONE MONTE CARLO (${ITERATIONS} iterazioni)`);
    logPermanent(`------------------------------------------------`);
    
    let stats = [];
    const UPDATE_STEP = Math.floor(ITERATIONS / 20);

    for (let count of PLAYER_COUNTS) {
        logPermanent(`\n⚙️  Configurazione: ${count} Giocatori...`);
        
        setConsole(true);
        redrawConsole(`   Progresso: [${"░".repeat(20)}] 0% (0/${ITERATIONS})`);
        setConsole(false);
        await sleep(0);

        const startTime = performance.now();
        
        let wins = 0;
        let totalTurns = 0;
        let logicErrors = 0; 
        let crashes = 0;     
        
        for (let i = 1; i <= ITERATIONS; i++) {
            const result = playSingleGame(count);
            
            if (result.error) {
                const eStr = result.error.toString();
                if (eStr.includes("SIM_") || eStr === "SIM_CONTRADICTION" || eStr === "SIM_LIMIT_EXCEEDED") logicErrors++;
                else crashes++;
            } else {
                if (result.win) wins++;
                totalTurns += result.turns;
            }

            // --- PROGRESS BAR UPDATE ---
            if (i % UPDATE_STEP === 0 || i === ITERATIONS) {
                setConsole(true);
                
                const pct = Math.round((i / ITERATIONS) * 100);
                const blocks = Math.floor(pct / 5); 
                const bar = "█".repeat(blocks) + "░".repeat(20 - blocks);
                
                redrawConsole(`   Progresso: [${bar}] ${pct}% (${i}/${ITERATIONS})`);
                
                setConsole(false);
                await sleep(0); 
            }
        }
        
        const endTime = performance.now();
        setConsole(true);
        
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const validGames = ITERATIONS - logicErrors - crashes;
        const percentage = validGames > 0 ? ((wins / ITERATIONS) * 100).toFixed(1) : "0.0";
        const avgTurns = validGames > 0 ? (totalTurns / validGames).toFixed(1) : "0.0";
        
        logPermanent(`   ✅ Completato in ${duration}s | Win: ${percentage}% | Turni: ${avgTurns}`);
        
        stats.push({
            "# Giocatori": count,
            "% Vittoria": percentage + "%",
            "Media Turni": avgTurns,
            "Contraddizioni": logicErrors,
            "Crash/Bug": crashes
        });
    }

    logPermanent("\n📊 RISULTATI FINALI");
    logPermanent("==================");

    const cleanTable = {};
    stats.forEach(row => {
        const label = `${row["# Giocatori"]} Giocatori`;
        const { "# Giocatori": _, ...data } = row;
        cleanTable[label] = data;
    });

    window.updateTacticalSuggestions = originalUpdateTactics;
    window.updateTurnUI = originalUpdateTurnUI;
    window.renderGrid = originalRenderGrid;

    console.table(cleanTable);

})();
