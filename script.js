/**
 * script.js
 * Gestisce l'interfaccia utente (DOM), gli eventi e coordina Solver e Tactics.
 * Dipende da: solver.js, tactics.js
 */

// --- GLOBAL VARS (UI ONLY) ---
// Nota: players, grid, constraints, etc. sono definiti in solver.js
let myName = "";
let myExpectedCount = 0;
let currentTurnIndex = 0;
let fullGameLogs = [];

// --- SETUP FUNCTIONS ---

function handleEnter(e) { 
    if(e.key === 'Enter') addPlayer(); 
}

function addPlayer() {
    // 'players' è definita globalmente in solver.js
    if (players.length >= 6) return;
    
    const input = document.getElementById('new-player');
    const name = input.value.trim();
    
    if (name && !players.includes(name)) {
        players.push(name);
        document.getElementById('player-list').innerHTML += `<span class="player-tag">${players.length}. ${name}</span>`;
        
        const meSelect = document.getElementById('who-am-i');
        const opt1 = document.createElement('option'); 
        opt1.value = name; 
        opt1.text = name; 
        meSelect.appendChild(opt1);
        
        input.value = ''; 
        input.focus();

        if (players.length >= 6) {
            input.disabled = true; 
            input.placeholder = "Max players reached";
        }
    } else if (players.includes(name)) {
        alert("Giocatore già presente!");
    }
}

function goToHandSelection() {
    if (players.length < 2) return alert("Minimo 2 giocatori!");
    myName = document.getElementById('who-am-i').value;
    if(!myName) return alert("Chi sei tu?");

    // Calcolo matematico distribuzione carte
    const myIndex = players.indexOf(myName);
    const baseCount = Math.floor(CARDS_IN_DECK / players.length);
    const remainder = CARDS_IN_DECK % players.length;
    
    myExpectedCount = baseCount + (myIndex < remainder ? 1 : 0);

    updateHandCountUI(0);

    const createChecks = (list, containerId) => {
        const div = document.getElementById(containerId);
        div.innerHTML = "";
        list.forEach(c => {
            div.innerHTML += `<label class="check-card"><input type="checkbox" value="${c}" class="init-card-check" onchange="updateHandCountUI()"><span>${c}</span></label>`;
        });
    };

    createChecks(suspects, 'hand-suspects');
    createChecks(weapons, 'hand-weapons');
    createChecks(rooms, 'hand-rooms');

    switchView('view-setup', 'view-hand');
}

function updateHandCountUI() {
    const current = document.querySelectorAll('.init-card-check:checked').length;
    const badge = document.getElementById('hand-counter-badge');
    
    badge.innerText = `Selezionate: ${current} / ${myExpectedCount}`;
    
    if (current === myExpectedCount) {
        badge.classList.add('valid');
    } else {
        badge.classList.remove('valid');
    }
}

function finalizeSetup() {
    const checks = document.querySelectorAll('.init-card-check:checked');
    
    if (checks.length !== myExpectedCount) {
        alert(`Attenzione! Dovresti avere ${myExpectedCount} carte. Ne hai selezionate ${checks.length}.`);
        return;
    }

    // Inizializza la Griglia (definita in solver.js)
    allCards.forEach(c => { 
        grid[c] = { SOL: 0 }; 
        players.forEach(p => grid[c][p] = 0); 
    });

    // Imposta le mie carte come "Viste" (2)
    checks.forEach(chk => setFact(chk.value, myName, 2)); // setFact è in solver.js

    // Calcola i limiti carte per tutti (Logica limiti definita qui per setup)
    const baseCount = Math.floor(CARDS_IN_DECK / players.length);
    const remainder = CARDS_IN_DECK % players.length;
    players.forEach((p, index) => { 
        limits[p] = baseCount + (index < remainder ? 1 : 0); 
    });

    // Configurazione UI Dropdowns
    populateSelect('turn-asker', players); 
    populateSelect('turn-responder', players, true);
    populateSelect('turn-suspect', suspects, false, "👤 Sospettato");
    populateSelect('turn-weapon', weapons, false, "🔫 Arma");
    populateSelect('turn-room', rooms, false, "🏰 Stanza");
    
    // Configurazione Tattica (Tactics.js)
    populateSelect('current-position', rooms);
    initPathfinding(); // Da tactics.js

    currentTurnIndex = 0;
    updateTurnUI(); 

    switchView('view-hand', 'view-game');
    
    // Prima esecuzione Solver
    runSolver(); // Da solver.js
    updateTacticalSuggestions(); // Da tactics.js
}

// --- TURN MANAGEMENT ---

function updateTurnUI() {
    document.getElementById('turn-asker').value = players[currentTurnIndex];
    checkSpecialInput();
    checkBluffUI();
}

function checkBluffUI() {
    const s = document.getElementById('turn-suspect').value;
    const w = document.getElementById('turn-weapon').value;
    const r = document.getElementById('turn-room').value;
    const asker = document.getElementById('turn-asker').value;
    const indicator = document.getElementById('bluff-indicator');
    
    if (!asker) {
        indicator.innerHTML = "";
        return;
    }

    // Controlla se l'asker possiede già una delle carte che chiede
    let bluffs = [s, w, r].filter(c => c && grid[c] && grid[c][asker] === 2);
    
    if (bluffs.length > 0) {
        if (asker === myName) {
            indicator.style.color = "var(--success)";
            indicator.innerHTML = `🤫 Stai bluffando su: <b>${bluffs.join(', ')}</b>`;
        } else {
            indicator.style.color = "var(--accent)";
            indicator.innerHTML = `⚠️ <b>${asker}</b> sta bluffando! Ha: <b>${bluffs.join(', ')}</b>`;
        }
    } else {
        indicator.innerHTML = "";
    }
}

function checkSpecialInput() {
    const asker = document.getElementById('turn-asker').value;
    const responder = document.getElementById('turn-responder').value;
    const box = document.getElementById('private-reveal-box');
    const select = document.getElementById('turn-card-shown');

    // Mostra il box "Che carta hai visto?" solo se IO ho chiesto e QUALCUNO ha risposto
    if (asker === myName && responder !== 'none' && responder !== '' && responder !== myName) {
        box.classList.remove('hidden');
        const s = document.getElementById('turn-suspect').value;
        const w = document.getElementById('turn-weapon').value;
        const r = document.getElementById('turn-room').value;
        
        const currentVal = select.value;
        select.innerHTML = '<option value="" disabled selected>-- Seleziona carta vista --</option>';
        [s, w, r].forEach(c => {
            if(c) {
                let opt = document.createElement('option');
                opt.value = c; opt.text = c;
                if(c === currentVal) opt.selected = true;
                select.appendChild(opt);
            }
        });
    } else {
        box.classList.add('hidden');
        select.value = "";
    }
}

function submitTurn() {
    const s = document.getElementById('turn-suspect').value;
    const w = document.getElementById('turn-weapon').value;
    const r = document.getElementById('turn-room').value;
    const asker = document.getElementById('turn-asker').value;
    const responder = document.getElementById('turn-responder').value;

    if(!asker || !s || !w || !r) return alert("Compila tutti i campi!");
    if(asker === responder) return alert("Domanda e risposta dalla stessa persona!");

    if (asker === myName && responder !== 'none' && responder !== '' && responder !== myName) {
        if (!document.getElementById('turn-card-shown').value) {
            return alert("Non hai specificato quale carta ti ha mostrato " + responder + "!");
        }
    }

    // Salva History per Undo (deep copy)
    history.push({
        grid: JSON.parse(JSON.stringify(grid)),
        constraints: JSON.parse(JSON.stringify(constraints)),
        turnIndex: currentTurnIndex,
        limits: JSON.parse(JSON.stringify(limits))
    });

    const involved = [s, w, r];
    log(`🔎 <b>${asker}</b> chiede: ${s}, ${w}, ${r}`);

    // 1. Logica dei "PASS": chi sta tra asker e responder non ha le carte
    let currentIdx = (players.indexOf(asker) + 1) % players.length;
    let loops = 0;
    while(loops < players.length) {
        const p = players[currentIdx];
        if(p === responder) break;
        if(responder === 'none' && p === asker) break;
        
        // setFact è in solver.js
        involved.forEach(c => setFact(c, p, 1)); 
        
        currentIdx = (currentIdx + 1) % players.length;
        loops++;
    }

    // 2. Logica Risposta
    if (responder !== 'none') {
        log(`💡 <b>${responder}</b> ha mostrato una carta.`);
        if (asker === myName) {
            const seen = document.getElementById('turn-card-shown').value;
            if (seen && involved.includes(seen)) {
                log(`👁️ Hai visto: <span class="log-highlight">${seen}</span>`);
                setFact(seen, responder, 2);
            } else {
                // Caso raro (errore input utente), ma fallback sicuro
                addConstraint(responder, involved); 
            }
        } else if (responder !== myName) {
            // addConstraint è in solver.js
            addConstraint(responder, involved);
        }
    } else {
        log(`❌ Nessuno ha risposto!`);
    }

    // Reset UI per prossimo turno
    document.getElementById('turn-responder').value = "none";
    document.getElementById('turn-suspect').value = "";
    document.getElementById('turn-weapon').value = "";
    document.getElementById('turn-room').value = "";
    
    currentTurnIndex = (players.indexOf(asker) + 1) % players.length;
    
    updateTurnUI();
    
    // Core Engine Execution
    runSolver(); // solver.js
    updateTacticalSuggestions(); // tactics.js
}

// --- LOGGING & RENDERING ---

function log(m) {
    // Non loggare durante le simulazioni del DeepScan
    if (typeof isSimulating !== 'undefined' && isSimulating) return;

    const textOnly = m.replace(/<[^>]*>/g, '');
    const time = new Date().toLocaleTimeString();
    fullGameLogs.push(`[${time}] ${textOnly}`);

    const el = document.getElementById('log-area'); 
    el.innerHTML = `<div class="log-entry">${m}</div>` + el.innerHTML; 
}

function renderGrid() {
    const table = document.getElementById('main-grid');
    let html = `<thead><tr><th>Carte</th>`;
    players.forEach(p => html += `<th title="${p}">${p}</th>`);
    html += `</tr></thead><tbody>`;

    const buildRows = (title, list) => {
        html += `<tr><td colspan="${players.length+1}" class="grid-section-title"><b>${title.toUpperCase()}</b></td></tr>`;
        list.forEach(c => {
            const isSol = grid[c].SOL === 2;
            const rowClass = isSol ? 'c-sol' : '';
            html += `<tr><td class="${rowClass}">${c}</td>`;
            players.forEach(p => {
                const val = grid[c][p];
                let display = '&nbsp;';
                let cls = 'c-unk';
                
                if (val === 2) { display = '✔'; cls = 'c-yes'; }
                else if (val === 1) { display = '✘'; cls = 'c-no'; }
                
                html += `<td class="${cls}">${display}</td>`;
            });
            html += `</tr>`;
        });
    };

    buildRows("Sospettati", suspects);
    buildRows("Armi", weapons);
    buildRows("Stanze", rooms);
    table.innerHTML = html + "</tbody>";
}

// --- UTILS ---

function switchView(f, t) { 
    document.getElementById(f).classList.add('hidden'); 
    document.getElementById(t).classList.remove('hidden'); 
}

function populateSelect(id, list, addNone=false, label=null) {
    const s = document.getElementById(id); 
    s.innerHTML = '';
    if(label) { 
        const o = document.createElement('option'); 
        o.value=""; o.text=label; o.disabled = true; o.selected = true; 
        s.appendChild(o); 
    }
    if(addNone) { 
        const o = document.createElement('option'); 
        o.value="none"; o.text="❌ NESSUNO (Tutti passano)"; 
        s.appendChild(o); 
    }
    list.forEach(i => { 
        const o = document.createElement('option'); 
        o.value=i; o.text=i; 
        s.appendChild(o); 
    });
}

function exportGameLogs() {
    if (fullGameLogs.length === 0) return alert("Nessun dato da esportare.");

    let content = "CLUEDO SOLVER PRO - REGISTRO PARTITA\n";
    content += "====================================\n\n";
    content += fullGameLogs.join("\n");
    content += "\n\n====================================\n";
    content += "STATO GRIGLIA FINALE\n";
    content += JSON.stringify(grid, null, 2);

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cluedo_logs_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Prevenzione chiusura accidentale
window.addEventListener('beforeunload', function (e) {
    if (history.length > 0) {
        e.preventDefault(); 
        e.returnValue = ''; 
        return '';
    }
});