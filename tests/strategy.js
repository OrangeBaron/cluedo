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
    // HELPER DI SETUP (Fixed Scope & Logic)
    // ==========================================

    function ensureDomMocks() {
        let el = document.getElementById('current-position');
        if (!el) {
            el = document.createElement('input');
            el.id = 'current-position';
            document.body.appendChild(el);
        } else if (el.tagName === 'SELECT') {
            let opt = Array.from(el.options).find(o => o.value === "Cucina");
            if (!opt) {
                opt = document.createElement('option');
                opt.value = "Cucina";
                opt.text = "Cucina (Test)";
                el.add(opt);
            }
        }
        if (!document.getElementById('tactical-suggestions')) {
            const div = document.createElement('div');
            div.id = 'tactical-suggestions';
            document.body.appendChild(div);
        }
    }

    function localResetAndSetupGame() {
        // FIX 1: Aggiornamento diretto delle variabili globali (senza window.)
        // per garantire che tactics.js legga i valori corretti.
        players = ["Io", "AvversarioA", "AvversarioB"];
        myName = "Io";
        
        grid = {};
        constraints = [];
        history = [];
        isSimulating = false;

        // Init Grid
        if (typeof allCards !== 'undefined') {
            allCards.forEach(c => { 
                grid[c] = { SOL: 0 }; 
                players.forEach(p => grid[c][p] = 0); 
            });
        }

        // FIX 2: Mock setFact più intelligente che aggiorna SOL
        // Se io ho una carta, SOL deve diventare 1 (Non è la soluzione)
        const mockSetFact = (c, p, v) => { 
            if(grid[c]) {
                grid[c][p] = v;
                if (v === 2) grid[c].SOL = 1; 
            }
        };
        
        // Setup Mano Standard: Cucina, Corda, Scarlett
        mockSetFact("Scarlett", "Io", 2);
        mockSetFact("Corda", "Io", 2);
        mockSetFact("Cucina", "Io", 2); 
        
        return mockSetFact; // Ritorniamo la funzione per usarla nei test specifici
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
        console.log("%c🔎 AVVIO SUITE TEST TATTICI (v4 Fixed)", "background: #111; color: #F59E0B; font-size: 1.2em; padding: 10px;");
        
        try {
            // --- TEST 1: Pathfinding ---
            console.group("🧭 TEST 1: Pathfinding");
            resetTacticalEnv();
            const secretDist = (typeof TURN_MATRIX !== 'undefined') && TURN_MATRIX["Cucina"] && TURN_MATRIX["Cucina"]["Studio"];
            if (secretDist <= 1) console.log("%c✅ OK: Passaggio Segreto rilevato.", TACTIC_STYLE.OK);
            else console.log(`%c❌ FAIL: Passaggio Segreto non rilevato.`, TACTIC_STYLE.FAIL);
            console.groupEnd();

            // --- TEST 2: Scudi ---
            console.group("🛡️ TEST 2: Intelligenza Ipotesi (Scudi)");
            resetTacticalEnv();
            console.log("%cScenario: Ho 'Corda' e 'Cucina' e 'Scarlett'. Cucina è la stanza corrente.", TACTIC_STYLE.NOTE);
            
            const hypo = generateHypothesisForRoom("Cucina");
            
            // Il sistema può usare O 'Corda' O 'Scarlett' come scudo. Entrambi vanno bene.
            const usaScudoArma = hypo.text.includes("Corda");
            const usaScudoSospettato = hypo.text.includes("Scarlett");

            if (usaScudoArma || usaScudoSospettato) {
                console.log(`%c✅ SUCCESSO: Ipotesi (${hypo.text}) usa uno scudo valido (Corda o Scarlett).`, TACTIC_STYLE.OK);
            } else {
                console.log(`%c⚠️ FAIL: Ipotesi (${hypo.text}) non usa nessuna delle carte sicure in mano!`, TACTIC_STYLE.FAIL);
            }
            console.groupEnd();

            // --- TEST 3: Strategia ---
            console.group("🧠 TEST 3: Riconoscimento Strategia (Forzatura)");
            const setFactMock = resetTacticalEnv();
            
            // Setup: Ho Mustard (Sospettato) e Cucina (Stanza). Manca Arma.
            setFactMock("Mustard", "Io", 2); 

            console.log("%cScenario: Ho 'Mustard' e 'Cucina'. Manca l'Arma.", TACTIC_STYLE.NOTE);
            
            const hypoStrategy = generateHypothesisForRoom("Cucina");
            
            // Ora che myName è corretto, myCount dovrebbe essere 2 (Mustard + Cucina)
            // L'arma proposta sarà ignota, quindi totale carte note = 2.
            if (hypoStrategy.type && hypoStrategy.type.includes("Forzatura")) {
                console.log(`%c✅ SUCCESSO: Strategia '${hypoStrategy.type}' corretta.`, TACTIC_STYLE.OK);
            } else {
                console.log(`%c❌ FAIL: Atteso 'Forzatura', ottenuto '${hypoStrategy.type}'.`, TACTIC_STYLE.FAIL);
                // Debug info
                const s = hypoStrategy.text; 
                console.log(`Debug: Ipotesi="${s}", Grid[Mustard][Io]=${grid["Mustard"]["Io"]}, MyName="${myName}"`);
            }
            console.groupEnd();

            // --- TEST 4: Ranking ---
            console.group("📊 TEST 4: Ranking Movimento");
            resetTacticalEnv();
            document.getElementById('current-position').value = "Cucina"; 
            updateTacticalSuggestions();
            
            const container = document.getElementById('tactical-suggestions');
            const items = container.getElementsByClassName('suggestion-item');
            
            let studyScore = -9999, libraryScore = -9999;
            if (items.length > 0) {
                for (let item of items) {
                    const name = item.querySelector('.suggestion-room-name').innerText;
                    const score = parseInt(item.querySelector('.suggestion-score-val').innerText);
                    if (name === "Studio") studyScore = score;
                    if (name === "Biblioteca") libraryScore = score;
                }
                if (studyScore > libraryScore) console.log("%c✅ OK: Passaggio segreto preferito.", TACTIC_STYLE.OK);
                else console.log("%c❌ FAIL: Ranking illogico.", TACTIC_STYLE.FAIL);
            } else {
                console.log("%c❌ FAIL: Nessun suggerimento.", TACTIC_STYLE.FAIL);
            }
            console.groupEnd();

        } catch(e) {
            console.error("Errore imprevisto:", e);
        }
        console.log("\n%c🏁 TEST COMPLETATI", "font-weight: bold;");
    }

    runTacticalTests();
}