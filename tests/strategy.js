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
        let el = document.getElementById('current-position');
        if (!el) {
            el = document.createElement('input');
            el.id = 'current-position';
            document.body.appendChild(el);
        } else if (el.tagName === 'SELECT') {
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
            // GRUPPO A: AMBIENTE E MOVIMENTO
            // ==========================================
            console.group("🏃 GRUPPO A: Analisi Mappa e Movimento");

            // --- TEST 1: Pathfinding ---
            console.log("%cTEST 1: Rilevamento Passaggi Segreti", TACTIC_STYLE.NOTE);
            resetTacticalEnv();
            const secretDist = (typeof TURN_MATRIX !== 'undefined') && TURN_MATRIX["Cucina"] && TURN_MATRIX["Cucina"]["Studio"];
            if (secretDist <= 1) console.log("%c✅ OK: Passaggio Segreto rilevato.", TACTIC_STYLE.OK);
            else console.log(`%c❌ FAIL: Passaggio Segreto non rilevato.`, TACTIC_STYLE.FAIL);

            // --- TEST 2: Priorità Movimento ---
            console.log("%cTEST 2: Priorità Passaggio Segreto vs Distanza", TACTIC_STYLE.NOTE);
            resetTacticalEnv();
            document.getElementById('current-position').value = "Cucina"; 
            updateTacticalSuggestions();
            const items = document.getElementById('tactical-suggestions').getElementsByClassName('suggestion-item');
            
            let studyScore = -9999, libraryScore = -9999;
            if (items.length > 0) {
                for (let item of items) {
                    const name = item.querySelector('.suggestion-room-name').innerText;
                    const sc = parseInt(item.querySelector('.suggestion-score-val').innerText);
                    if (name === "Studio") studyScore = sc;
                    if (name === "Biblioteca") libraryScore = sc;
                }
                if (studyScore > libraryScore) console.log("%c✅ OK: Studio (Passaggio) preferito a Biblioteca (Lontana).", TACTIC_STYLE.OK);
                else console.log(`%c❌ FAIL: Ranking errato.`, TACTIC_STYLE.FAIL);
            }

            // --- TEST 3 (NUOVO): Fuga da Stanza Inutile ---
            console.log("%cTEST 3: Fuga da Stanza 'Innocente'", TACTIC_STYLE.NOTE);
            const setFact3 = resetTacticalEnv();
            // Scenario: Sono in 'Pranzo'. So che 'Pranzo' NON è la soluzione e NON è mia.
            grid["Pranzo"].SOL = 1; // Non è soluzione
            grid["Pranzo"]["Io"] = 1; // Non è mia
            
            const moves3 = calculateTacticalMoves("Pranzo");
            const stayMove = moves3.find(m => m.room === "Pranzo");
            
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

            // --- TEST 4: Aggressività (Stanza Sicura) ---
            console.log("%cTEST 4: Aggressività in Stanza Sicura", TACTIC_STYLE.NOTE);
            resetTacticalEnv();
            // Cucina è mia (set di base). Non ho altre info.
            const hypo4 = generateHypothesisForRoom("Cucina");
            const usaScudoArma = hypo4.text.includes("Corda");
            const usaScudoSospettato = hypo4.text.includes("Scarlett");

            if (!usaScudoArma && !usaScudoSospettato) {
                console.log(`%c✅ SUCCESSO: Strategia 'Aggressiva' (2 carte ignote) applicata correttamente.`, TACTIC_STYLE.OK);
            } else {
                console.log(`%c⚠️ FAIL: Troppo conservativo. Ha usato uno scudo inutile.`, TACTIC_STYLE.FAIL);
            }

            // --- TEST 5: Bilanciamento (Stanza Sicura + Carta Sicura) ---
            console.log("%cTEST 5: Bilanciamento (Stanza + Carta)", TACTIC_STYLE.NOTE);
            const setFact5 = resetTacticalEnv();
            setFact5("Mustard", "Io", 2); 
            // Ho Mustard (Mio) e sono in Cucina (Mia). 
            // Deve usare 1 scudo (Stanza) e NON usare Mustard, per cercare info sull'Arma e un altro Sospettato.
            const hypo5 = generateHypothesisForRoom("Cucina");
            
            if (hypo5.type.includes("Bilanciata") || hypo5.type.includes("Aggressiva")) {
                console.log(`%c✅ SUCCESSO: Strategia '${hypo5.type}' ottimale per scoprire carte.`, TACTIC_STYLE.OK);
            } else {
                console.log(`%c❌ FAIL: Strategia '${hypo5.type}' non ottimale.`, TACTIC_STYLE.FAIL);
            }
            console.groupEnd();


            // ==========================================
            // GRUPPO C: CASI AVANZATI
            // ==========================================
            console.group("🚀 GRUPPO C: Scenari Avanzati");

            // --- TEST 6: Scorciatoie Late Game ---
            console.log("%cTEST 6: Scorciatoie (Deep Hop)", TACTIC_STYLE.NOTE);
            resetTacticalEnv();
            // Late Game: Manca solo "Ballo"
            allCards.forEach(c => { if (c !== "Ballo" && c !== "Green" && c !== "Pugnale") grid[c].SOL = 1; });
            
            // Sono in Veranda (Lontana da Ballo).
            const moves6 = calculateTacticalMoves("Veranda");
            const topMove6 = moves6[0];

            if (topMove6.room === "Serra") {
                 console.log(`%c✅ GENIALE: Suggerisce 'Serra' come ponte per 'Ballo'.`, TACTIC_STYLE.OK);
            } else if (topMove6.room === "Ballo") {
                 console.log(`%c✅ OK: Punta dritto a 'Ballo'.`, TACTIC_STYLE.OK);
            } else {
                 console.log(`%c⚠️ CHECK: Mossa strana: ${topMove6.room}`, TACTIC_STYLE.NOTE);
            }

            // --- TEST 7 (NUOVO): Vittoria ---
            console.log("%cTEST 7: Riconoscimento Vittoria", TACTIC_STYLE.NOTE);
            resetTacticalEnv();
            // Forziamo la soluzione
            grid["Mustard"].SOL = 2;
            grid["Pugnale"].SOL = 2;
            grid["Ballo"].SOL = 2;

            const moves7 = calculateTacticalMoves("Cucina"); // Sono in cucina
            // Il top score dovrebbe essere BALLO (la stanza del delitto)
            const winMove = moves7[0];

            if (winMove.room === "Ballo" && winMove.hypothesis.type === "Vittoria") {
                console.log(`%c🏆 SUCCESSO: Il sistema ha urlato 'Vittoria' e punta alla stanza del delitto.`, TACTIC_STYLE.OK);
            } else {
                console.log(`%c❌ FAIL: Soluzione trovata ma il bot dorme. Mossa: ${winMove.room}`, TACTIC_STYLE.FAIL);
            }
            console.groupEnd();

        } catch(e) {
            console.error(e);
        }
        console.log("\n%c🏁 TEST COMPLETATI", "font-weight: bold;");
    }

    runTacticalTests();
}
