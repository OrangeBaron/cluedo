// === CLUEDO MONTE CARLO SIMULATION ===

const ITERATIONS = 1000; 

(async function runMonteCarlo() {
    // --- UTILS PER LOGGING E FORMATTAZIONE ---
    const originalLog = console.log;
    let persistentLogs = []; 

    function redrawConsole(progressBar = null) {
        console.clear();
        if (persistentLogs.length > 0) originalLog(persistentLogs.join("\n"));
        if (progressBar) originalLog(progressBar);
    }

    function logPermanent(msg) {
        const textOnly = msg.toString().replace(/%c/g, ''); 
        persistentLogs.push(textOnly);
        redrawConsole();
    }

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    function setConsole(enabled) {
        if (!enabled) {
            console.log = () => {}; console.group = () => {}; console.error = () => {}; console.table = () => {};
        } else {
            console.log = originalLog;
        }
    }

    // --- MOCKING ---
    const originalUpdateTactics = window.updateTacticalSuggestions;
    const originalUpdateTurnUI = window.updateTurnUI;
    const originalRenderGrid = window.renderGrid;
    const originalAppLog = window.log;
    
    window.updateTacticalSuggestions = () => {};
    window.updateTurnUI = () => {};
    window.renderGrid = () => {};
    window.log = () => {}; 

    // --- SETUP DATI ---
    const PLAYER_COUNTS = [3, 4, 5, 6];
    const POOL_NAMES = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank"];

    // --- SMART BOT LOGIC ---
    class SmartBot {
        constructor(name, hand) {
            this.name = name;
            this.hand = new Set(hand);
            this.suspects = suspects.filter(c => !this.hand.has(c));
            this.weapons = weapons.filter(c => !this.hand.has(c));
            this.rooms = rooms.filter(c => !this.hand.has(c));
        }

        eliminate(card) {
            this.suspects = this.suspects.filter(c => c !== card);
            this.weapons = this.weapons.filter(c => c !== card);
            this.rooms = this.rooms.filter(c => c !== card);
        }

        getGuess(currentRoom) {
            let s, w;
            if (this.suspects.length > 0) s = this.suspects[Math.floor(Math.random() * this.suspects.length)];
            else s = suspects[0]; 

            if (this.weapons.length > 0) w = this.weapons[Math.floor(Math.random() * this.weapons.length)];
            else w = weapons[0];

            return [s, w, currentRoom];
        }

        checkWin(guess, solution) {
            const unheld = guess.filter(c => !this.hand.has(c));
            if (unheld.length === 3) {
                if (guess[0] === solution[0] && guess[1] === solution[1] && guess[2] === solution[2]) {
                    return true;
                }
            }
            return false;
        }
    }

    // --- LOGICA PARTITA (DEATHMATCH) ---
    function playDeathmatch(numPlayers) {
        const SIM_PLAYERS = POOL_NAMES.slice(0, numPlayers);
        const REAL_ME = SIM_PLAYERS[Math.floor(Math.random() * SIM_PLAYERS.length)];
        
        players = [...SIM_PLAYERS];
        myName = REAL_ME;
        grid = {};
        constraints = [];
        history = [];
        if (typeof fullGameLogs !== 'undefined') fullGameLogs = [];
        isSimulating = false; 
        currentTurnIndex = Math.floor(Math.random() * numPlayers);
        
        allCards.forEach(c => { 
            grid[c] = { SOL: 0 }; 
            players.forEach(p => grid[c][p] = 0); 
        });

        // Creazione Soluzione
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

        const bots = {};
        SIM_PLAYERS.forEach(p => bots[p] = new SmartBot(p, trueHands[p]));

        const baseCount = Math.floor((allCards.length - 3) / players.length);
        const remainder = (allCards.length - 3) % players.length;
        players.forEach((p, index) => { limits[p] = baseCount + (index < remainder ? 1 : 0); });
        trueHands[myName].forEach(card => setFact(card, myName, 2));
        
        try { runSolver(); } catch(e) {}

        let turnProSolved = null;
        let turnOppSolved = null;
        let turnCount = 0;
        const MAX_TURNS = 120; 

        while ((turnProSolved === null || turnOppSolved === null) && turnCount < MAX_TURNS) {
            turnCount++;
            const currentPlayer = players[currentTurnIndex];
            const currentRoom = rooms[Math.floor(Math.random() * rooms.length)];
            
            let guess;
            
            // TURN: ME
            if (currentPlayer === myName) {
                const unknownSuspects = suspects.filter(c => grid[c].SOL === 0);
                const unknownWeapons = weapons.filter(c => grid[c].SOL === 0);
                let s = unknownSuspects.length > 0 ? unknownSuspects[0] : suspects.find(c => grid[c].SOL === 2);
                let w = unknownWeapons.length > 0 ? unknownWeapons[0] : weapons.find(c => grid[c].SOL === 2);
                if(!s) s = suspects[0];
                if(!w) w = weapons[0];
                guess = [s, w, currentRoom];
            } 
            // TURN: BOT
            else {
                guess = bots[currentPlayer].getGuess(currentRoom);
            }

            // RISPOSTA
            let responder = null;
            let cardShown = null;
            let searchIdx = (currentTurnIndex + 1) % players.length;
            let loops = 0;
            while(loops < players.length - 1) { 
                const p = players[searchIdx];
                const matches = guess.filter(c => trueHands[p].includes(c));
                if (matches.length > 0) {
                    responder = p;
                    cardShown = matches[Math.floor(Math.random() * matches.length)];
                    break;
                }
                searchIdx = (searchIdx + 1) % players.length;
                loops++;
            }

            // UPDATE KNOWLEDGE
            if (responder) {
                // Solver
                let pIdx = (currentTurnIndex + 1) % players.length;
                while(players[pIdx] !== responder) {
                    guess.forEach(c => setFact(c, players[pIdx], 1)); 
                    pIdx = (pIdx + 1) % players.length;
                }
                if (currentPlayer === myName) { setFact(cardShown, responder, 2); } 
                else if (responder !== myName) { addConstraint(responder, guess); }
                try { runSolver(); } catch(e) {}

                // Bots
                bots[currentPlayer].eliminate(cardShown);
            } else {
                // Solver (Negative Deduction)
                let pIdx = (currentTurnIndex + 1) % players.length;
                while (players[pIdx] !== currentPlayer) {
                    guess.forEach(c => setFact(c, players[pIdx], 1));
                    pIdx = (pIdx + 1) % players.length;
                }
                try { runSolver(); } catch(e) {}

                // Check Win Bot
                if (currentPlayer !== myName && turnOppSolved === null) {
                    if (bots[currentPlayer].checkWin(guess, solution)) turnOppSolved = turnCount;
                }
            }

            // Check Win Solver
            if (turnProSolved === null) {
                const foundS = suspects.find(c => grid[c].SOL === 2);
                const foundW = weapons.find(c => grid[c].SOL === 2);
                const foundR = rooms.find(c => grid[c].SOL === 2);
                if (foundS && foundW && foundR) {
                     // Check reale per evitare falsi positivi da deduzioni errate (simulazione bug solver)
                     if (foundS === solution[0] && foundW === solution[1] && foundR === solution[2]) {
                         turnProSolved = turnCount;
                     }
                }
            }
            
            currentTurnIndex = (currentTurnIndex + 1) % players.length;
        }

        return { 
            proTurn: turnProSolved || MAX_TURNS, 
            oppTurn: turnOppSolved || MAX_TURNS 
        };
    }

    // --- RUNNER ---
    console.clear();
    logPermanent(`🚀 CLUEDO MONTE CARLO SIMULATION (${ITERATIONS} iterazioni)`);
    logPermanent(`------------------------------------------------`);
    
    const UPDATE_STEP = Math.max(1, Math.floor(ITERATIONS / 10));

    for (let count of PLAYER_COUNTS) {
        logPermanent(`\n⚙️  ${count} Giocatori...`);
        redrawConsole(`   Simulando... 0%`);
        
        let wins = 0;
        let totalProTurns = 0;
        let totalOppTurns = 0;
        
        const startTime = performance.now();
        
        for (let i = 1; i <= ITERATIONS; i++) {
            const res = playDeathmatch(count);
            
            if (res.proTurn < res.oppTurn) wins++;
            
            totalProTurns += res.proTurn;
            totalOppTurns += res.oppTurn;

            if (i % UPDATE_STEP === 0) {
                setConsole(true);
                const pct = Math.round((i / ITERATIONS) * 100);
                redrawConsole(`   Simulando... ${pct}%`);
                setConsole(false);
                await sleep(0);
            }
        }

        const avgPro = (totalProTurns / ITERATIONS).toFixed(1);
        const avgOpp = (totalOppTurns / ITERATIONS).toFixed(1);
        const winRate = ((wins / ITERATIONS) * 100).toFixed(1);

        logPermanent(`   ✅ Win Rate: ${winRate}% | Pro: ~${avgPro} turni | Avv: ~${avgOpp} turni`);
    }

    logPermanent(`\n🏁 Simulazione completata.`);
    
    // Restore
    window.updateTacticalSuggestions = originalUpdateTactics;
    window.updateTurnUI = originalUpdateTurnUI;
    window.renderGrid = originalRenderGrid;
    window.log = originalAppLog;

})();
