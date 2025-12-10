// --- CONFIGURATION ---
const suspects = ["Scarlett", "Mustard", "White", "Green", "Peacock", "Plum"];
const weapons = ["Candeliere", "Pugnale", "Tubo", "Rivoltella", "Corda", "Chiave"];
const rooms = ["Ingresso", "Veranda", "Pranzo", "Cucina", "Ballo", "Serra", "Biliardo", "Biblioteca", "Studio"];
const allCards = [...suspects, ...weapons, ...rooms];
const CARDS_IN_DECK = suspects.length + weapons.length + rooms.length - 3; 

// --- STATE VARIABLES ---
let players = [];
let myName = "";
let myExpectedCount = 0;
let limits = {};
let grid = {};
let constraints = [];
let currentTurnIndex = 0;
let history = [];
let fullGameLogs = [];
let isSimulating = false;

// --- SETUP FUNCTIONS ---
function handleEnter(e) { if(e.key === 'Enter') addPlayer(); }

function addPlayer() {
    if (players.length >= 6) return;
    const input = document.getElementById('new-player');
    const name = input.value.trim();
    
    if (name && !players.includes(name)) {
        players.push(name);
        document.getElementById('player-list').innerHTML += `<span class="player-tag">${players.length}. ${name}</span>`;
        
        const meSelect = document.getElementById('who-am-i');
        const startSelect = document.getElementById('starting-player');
        
        const opt1 = document.createElement('option'); opt1.value = name; opt1.text = name; meSelect.appendChild(opt1);
        const opt2 = document.createElement('option'); opt2.value = name; opt2.text = name; startSelect.appendChild(opt2);
        
        input.value = ''; input.focus();

        if (players.length >= 6) {
            input.disabled = true; input.placeholder = "Max players reached";
        }
    } else if (players.includes(name)) {
        alert("Giocatore già presente!");
    }
}

function goToHandSelection() {
    if (players.length < 2) return alert("Minimo 2 giocatori!");
    myName = document.getElementById('who-am-i').value;
    if(!myName) return alert("Chi sei tu?");

    // --- CALCOLO MATEMATICO DELLE CARTE ---
    const myIndex = players.indexOf(myName);
    const baseCount = Math.floor(CARDS_IN_DECK / players.length);
    const remainder = CARDS_IN_DECK % players.length;
    
    myExpectedCount = baseCount + (myIndex < remainder ? 1 : 0);

    // Resetta UI Contatore
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
    // Conta quante checkbox sono selezionate
    const current = document.querySelectorAll('.init-card-check:checked').length;
    const badge = document.getElementById('hand-counter-badge');
    
    badge.innerText = `Selezionate: ${current} / ${myExpectedCount}`;
    
    if (current === myExpectedCount) {
        // Corretto: Verde
        badge.style.color = 'var(--success)';
        badge.style.borderColor = 'var(--success)';
        badge.style.background = 'rgba(16, 185, 129, 0.1)';
    } else {
        // Errato: Rosso
        badge.style.color = 'var(--danger)';
        badge.style.borderColor = 'var(--danger)';
        badge.style.background = 'rgba(239, 68, 68, 0.1)';
    }
}

function finalizeSetup() {
    const checks = document.querySelectorAll('.init-card-check:checked');
    
    // --- BLOCCO DI SICUREZZA ---
    if (checks.length !== myExpectedCount) {
        alert(`Attenzione!\n\nIn base al numero di giocatori (${players.length}), dovresti avere esattamente ${myExpectedCount} carte.\n\nNe hai selezionate ${checks.length}. Correggi prima di continuare.`);
        return;
    }

    allCards.forEach(c => { grid[c] = { SOL: 0 }; players.forEach(p => grid[c][p] = 0); });

    checks.forEach(chk => setFact(chk.value, myName, 2));

    // Ricalcola limiti per tutti gli altri (logica invariata)
    const baseCount = Math.floor(CARDS_IN_DECK / players.length);
    const remainder = CARDS_IN_DECK % players.length;
    players.forEach((p, index) => { limits[p] = baseCount + (index < remainder ? 1 : 0); });

    populateSelect('turn-asker', players);
    populateSelect('turn-responder', players, true);
    populateSelect('turn-suspect', suspects, false, "👤 Sospettato");
    populateSelect('turn-weapon', weapons, false, "🔫 Arma");
    populateSelect('turn-room', rooms, false, "🏰 Stanza");

    const starterName = document.getElementById('starting-player').value;
    currentTurnIndex = players.indexOf(starterName) >= 0 ? players.indexOf(starterName) : 0;

    updateTurnUI();
    switchView('view-hand', 'view-game');
    runSolver();
}

// --- TURN UI ---
function updateTurnUI() {
    const currentPlayer = players[currentTurnIndex];
    document.getElementById('turn-display-name').innerText = "Turno di: " + currentPlayer;
    document.getElementById('turn-asker').value = currentPlayer;
    checkSpecialInput();
    checkBluffUI();
}

function toggleManualTurn() {
    const manualDiv = document.getElementById('manual-asker-div');
    const badge = document.getElementById('turn-display-name');
    if (manualDiv.classList.contains('hidden')) {
        manualDiv.classList.remove('hidden');
        badge.style.opacity = '0.5';
    } else {
        manualDiv.classList.add('hidden');
        badge.style.opacity = '1';
        document.getElementById('turn-asker').value = players[currentTurnIndex];
    }
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

    // Filtra le carte selezionate verificando se grid[carta][asker] è uguale a 2 (Posseduta)
    let bluffs = [s, w, r].filter(c => c && grid[c] && grid[c][asker] === 2);
    
    if (bluffs.length > 0) {
        if (asker === myName) {
            indicator.style.color = "var(--success)";
            indicator.innerHTML = `🤫 Stai bluffando su: <b>${bluffs.join(', ')}</b>`;
        } else {
            indicator.style.color = "var(--accent)";
            indicator.innerHTML = `⚠️ <b>${asker}</b> sta bluffando! Sappiamo che ha: <b>${bluffs.join(', ')}</b>`;
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

// --- LOGIC ---
function submitTurn() {
    const s = document.getElementById('turn-suspect').value;
    const w = document.getElementById('turn-weapon').value;
    const r = document.getElementById('turn-room').value;
    const asker = document.getElementById('turn-asker').value;
    const responder = document.getElementById('turn-responder').value;

    // Controllo base campi obbligatori
    if(!asker || !s || !w || !r) return alert("Compila tutti i campi!");

    // Controllo coerenza
    if(asker === responder) return alert("Domanda e risposta dalla stessa persona!");

    // Se sono IO a chiedere e QUALCUNO risponde (che non sono io), DEVO aver selezionato la carta vista
    if (asker === myName && responder !== 'none' && responder !== '' && responder !== myName) {
        const seenCard = document.getElementById('turn-card-shown').value;
        if (!seenCard) {
            return alert("Non hai specificato quale carta ti ha mostrato " + responder + "!");
        }
    }

    // History Save
    history.push({
        grid: JSON.parse(JSON.stringify(grid)),
        constraints: JSON.parse(JSON.stringify(constraints)),
        turnIndex: currentTurnIndex,
        limits: JSON.parse(JSON.stringify(limits))
    });
    // if(history.length > 50) history.shift();

    const involved = [s, w, r];
    log(`🔎 <b>${asker}</b> chiede: ${s}, ${w}, ${r}`);

    // Pass logic
    let currentIdx = (players.indexOf(asker) + 1) % players.length;
    let loops = 0;
    while(loops < players.length) {
        const p = players[currentIdx];
        if(p === responder) break;
        if(responder === 'none' && p === asker) break;
        
        involved.forEach(c => setFact(c, p, 1)); // Mark as NO
        currentIdx = (currentIdx + 1) % players.length;
        loops++;
    }

    // Responder logic
    if (responder !== 'none') {
        log(`💡 <b>${responder}</b> ha mostrato una carta.`);
        if (asker === myName) {
            const seen = document.getElementById('turn-card-shown').value;
            if (seen && involved.includes(seen)) {
                log(`👁️ Hai visto: <span class="log-highlight">${seen}</span>`);
                setFact(seen, responder, 2);
            } else {
                addConstraint(responder, involved);
            }
        } else if (responder !== myName) {
            addConstraint(responder, involved);
        }
    } else {
        log(`❌ Nessuno ha risposto!`);
    }

    // Reset UI
    document.getElementById('turn-responder').value = "none";
    document.getElementById('turn-suspect').value = "";
    document.getElementById('turn-weapon').value = "";
    document.getElementById('turn-room').value = "";
    
    currentTurnIndex = (currentTurnIndex + 1) % players.length;
    updateTurnUI();
    runSolver();
}

function undoLastTurn() {
    if (history.length === 0) return alert("Nulla da annullare");
    const last = history.pop();
    grid = last.grid;
    constraints = last.constraints;
    currentTurnIndex = last.turnIndex;
    log(`⏪ <b>UNDO</b>: L'ultimo turno è stato annullato.`);
    updateTurnUI();
    renderGrid();
}

function addConstraint(player, cards) {
    // Filtriamo le carte che sappiamo già essere possedute da ALTRI (quindi player non può averle)
    // O che sappiamo che PLAYER non ha (grid === 1)
    const possible = cards.filter(c => {
        let ownedByOther = false;
        players.forEach(p => { 
            if(p !== player && grid[c][p] === 2) ownedByOther = true; 
        });
        const knownNotOwned = grid[c][player] === 1;
        return !ownedByOther && !knownNotOwned;
    });

    if(possible.length === 0) {
        log(`⚠️ <span style="color:var(--danger)">CONTRADDIZIONE: ${player} non può aver mostrato nulla perché le 3 carte sono già assegnate ad altri!</span>`);
        return;
    }

    // Se rimane solo 1 possibilità, è una deduzione immediata!
    if (possible.length === 1) {
        setFact(possible[0], player, 2);
        log(`⚡️ Deduzione Immediata: <b>${player}</b> ha <b>${possible[0]}</b>`);
        return;
    }
    
    // Controllo duplicati usando [...cards] per non mutare l'array originale
    const sortedPossible = [...possible].sort();
    const exists = constraints.some(con => 
        con.player === player && 
        JSON.stringify([...con.cards].sort()) === JSON.stringify(sortedPossible)
    );

    if (!exists) {
        constraints.push({ player: player, cards: possible });
        // Rilancia il solver perché un nuovo vincolo potrebbe sbloccare altre deduzioni
        runSolver(); 
    }
}

function setFact(card, player, status) {
    const currentStatus = grid[card][player];

    // Controllo coerenza
    if (currentStatus !== 0 && currentStatus !== status) {
        // SE STIAMO SIMULANDO significa che l'ipotesi era falsa!
        if (isSimulating) throw "SIM_CONTRADICTION"; 
        
        log(`⚠️ <span style="color:var(--danger)">CONTRADDIZIONE: il sistema pensava che ${player} ${currentStatus === 1 ? 'non avesse' : 'avesse'} ${card} ma ora dici che ${status === 1 ? 'non ce l\'ha' : 'ce l\'ha'}!</span>`);
        return;
    }

    if (currentStatus === status) return;

    grid[card][player] = status;

    // Se è SI (2), tutti gli altri sono NO (1)
    if (status === 2) {
        players.forEach(p => { if (p !== player) setFact(card, p, 1); });
        grid[card].SOL = 1;
    }
}

function runSolver(fromSimulation = false) {
    let changed = true;
    let loops = 0;
    
    // Protezione per non andare in loop infinito durante la simulazione
    const maxLoops = fromSimulation ? 20 : 50; 

    try {
        while(changed && loops < maxLoops) {
            changed = false;
            const snap = JSON.stringify(grid);

            // 1. Clean satisfied constraints
            const nCons = constraints.length;
            constraints = constraints.filter(con => !con.cards.some(c => grid[c][con.player] === 2));
            if (constraints.length !== nCons) changed = true;

            // 2. Math & Pigeonhole
            players.forEach(p => {
                let found = 0, unknown = [];
                allCards.forEach(c => {
                    if(grid[c][p] === 2) found++;
                    if(grid[c][p] === 0) unknown.push(c);
                });

                // Controllo Limiti (Cruciale per la simulazione)
                if (found > limits[p]) {
                    if (isSimulating) throw "SIM_LIMIT_EXCEEDED"; // Stop immediato
                    log(`⚠️ Errore matematico: ${p} ha troppe carte!`);
                }

                if (found === limits[p] && unknown.length > 0) {
                    unknown.forEach(c => setFact(c, p, 1)); changed = true;
                }
                if (found < limits[p] && (found + unknown.length === limits[p]) && unknown.length > 0) {
                    unknown.forEach(c => setFact(c, p, 2)); changed = true;
                }
                
                // Advanced Pigeonhole (1 slot left)
                if (limits[p] - found === 1) {
                    const pCons = constraints.filter(c => c.player === p);
                    if(pCons.length > 0) {
                        const valid = new Set();
                        pCons.forEach(con => con.cards.forEach(c => valid.add(c)));
                        unknown.forEach(u => {
                            if(!valid.has(u)) { setFact(u, p, 1); changed = true; }
                        });
                    }
                }
            });

            // 3. Direct Constraints
            constraints.forEach(con => {
                const possible = con.cards.filter(c => grid[c][con.player] !== 1);
                if (possible.length === 0) {
                    if (isSimulating) throw "SIM_IMPOSSIBLE_CONSTRAINT";
                }
                if (possible.length === 1 && grid[possible[0]][con.player] !== 2) {
                    setFact(possible[0], con.player, 2);
                    if(!isSimulating) log(`⚡️ Deduzione: <b>${con.player}</b> ha <b>${possible[0]}</b>`);
                    changed = true;
                }
            });

            // 4. Intersezione Vincoli (Deep Logic)
            players.forEach(p => {
                let knownHeld = 0;
                allCards.forEach(c => { if(grid[c][p] === 2) knownHeld++; });
                const slotsLeft = limits[p] - knownHeld;

                if (slotsLeft === 1) {
                    const pCons = constraints.filter(c => c.player === p);
                    if (pCons.length >= 2) {
                        let intersection = pCons[0].cards.filter(c => grid[c][p] !== 1);
                        for (let i = 1; i < pCons.length; i++) {
                            const currentCards = pCons[i].cards;
                            intersection = intersection.filter(c => currentCards.includes(c));
                        }
                        if (intersection.length === 1) {
                            const target = intersection[0];
                            if (grid[target][p] !== 2) {
                                setFact(target, p, 2);
                                if(!isSimulating) log(`⚡️ Deduzione (Intersezione): <b>${p}</b> deve avere <b>${target}</b>`);
                                changed = true;
                            }
                        }
                    }
                }
            });

            // 5. Global Solution
            allCards.forEach(c => {
                let allNo = true;
                players.forEach(p => { if (grid[c][p] !== 1) allNo = false; });
                if (allNo && grid[c].SOL !== 2) {
                    grid[c].SOL = 2;
                    if(!isSimulating) log(`🏆 <b>SOLUZIONE TROVATA: ${c}</b>`);
                    changed = true;
                }
            });
            
             // Category Elimination
            [suspects, weapons, rooms].forEach(list => {
                let owned = 0, unk = [];
                list.forEach(c => { if(grid[c].SOL === 1) owned++; else if(grid[c].SOL === 0) unk.push(c); });
                if (owned === list.length - 1 && unk.length === 1 && grid[unk[0]].SOL !== 2) {
                    grid[unk[0]].SOL = 2;
                    if(!isSimulating) log(`🏆 <b>SOLUZIONE (Eliminazione): ${unk[0]}</b>`);
                    changed = true;
                }
            });

            if (JSON.stringify(grid) !== snap) changed = true;
            loops++;
        }
    } catch (e) {
        // Se siamo in simulazione, rilanciamo l'errore al gestore DeepScan
        if (isSimulating) throw e; 
        console.error(e);
    }

    // Se NON siamo in simulazione e il solver standard si è fermato, proviamo il Deep Scan
    if (!fromSimulation && !isSimulating) {
        runDeepScan();
        renderGrid();
    }
}

function runDeepScan() {
    isSimulating = true;

    // Troviamo tutte le celle incerte (0) interessanti
    // Ottimizzazione: ordiniamo per quelle che hanno più probabilità di causare crash (es. giocatori con pochi slot liberi)
    const candidates = [];
    allCards.forEach(c => {
        players.forEach(p => {
            if (grid[c][p] === 0) candidates.push({card: c, player: p});
        });
    });

    // Salviamo lo stato una volta sola per evitare overhead se non serve
    // Ma qui dobbiamo salvare/ripristinare per OGNI tentativo
    
    for (const cand of candidates) {
        // Snapshot dello stato attuale
        const savedGrid = JSON.stringify(grid);
        const savedConstraints = JSON.stringify(constraints);

        try {
            // IPOTESI: "Facciamo finta che P abbia la carta C"
            // Usiamo grid diretta per evitare controlli di setFact qui
            grid[cand.card][cand.player] = 2; 

            // Lanciamo il solver in modalità simulazione
            // Se c'è una contraddizione, lancerà un'eccezione
            runSolver(true); 

            // Se arriviamo qui, l'ipotesi è plausibile (non ha creato errori).
            // Non possiamo dedurre nulla. Ripristiniamo e passiamo alla prossima.
            grid = JSON.parse(savedGrid);
            constraints = JSON.parse(savedConstraints);

        } catch (e) {
            // ECCEZIONE CATTURATA! 
            // Significa che l'ipotesi "P ha C" ha rotto la logica.
            // QUINDI: P NON può avere C.
            
            // 1. Ripristiniamo lo stato pulito
            grid = JSON.parse(savedGrid);
            constraints = JSON.parse(savedConstraints);
            
            // 2. Spegniamo la simulazione per poter scrivere il log e salvare il fatto reale
            isSimulating = false; 
            
            log(`🧠 <b>Deep Scan</b>: Se <b>${cand.player}</b> avesse <b>${cand.card}</b>, i conti non tornerebbero. Quindi NON ce l'ha.`);
            setFact(cand.card, cand.player, 1); // Segniamo come NO certo

            // 3. Spegniamo la modalità simulazione per il resto del loop (o usciamo)
            // Se abbiamo trovato qualcosa, meglio fermarsi e rilanciare il solver principale
            // perché questo NO potrebbe sbloccare altre cose ovvie.
            isSimulating = false;
            runSolver();
            return; 
        }
    }

    isSimulating = false;
}

function renderGrid() {
    const table = document.getElementById('main-grid');
    let html = `<thead><tr><th>Carte</th>`;
    players.forEach(p => html += `<th title="${p}">${p}</th>`);
    html += `</tr></thead><tbody>`;

    const buildRows = (title, list) => {
        html += `<tr><td colspan="${players.length+1}" style="background:#374151; color:#fbbf24; font-size:0.85rem; text-align:center; padding:8px; letter-spacing:1px; border-bottom:2px solid #4b5563;"><b>${title.toUpperCase()}</b></td></tr>`;
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

// Utils
function switchView(f, t) { document.getElementById(f).classList.add('hidden'); document.getElementById(t).classList.remove('hidden'); }
function log(m) {
    if (isSimulating) return;

    const textOnly = m.replace(/<[^>]*>/g, '');
    const time = new Date().toLocaleTimeString();
    fullGameLogs.push(`[${time}] ${textOnly}`);

    const el = document.getElementById('log-area'); 
    el.innerHTML = `<div class="log-entry">${m}</div>` + el.innerHTML; 
}
function populateSelect(id, list, addNone=false, label=null) {
    const s = document.getElementById(id); s.innerHTML = '';
    if(label) { const o = document.createElement('option'); o.value=""; o.text=label; o.disabled = true; o.selected = true; s.appendChild(o); }
    if(addNone) { const o = document.createElement('option'); o.value="none"; o.text="❌ NESSUNO (Tutti passano)"; s.appendChild(o); }
    list.forEach(i => { const o = document.createElement('option'); o.value=i; o.text=i; s.appendChild(o); });
}
function exportGameLogs() {
    if (fullGameLogs.length === 0) return alert("Nessun dato da esportare.");

    let content = "CLUEDO SOLVER PRO - REGISTRO PARTITA\n";
    content += "====================================\n\n";
    
    content += fullGameLogs.join("\n");
    
    content += "\n\n====================================\n";
    content += "STATO MATEMATICO FINALE (GRIGLIA)\n";
    content += "2 = C'è (Sì) | 1 = Non c'è (No) | 0 = Boh\n";
    content += "====================================\n";
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
window.addEventListener('beforeunload', function (e) {
    if (history.length > 0) {
        e.preventDefault(); 
        e.returnValue = ''; 
        return '';
    }
});