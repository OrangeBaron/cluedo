// ==========================================
// CONFIGURAZIONE TEST SUITE
// ==========================================
const TEST_STYLE = {
    HEADER: "font-weight: bold; font-size: 1.1em; color: #fff; background: #333; padding: 2px 5px; border-radius: 3px;",
    SUCCESS: "color: #4ade80; font-weight: bold;", // Verde brillante uniforme
    ERROR: "color: #ef4444; font-weight: bold;",
    INFO: "color: #94a3b8;"
};

// ==========================================
// FUNZIONE DI RESET E SETUP (Comune a tutti)
// ==========================================
function resetAndSetupGame() {
    console.groupEnd(); // Chiude eventuali gruppi precedenti
    
    players = ["Io", "AvversarioA", "AvversarioB"];
    myName = "Io";
    grid = {};
    constraints = [];
    history = [];
    fullGameLogs = [];
    isSimulating = false;

    // Inizializza griglia vuota
    allCards.forEach(c => { 
        grid[c] = { SOL: 0 }; 
        players.forEach(p => grid[c][p] = 0); 
    });

    // Impostiamo limiti di carte fittizi
    limits = {
        "Io": 6,
        "AvversarioA": 6,
        "AvversarioB": 6
    };

    // Mano iniziale standard per i test
    setFact("Scarlett", "Io", 2);
    setFact("Corda", "Io", 2);
    setFact("Cucina", "Io", 2);
    
    // Pulisce la visuale grafica precedente (se presente nel DOM)
    try { renderGrid(); } catch(e) {}
}

// ==========================================
// 1. TEST FONDAMENTALI (Meccaniche Base)
// ==========================================

function runTest1_Passing() {
    resetAndSetupGame();
    console.group("TEST 1: Logica del Passo (Informazione Negativa)");
    console.log("%cScenario: AvversarioB passa su {White, Rivoltella, Studio}", TEST_STYLE.INFO);

    let cardsAsked = ["White", "Rivoltella", "Studio"];
    let playerPassing = "AvversarioB";

    cardsAsked.forEach(c => setFact(c, playerPassing, 1)); 
    runSolver();

    // VERIFICA
    let passed = cardsAsked.every(c => grid[c][playerPassing] === 1);

    if (passed) {
        console.log("%c✅ SUCCESSO: Carte segnate correttamente come NON possedute.", TEST_STYLE.SUCCESS);
    } else {
        console.log("%c❌ FALLIMENTO: La griglia non riflette il passo.", TEST_STYLE.ERROR);
    }
    console.groupEnd();
}

function runTest2_BasicExclusion() {
    resetAndSetupGame();
    console.group("TEST 2: Esclusione Logica (Risoluzione Vincoli)");
    console.log("%cScenario: Vincolo {Mustard, Pugnale, Veranda}. Due vengono eliminate.", TEST_STYLE.INFO);

    addConstraint("AvversarioA", ["Mustard", "Pugnale", "Veranda"]);
    
    // Eliminiamo due opzioni
    setFact("Mustard", "AvversarioA", 1); 
    setFact("Pugnale", "AvversarioA", 1); 

    runSolver();

    // VERIFICA: Deve rimanere Veranda
    if (grid["Veranda"]["AvversarioA"] === 2) {
        console.log("%c✅ SUCCESSO: Deduzione confermata. AvversarioA possiede VERANDA.", TEST_STYLE.SUCCESS);
    } else {
        console.log("%c❌ FALLIMENTO: Il vincolo non è stato risolto.", TEST_STYLE.ERROR);
    }
    console.groupEnd();
}

// ==========================================
// 2. TEST MATEMATICI (Limiti e Conteggi)
// ==========================================

function runTest3_HandSaturation() {
    resetAndSetupGame();
    console.group("TEST 3: Saturazione della Mano (Limiti)");
    console.log("%cScenario: AvversarioA ha limite 3. Assegniamo 3 carte note.", TEST_STYLE.INFO);

    limits["AvversarioA"] = 3;
    setFact("Green", "AvversarioA", 2);
    setFact("Tubo", "AvversarioA", 2);
    setFact("Ballo", "AvversarioA", 2);

    runSolver();

    // VERIFICA: Tutte le altre carte devono essere 1 (NO)
    if (grid["Plum"]["AvversarioA"] === 1 && grid["Rivoltella"]["AvversarioA"] === 1) {
        console.log("%c✅ SUCCESSO: Mano satura. Tutte le carte eccedenti sono state marcate come 'NO'.", TEST_STYLE.SUCCESS);
    } else {
        console.log("%c❌ FALLIMENTO: Il sistema non ha chiuso la mano satura.", TEST_STYLE.ERROR);
    }
    console.groupEnd();
}

// ==========================================
// 3. TEST INTERAZIONE GIOCATORE
// ==========================================

function runTest4_PrivateReveal() {
    resetAndSetupGame();
    console.group("TEST 4: Rivelazione Privata (Input Utente)");
    console.log("%cScenario: Domanda generica, ma 'Io' vedo specificamente la RIVOLTELLA.", TEST_STYLE.INFO);

    // Vincolo generico per il sistema
    addConstraint("AvversarioA", ["Mustard", "Rivoltella", "Studio"]);

    // Input specifico dell'utente (override logico)
    setFact("Rivoltella", "AvversarioA", 2);

    runSolver();

    // VERIFICA: Rivoltella assegnata, le altre NON devono essere dedotte come NO (potrebbe averle)
    const assigned = grid["Rivoltella"]["AvversarioA"] === 2;
    const unknownMustard = grid["Mustard"]["AvversarioA"] === 0;

    if (assigned && unknownMustard) {
        console.log("%c✅ SUCCESSO: Rivelazione registrata senza corruzione logica delle altre carte.", TEST_STYLE.SUCCESS);
    } else {
        console.log("%c❌ FALLIMENTO: Stato incoerente post-rivelazione.", TEST_STYLE.ERROR);
    }
    console.groupEnd();
}

function runTest5_BluffMechanic() {
    resetAndSetupGame();
    console.group("TEST 5: Meccanica del Bluff (Incrocio Dati Privati)");
    console.log("%cScenario: Io ho {Corda, Cucina}. Chiedo {Mustard, Corda, Cucina}. Avversario risponde.", TEST_STYLE.INFO);
    
    // Il sistema sa già che ho Corda e Cucina dal resetAndSetupGame
    
    // L'avversario mostra una carta per quel gruppo
    addConstraint("AvversarioA", ["Mustard", "Corda", "Cucina"]);

    runSolver();

    // VERIFICA: AvversarioA deve avere Mustard per forza
    if (grid["Mustard"]["AvversarioA"] === 2) {
        console.log("%c✅ SUCCESSO: Il sistema ha filtrato le carte mie e dedotto MUSTARD all'avversario.", TEST_STYLE.SUCCESS);
    } else {
        console.log("%c❌ FALLIMENTO: Il bluff non è stato sfruttato per la deduzione.", TEST_STYLE.ERROR);
    }
    console.groupEnd();
}

// ==========================================
// 4. TEST DEDUZIONE AVANZATA
// ==========================================

function runTest6_SolutionFinding() {
    resetAndSetupGame();
    console.group("TEST 6: Identificazione Soluzione");
    console.log("%cScenario: Tutte le armi tranne CHIAVE sono localizzate.", TEST_STYLE.INFO);

    // Assegniamo 5 armi su 6
    setFact("Candeliere", "AvversarioA", 2);
    setFact("Pugnale", "AvversarioB", 2);
    setFact("Tubo", "AvversarioA", 2);
    setFact("Rivoltella", "AvversarioB", 2);
    // Corda è in mano mia (da setup)

    runSolver();

    // VERIFICA
    if (grid["Chiave"].SOL === 2) {
        console.log("%c✅ SUCCESSO: Soluzione trovata. L'arma del delitto è CHIAVE.", TEST_STYLE.SUCCESS);
    } else {
        console.log("%c❌ FALLIMENTO: La soluzione non è stata identificata.", TEST_STYLE.ERROR);
    }
    console.groupEnd();
}

function runTest7_DeepScan() {
    resetAndSetupGame();
    console.group("TEST 7: Deep Scan (Deduzione per Assurdo)");
    console.log("%cScenario: Vincoli complessi risolvibili solo ipotizzando e trovando contraddizioni.", TEST_STYLE.INFO);

    // Setup: Riempiamo AvversarioA lasciando 1 solo slot
    let dummyCards = ["Candeliere", "Chiave", "Serra", "Biblioteca", "Pranzo"];
    dummyCards.forEach(c => setFact(c, "AvversarioA", 2));

    // Vincoli ambigui che richiedono simulazione
    addConstraint("AvversarioA", ["Peacock", "Plum"]);     
    addConstraint("AvversarioA", ["Peacock", "Ingresso"]); 

    runSolver(); // Dovrebbe innescare automaticamente DeepScan se si blocca

    // VERIFICA
    if (grid["Peacock"]["AvversarioA"] === 2) {
        console.log("%c✅ SUCCESSO: Deep Scan ha risolto l'ambiguità. Deduzione: PEACOCK.", TEST_STYLE.SUCCESS);
    } else {
        console.log("%c⚠️ FALLIMENTO/WARNING: Deep Scan non attivato o fallito.", "color: orange");
        // Forziamo esecuzione manuale per debug se fallisce
        runDeepScan();
        if (grid["Peacock"]["AvversarioA"] === 2) console.log("%c✅ RECUPERATO: Deep Scan manuale ha funzionato.", TEST_STYLE.SUCCESS);
    }
    console.groupEnd();
}

// ==========================================
// 5. ROBUSTEZZA ED ERRORI
// ==========================================

function runTest8_ErrorHandling() {
    resetAndSetupGame();
    console.group("TEST 8: Gestione Errori e Contraddizioni");
    console.log("%cScenario: Tentativo di inserire un dato che contraddice la conoscenza attuale.", TEST_STYLE.INFO);
    
    console.log("Stato: 'Io' ho la Corda. Provo ad assegnare Corda ad AvversarioA.");

    // Azione Illegale
    const consoleErrorSpy = console.error; // Sopprimiamo momentaneamente l'errore visivo standard se vogliamo pulizia
    setFact("Corda", "AvversarioA", 2);

    // VERIFICA: Il dato non deve cambiare
    const state = grid["Corda"]["AvversarioA"];

    if (state === 1) { // 1 significa NO (perché ce l'ho io)
        console.log("%c✅ SUCCESSO: Contraddizione rifiutata. Lo stato è rimasto coerente.", TEST_STYLE.SUCCESS);
    } else {
        console.log("%c❌ FALLIMENTO CRITICO: Contraddizione accettata.", TEST_STYLE.ERROR);
    }
    console.groupEnd();
}

// ==========================================
// ESECUZIONE SEQUENZIALE
// ==========================================
async function runAllTests() {
    console.clear();
    console.log("%c🚀 AVVIO SUITE DI TEST CLUEDO SOLVER", "background: #111; color: white; padding: 10px; font-size: 1.2em; border-radius: 5px;");

    // 1. Base
    runTest1_Passing();
    runTest2_BasicExclusion();
    
    // 2. Matematica
    runTest3_HandSaturation();
    
    // 3. Interazione
    runTest4_PrivateReveal();
    runTest5_BluffMechanic();
    
    // 4. Avanzati
    runTest6_SolutionFinding();
    runTest7_DeepScan();
    
    // 5. Robustezza
    runTest8_ErrorHandling();

    console.log("\n%c🏁 ESECUZIONE TERMINATA", "font-weight: bold; font-size: 1.1em;");
    try { renderGrid(); } catch(e) {}
}

// Lancia la suite
runAllTests();