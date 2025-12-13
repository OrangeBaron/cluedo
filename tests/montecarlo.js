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
    
    // Disabilitiamo solo le funzioni che toccano il DOM
    window.updateTacticalSuggestions = () => {};
    window.updateTurnUI = () => {};
    window.renderGrid = () => {};
    window.log = () => {}; 

    // Assicuriamoci che il pathfinding sia inizializzato
    if(typeof initPathfinding === 'function') initPathfinding();

    // --- SETUP DATI ---
    const PLAYER_COUNTS = [3, 4, 5, 6];
    const POOL_NAMES = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank"];

    // --- SMART BOT LOGIC V4 ---
    class SmartBot {
        constructor(name, hand) {
            this.name = name;
            this.hand = new Set(hand);
            // Liste di carte CANDIDATE (che non ho e non ho visto in mano ad altri)
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
            // ==================================================
            // 1. LOGICA MOVIMENTO (Priorità: Scoperta > Strategia)
            // ==================================================
            let finalRoom = currentRoom;
            
            // Analisi raggiungibilità
            const reachable = rooms.filter(r => {
                if (r === currentRoom) return false;
                const dist = (typeof ROOM_DISTANCES !== 'undefined' && ROOM_DISTANCES[currentRoom]) 
                             ? ROOM_DISTANCES[currentRoom][r] : 999;
                return dist <= 7; 
            });

            // 1. Cerca stanze che sono ancora potenziali soluzioni (Ignote)
            const potentialSolutionRooms = reachable.filter(r => this.rooms.includes(r));
            
            // 2. Cerca stanze mie (per usare la "Tecnica del Martello" se la stanza è risolta)
            const myRooms = reachable.filter(r => this.hand.has(r));

            if (this.rooms.includes(currentRoom)) {
                // Se sono in una stanza che potrebbe essere il delitto, RESTO QUI per verificarla.
                finalRoom = currentRoom;
            } else if (potentialSolutionRooms.length > 0) {
                // Se ci sono stanze ignote vicine, CI VADO SUBITO.
                finalRoom = potentialSolutionRooms[Math.floor(Math.random() * potentialSolutionRooms.length)];
            } else if (myRooms.length > 0) {
                // Se tutte le stanze vicine sono note (viste ad altri), vado in una MIA.
                // Usando una mia stanza, costringo gli altri a rispondere su Sospettato/Arma.
                finalRoom = myRooms[Math.floor(Math.random() * myRooms.length)];
            } else {
                // Fallback: muovi a caso se non c'è nulla di utile
                if (reachable.length > 0) finalRoom = reachable[Math.floor(Math.random() * reachable.length)];
            }

            // ==================================================
            // 2. LOGICA IPOTESI
            // ==================================================
            
            let selection = { S: null, W: null };
            
            // Definiamo un budget limitato per il bluff (max 1 carta totale tra S e W)
            // Il bluff serve solo a confondere, ma non deve rallentare la mia indagine.
            let bluffBudget = (Math.random() > 0.8) ? 1 : 0; // Solo 20% di chance di fare un bluff
            
            // Se la stanza finale è mia, conta già come "uso di carta propria"
            if (this.hand.has(finalRoom)) bluffBudget = 0;

            ['S', 'W'].forEach(type => {
                let candidates = (type === 'S') ? this.suspects : this.weapons;
                let myCards = (type === 'S') ? suspects.filter(c => this.hand.has(c)) : weapons.filter(c => this.hand.has(c));
                let chosen = null;

                // CASO 1: CATEGORIA RISOLTA (So chi è stato)
                // Strategia "Hammer": Chiedo la SOLUZIONE.
                // Nessuno può mostrarla (è nella busta). Forzo risposte sull'altra categoria.
                if (candidates.length === 1) {
                    chosen = candidates[0]; 
                }
                // CASO 2: CATEGORIA ANCORA APERTA
                else if (candidates.length > 1) {
                    // Provo a usare una carta IGNOTA (Indagine)
                    chosen = candidates[Math.floor(Math.random() * candidates.length)];
                    
                    // Piccola chance di bluffare SE ho budget e carte disponibili
                    // (Serve a non rendere ovvio che non ho quella carta)
                    if (bluffBudget > 0 && myCards.length > 0) {
                        chosen = myCards[Math.floor(Math.random() * myCards.length)];
                        bluffBudget--;
                    }
                }
                // CASO 3: IMPOSSIBILE (Lista vuota) - Fallback tecnico
                else {
                    let allPool = (type === 'S') ? suspects : weapons;
                    chosen = allPool[Math.floor(Math.random() * allPool.length)];
                }

                selection[type] = chosen;
            });

            return [selection.S, selection.W, finalRoom];
        }

        checkWin(guess, solution) {
            const unheld = guess.filter(c => !this.hand.has(c));
            if (unheld.length === 3) {
                return (guess[0] === solution[0] && guess[1] === solution[1] && guess[2] === solution[2]);
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
            
            // Simula posizione iniziale casuale (dove inizia il turno)
            const startRoom = rooms[Math.floor(Math.random() * rooms.length)];
            let guess;
            
            // --- TURN: ME (SOLVER PRO TACTICAL) ---
            if (currentPlayer === myName) {
                // 1. Chiedi al motore tattico la mossa migliore partendo da startRoom
                const rankedMoves = calculateTacticalMoves(startRoom);
                const bestMove = rankedMoves[0]; // Prendi la migliore

                // 2. "Muovi" nella stanza suggerita (potrebbe essere la stessa)
                const finalRoom = bestMove.room;
                
                // 3. Formula l'ipotesi suggerita dal motore tattico
                // (Se il gioco è risolto, il motore tattico potrebbe dare null, gestiamo il fallback)
                let s = bestMove.hypothesis.suspect;
                let w = bestMove.hypothesis.weapon;
                
                if (!s) s = suspects.find(c => grid[c].SOL === 2) || suspects[0];
                if (!w) w = weapons.find(c => grid[c].SOL === 2) || weapons[0];

                guess = [s, w, finalRoom];
            } 
            // --- TURN: BOT (AVVERSARIO) ---
            else {
                // Il bot sceglie a caso una stanza o resta dove è (semplificato)
                guess = bots[currentPlayer].getGuess(startRoom);
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
                     // Check reale per evitare falsi positivi
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
    logPermanent(`-----------------------------------------------------------`);
    
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

    logPermanent(`\n🏁 Simulazione Tattica completata.`);
    
    // Restore
    window.updateTacticalSuggestions = originalUpdateTactics;
    window.updateTurnUI = originalUpdateTurnUI;
    window.renderGrid = originalRenderGrid;
    window.log = originalAppLog;

})();
