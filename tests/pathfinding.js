(function runPathfindingTest() {
    console.clear();
    console.log("%c🧪 VERIFICA SCORCIATOIE TATTICHE", "background: #222; color: #bada55; padding: 6px; font-weight: bold; font-size: 1.2em; border-radius: 4px;");

    // 1. CHECK PRELIMINARE: TACTICS.JS
    if (typeof initPathfinding !== 'function' || typeof calculateTacticalMoves !== 'function') {
        return console.error("❌ ERRORE CRITICO: tactics.js non caricato.");
    }

    // 2. MOCK SETUP (Se la partita non è iniziata, creiamo dati finti per non far crashare il solver)
    if (typeof grid === 'undefined' || Object.keys(grid).length === 0) {
        console.log("⚠️ Nessuna partita attiva. Inizializzazione dati di test...");
        
        // Setup minimo variabili globali
        if (typeof players === 'undefined' || players.length === 0) players = ["Io", "Bot"];
        if (typeof myName === 'undefined' || !myName) myName = "Io";
        
        // Popoliamo la griglia vuota (codice preso da solver.js)
        grid = {};
        allCards.forEach(c => { 
            grid[c] = { SOL: 0 }; 
            players.forEach(p => grid[c][p] = 0); 
        });
        
        // Definiamo limiti carte finti
        if (typeof limits === 'undefined') limits = {};
        players.forEach(p => limits[p] = 3);
        
        console.log("✅ Dati di test generati.");
    }

    // 3. INIZIALIZZAZIONE FLOYD-WARSHALL
    console.log("🔄 Re-inizializzazione Matrice Floyd-Warshall...");
    initPathfinding();

    let passed = 0, failed = 0;

    function assert(label, condition, debugInfo) {
        if (condition) {
            console.log(`%c✅ PASS: ${label}`, "color: #4ade80; font-weight: bold;");
            passed++;
        } else {
            console.log(`%c❌ FAIL: ${label}`, "color: #ef4444; font-weight: bold;");
            if (debugInfo) console.log(`   └─ Dettagli: ${debugInfo}`);
            failed++;
        }
    }

    // --- TEST 1: Passaggio Segreto Diretto ---
    const costSecret = TRAVEL_COSTS["Cucina"]["Studio"];
    assert(
        "Passaggio Segreto Diretto (Cucina->Studio) costa 1 turno", 
        Math.abs(costSecret - 1.0) < 0.01, 
        `Costo rilevato: ${costSecret}`
    );

    // --- TEST 2: Scorciatoia Composta ---
    const directDist = ROOM_DISTANCES["Serra"]["Ingresso"]; // 20
    const costOldAlgo = Math.ceil(directDist / 7); // 3
    const costNewAlgo = TRAVEL_COSTS["Serra"]["Ingresso"]; // ~2.59

    assert(
        "Rilevata scorciatoia Serra -> Ingresso (via Veranda)",
        costNewAlgo < costOldAlgo - 0.2, 
        `Diretto: ${costOldAlgo} turni | Ottimizzato: ${costNewAlgo.toFixed(2)} turni`
    );

    assert(
        "Calcolo matematico scorciatoia corretto (~2.6)",
        Math.abs(costNewAlgo - 2.59) < 0.1,
        `Atteso: ~2.59 | Reale: ${costNewAlgo.toFixed(2)}`
    );

    // --- TEST 3: Verifica Output UI ---
    // Usiamo try-catch per evitare che il test si blocchi se calculateTacticalMoves fallisce per altri motivi
    try {
        const moves = calculateTacticalMoves("Serra");
        const entryMove = moves.find(m => m.room === "Ingresso");

        if (entryMove) {
            const hasTag = entryMove.reasons.some(r => r.includes("Scorciatoia") || r.includes("Passaggio")) || 
                           (entryMove.moveLabel && entryMove.moveLabel.includes("Passaggio"));
            
            assert(
                "UI segnala visivamente la scorciatoia",
                hasTag,
                `Label: "${entryMove.moveLabel}" | Tags: ${entryMove.reasons.join(", ")}`
            );

            assert(
                "UI mostra i turni ottimizzati",
                Math.abs(entryMove.turnsEst - costNewAlgo) < 0.1,
                `UI mostra ${entryMove.turnsEst}, matrice dice ${costNewAlgo.toFixed(2)}`
            );
        } else {
            assert("Mossa 'Ingresso' presente nei suggerimenti", false, "Ingresso non trovato nell'elenco mosse");
        }
    } catch(e) {
        console.error("Errore durante calculateTacticalMoves:", e);
        assert("Esecuzione calculateTacticalMoves", false, "Eccezione lanciata (vedi log)");
    }

    console.log(`\n🏁 RISULTATO: ${passed}/${passed+failed} Test Superati.`);
})();