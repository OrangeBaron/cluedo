{
    // ==========================================
    // CONFIGURAZIONE & STILI
    // ==========================================
    var TACTIC_STYLE = {
        HEAD: "background: #F59E0B; color: black; font-weight: bold; padding: 2px 6px; border-radius: 3px;",
        OK: "color: #10B981; font-weight: bold;",
        FAIL: "color: #EF4444; font-weight: bold;",
        NOTE: "color: #9CA3AF; font-style: italic;"
    };

    // ==========================================
    // HELPER DI SETUP
    // ==========================================

    function ensureDomMocks() {
        // Mock minimo del DOM necessario per far girare tactics.js senza errori
        let el = document.getElementById('current-position');
        if (!el) {
            el = document.createElement('input');
            el.id = 'current-position';
            document.body.appendChild(el);
        } else if (el.tagName === 'SELECT') {
            // Assicuriamoci che le opzioni esistano per i test
            if (!Array.from(el.options).find(o => o.value === "Cucina")) {
                let opt = document.createElement('option'); opt.value = "Cucina"; opt.text = "Cucina"; el.add(opt);
            }
            if (!Array.from(el.options).find(o => o.value === "Studio")) {
                let opt = document.createElement('option'); opt.value = "Studio"; opt.text = "Studio"; el.add(opt);
            }
        }
        if (!document.getElementById('tactical-suggestions')) {
            const div = document.createElement('div');
            div.id = 'tactical-suggestions';
            document.body.appendChild(div);
        }
    }

    function localResetAndSetupGame() {
        // Reset variabili globali del solver
        players = ["Io", "AvversarioA", "AvversarioB"];
        myName = "Io";
        grid = {};
        constraints = [];
        history = [];
        isSimulating = false;

        if (typeof allCards !== 'undefined') {
            allCards.forEach(c => { 
                grid[c] = { SOL: 0 }; 
                players.forEach(p => grid[c][p] = 0); 
            });
        }

        const mockSetFact = (c, p, v) => { 
            if(grid[c]) {
                grid[c][p] = v;
                if (v === 2) grid[c].SOL = 1; 
            }
        };
        
        // Setup Mano Standard
        mockSetFact("Scarlett", "Io", 2);
        mockSetFact("Corda", "Io", 2);
        mockSetFact("Cucina", "Io", 2); 
        
        return mockSetFact; 
    }

    function resetTacticalEnv() {
        const mockFn = localResetAndSetupGame(); 
        if (typeof initPathfinding === 'function') initPathfinding();
        ensureDomMocks();
        return mockFn;
    }

    // ==========================================
    // TEST SUITE COMPLETA
    // ==========================================

    function runTacticalTests() {
        console.clear();
        console.log("%c🔎 AVVIO SUITE TEST TATTICI", "background: #111; color: #F59E0B; font-size: 1.2em; padding: 10px;");
        
        try {
            // ==========================================
            // GRUPPO A: SCELTE DI MOVIMENTO
            // ==========================================
            console.group("🏃 GRUPPO A: Ranking Movimenti");
            // Nota: La matematica pura del pathfinding è testata in pathfinding.js.
            // Qui testiamo se il bot PREFERISCE le mosse giuste.

            // --- TEST 1: Priorità Studio (Passaggio) vs Biblioteca (Lontana) ---
            console.log("%cTEST 1: Priorità Passaggio Segreto vs Distanza", TACTIC_STYLE.NOTE);
            resetTacticalEnv();
            
            // Calcoliamo le mosse partendo dalla Cucina
            const moves1 = calculateTacticalMoves("Cucina");
            
            // Cerchiamo i ranking (indici nell'array ordinato)
            const studioIdx = moves1.findIndex(m => m.room === "Studio");
            const libIdx = moves1.findIndex(m => m.room === "Biblioteca");

            // Studio ha passaggio segreto (dist 0), Biblioteca è lontana.
            // Studio deve apparire PRIMA (indice minore) o avere score più alto.
            if (studioIdx !== -1 && libIdx !== -1 && studioIdx < libIdx) {
                console.log(`%c✅ OK: Studio (Passaggio, rank #${studioIdx+1}) preferito a Biblioteca (Lontana, rank #${libIdx+1}).`, TACTIC_STYLE.OK);
            } else {
                console.log(`%c❌ FAIL: Ranking errato. Studio: #${studioIdx}, Biblioteca: #${libIdx}`, TACTIC_STYLE.FAIL);
            }

            // --- TEST 2: Fuga da Stanza Inutile ---
            console.log("%cTEST 2: Fuga da Stanza 'Innocente'", TACTIC_STYLE.NOTE);
            const setFact2 = resetTacticalEnv();
            
            // Scenario: Sono in 'Pranzo'. So che 'Pranzo' NON è la soluzione e NON è mia.
            // Il bot deve penalizzare pesantemente il restare lì.
            grid["Pranzo"].SOL = 1; // Non è soluzione
            grid["Pranzo"]["Io"] = 1; // Non è mia
            
            const moves2 = calculateTacticalMoves("Pranzo");
            const stayMove = moves2.find(m => m.room === "Pranzo");
            
            if (stayMove && stayMove.score < 0) {
                console.log(`%c✅ OK: Punteggio negativo (${stayMove.score}) per rimanere in stanza inutile.`, TACTIC_STYLE.OK);
            } else {
                console.log(`%c❌ FAIL: Il bot vuole rimanere in una stanza inutile! Score: ${stayMove ? stayMove.score : 'N/A'}`, TACTIC_STYLE.FAIL);
            }
            console.groupEnd();


            // ==========================================
            // GRUPPO B: LOGICA IPOTESI E BLUFF
            // ==========================================
            console.group("🧠 GRUPPO B: Intelligenza Ipotesi");
            
            // Mock object per probabilità vuote per evitare crash se getProbabilities non è definito
            const mockProbs = { solution: {} };

            // --- TEST 3: Aggressività (Stanza Sicura) ---
            console.log("%cTEST 3: Aggressività in Stanza Sicura", TACTIC_STYLE.NOTE);
            resetTacticalEnv();
            // Cucina è mia (set di base). Non ho altre info.
            // Genera ipotesi
            const hypo3 = generateHypothesisForRoom("Cucina", mockProbs);
            
            const usaScudoArma = hypo3.text.includes("Corda");     // Corda è mia
            const usaScudoSospettato = hypo3.text.includes("Scarlett"); // Scarlett è mia

            // Se la stanza è sicura, non dovremmo sprecare slot chiedendo carte che abbiamo (scudi),
            // a meno che non stiamo bluffando pesantemente (ma qui testiamo l'aggressività standard).
            if (!usaScudoArma && !usaScudoSospettato) {
                console.log(`%c✅ SUCCESSO: Strategia 'Aggressiva' (2 carte ignote) applicata correttamente.`, TACTIC_STYLE.OK);
            } else {
                console.log(`%c⚠️ FAIL/WARN: Troppo conservativo. Ha usato uno scudo inutile: ${hypo3.text}`, TACTIC_STYLE.FAIL);
            }

            // --- TEST 4: Bilanciamento (Stanza Sicura + Carta Sicura) ---
            console.log("%cTEST 4: Bilanciamento (Stanza + Carta)", TACTIC_STYLE.NOTE);
            const setFact4 = resetTacticalEnv();
            setFact4("Mustard", "Io", 2); 
            // Ho Mustard (Mio) e sono in Cucina (Mia). 
            // Qui il bot dovrebbe provare a usare lo scudo della stanza (gratis) ma chiedere un'arma ignota.
            
            const hypo4 = generateHypothesisForRoom("Cucina", mockProbs);
            
            if (hypo4.type.includes("Scientist") || hypo4.type.includes("Indagine") || hypo4.type.includes("Breaker")) {
                console.log(`%c✅ SUCCESSO: Strategia '${hypo4.type}' ottimale per scoprire carte.`, TACTIC_STYLE.OK);
            } else {
                console.log(`%c❌ FAIL: Strategia '${hypo4.type}' dubbia in questo contesto.`, TACTIC_STYLE.FAIL);
            }
            console.groupEnd();


            // ==========================================
            // GRUPPO C: CASI AVANZATI
            // ==========================================
            console.group("🚀 GRUPPO C: Scenari Avanzati");

            // --- TEST 5: Scorciatoie Late Game (Deep Hop) ---
            console.log("%cTEST 5: Rilevamento Ponte/Scorciatoia", TACTIC_STYLE.NOTE);
            resetTacticalEnv();
            // Late Game: Manca solo "Ballo" come soluzione possibile
            allCards.forEach(c => { if (c !== "Ballo" && c !== "Green" && c !== "Pugnale") grid[c].SOL = 1; });
            
            // Sono in Veranda. Ballo è lontana (15). Serra è vicina (0 - Passaggio?) No, Serra->Veranda non è passaggio.
            // Veranda -> (Ballo=15)
            // Veranda -> (Biliardo=22) -> non conviene
            // Veranda -> (Studio=17) -> non conviene
            
            // Controlliamo cosa suggerisce da Veranda per andare a Ballo.
            // Nota: Se pathfinding.js funziona, qui verifichiamo solo che la mossa appaia in cima.
            const moves5 = calculateTacticalMoves("Veranda");
            const topMove5 = moves5[0];

            // In molti casi la strategia migliore è avvicinarsi il più possibile.
            // Se esiste una scorciatoia via stanza intermedia, il pathfinding dovrebbe aver ridotto il costo.
            if (topMove5.room === "Ballo") {
                 console.log(`%c✅ OK: Punta dritto a 'Ballo' (Target primario).`, TACTIC_STYLE.OK);
            } else if (moves5.findIndex(m => m.room === "Ballo") < 3) {
                 console.log(`%c✅ OK: 'Ballo' è nella Top 3.`, TACTIC_STYLE.OK);
            } else {
                 console.log(`%c⚠️ CHECK: Mossa strana: ${topMove5.room}`, TACTIC_STYLE.NOTE);
            }

            // --- TEST 6: Riconoscimento Vittoria ---
            console.log("%cTEST 6: Trigger Vittoria", TACTIC_STYLE.NOTE);
            resetTacticalEnv();
            // Forziamo la soluzione nella griglia
            grid["Mustard"].SOL = 2;
            grid["Pugnale"].SOL = 2;
            grid["Ballo"].SOL = 2;

            const moves6 = calculateTacticalMoves("Cucina"); // Sono in cucina
            // Il top score dovrebbe essere BALLO (la stanza del delitto)
            const winMove = moves6[0];

            if (winMove.room === "Ballo") {
                // Verifichiamo che ci sia il flag testuale o il tipo di ipotesi
                if(winMove.reasons.includes("🏆 VITTORIA") || winMove.hypothesis.type.includes("Checkmate")) {
                     console.log(`%c🏆 SUCCESSO: Il sistema ha urlato 'VITTORIA' e punta alla stanza del delitto.`, TACTIC_STYLE.OK);
                } else {
                     console.log(`%c⚠️ PARTIAL: Punta alla stanza giusta ma senza flag Vittoria esplicito.`, TACTIC_STYLE.NOTE);
                }
            } else {
                console.log(`%c❌ FAIL: Soluzione trovata ma il bot punta altrove: ${winMove.room}`, TACTIC_STYLE.FAIL);
            }
            console.groupEnd();

        } catch(e) {
            console.error("Errore durante i test:", e);
        }
        console.log("\n%c🏁 TEST COMPLETATI", "font-weight: bold;");
    }

    runTacticalTests();
}
