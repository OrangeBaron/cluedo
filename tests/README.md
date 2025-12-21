🧪 Cluedo Solver Pro - Test Suite & Simulazioni
===============================================

Questa cartella contiene una serie di script avanzati progettati per verificare la robustezza del Cluedo Solver Pro.

Gli script non servono solo per il debugging ("funziona o no?"), ma includono simulatori di partite complete e analisi statistiche (Monte Carlo) per misurare l'efficacia dell'intelligenza artificiale del solver.

🚀 Come Eseguire i Test
-----------------------

Poiché il progetto è scritto in **Vanilla JS** (senza Node.js o processi di build complessi), i test vanno eseguiti direttamente nel contesto dell'applicazione attiva nel browser.

### 1\. Apri l'Applicazione

Apri [Cluedo Solver Pro](https://orangebaron.github.io/cluedo/) nel tuo browser preferito (Chrome, Firefox, Edge, Safari).

### 2\. Apri la Console degli Sviluppatori

La "Console" è lo strumento che permette di inviare comandi direttamente al motore JavaScript della pagina.

* **Windows/Linux:** Premi ```F12``` oppure ````Ctrl```` + ```⇧``` + ```J```.
    
* **Mac:** Premi ```command``` + ```option``` + ```J```.
    
* **Metodo alternativo (Mouse):** Clicca con il tasto destro in un punto qualsiasi della pagina, seleziona **"Ispeziona"** (Inspect) e clicca sulla tab **"Console"**.
    

### 3\. Incolla ed Esegui

1.  Apri uno dei file ```.js``` presenti in questa cartella.
    
2.  Copia tutto il contenuto del file.
    
3.  Incolla il codice nella Console del browser.
    
4.  Premi **Invio**.
    

> **⚠️ ATTENZIONE:** L'esecuzione di questi script **resetterà la partita in corso** e modificherà i dati nella memoria della pagina per creare scenari di test. Non eseguirli mentre stai giocando una partita reale importante!

📂 Descrizione degli Script
---------------------------

Ecco a cosa serve ogni file e cosa aspettarsi dall'output:

### 1\. ```logic.js``` (Unit Tests)

Questo è il test fondamentale per il **motore deduttivo** (```solver.js```). Verifica che la logica matematica funzioni correttamente senza errori.

* **Cosa fa:** Resetta il gioco e simula scenari specifici (es. "Se Tizio ha mostrato Carta X, allora Caio non può avere Carta Y").
    
* **Test inclusi:**
    * Logica del "Passo" (informazione negativa).
    * Risoluzione dei vincoli (esclusione diretta).
    * Saturazione della mano (Principio dei Cassetti).
    * Rilevamento del Bluff.
    * **Deep Scan:** Verifica che il solver riesca a fare deduzioni "per assurdo" (Reductio ad Absurdum).
        
* **Output:** Vedrai una serie di messaggi verdi (```✅ SUCCESSO```) o rossi (```❌ FALLIMENTO```) nella console.

### 2\. ```pathfinding.js``` (Graph & Movement Tests)

Testa il motore fisico degli spostamenti e l'algoritmo di ottimizzazione dei percorsi (Floyd-Warshall).

* **Cosa fa:** Verifica che il sistema calcoli correttamente le distanze tra le stanze, tenendo conto dei passaggi segreti e delle scorciatoie composte.
* **Verifiche principali:**
    * **Passaggi Segreti:** Conferma che il costo per usare un passaggio segreto sia 1 turno.
    * **Scorciatoie:** Verifica se passare per una stanza intermedia (es. A -> B -> C) è più veloce che tirare i dadi per la tratta diretta (A -> C).
    * **Integrazione UI:** Controlla che i suggerimenti visivi (es. etichetta "Scorciatoia") appaiano correttamente nel Navigatore Tattico.

### 3\. ```strategy.js``` (Tactical Tests)

Testa il **Navigatore Tattico** (```tactics.js```), ovvero l'assistente che ti suggerisce dove andare e cosa chiedere.

* **Cosa fa:** Crea situazioni di gioco simulate (es. "Sei in Cucina, ti manca solo l'arma") e controlla se il suggerimento dato dal sistema è quello ottimale.
    
* **Verifiche principali:**
    * **Scoring Entropico:** Assegna un punteggio più alto alle stanze che offrono maggiori probabilità di trovare indizi (densità statistica)?
    * **Decision Making:** Il bot preferisce una mossa sicura o un azzardo calcolato in base alla situazione?
    * **Endgame:** Se il caso è risolto, il sistema urla "VITTORIA" e ti manda alla stanza corretta?
        

### 4\. ```match.js``` (Match Simulator)

Uno script spettacolare che simula una **partita intera visibile in console**. È come guardare un film della partita ("Bot vs Bot").

* **Cosa fa:** Crea 3-5 giocatori virtuali (Bot) e un "Eroe" (che usa il Solver). Simula dadi, movimenti, ipotesi, risposte e uso del taccuino.
    
* **Utilità:** Serve a vedere se il flusso di gioco "regge" e se l'interfaccia reagisce correttamente agli eventi.
    
* **Output:** Una "cronaca" colorata passo-passo della partita (es. ```💬 Alice ipotizza: Mustard, Corda, Studio```, ```✋ Bob mostra una carta```).
    

### 5\. ```montecarlo.js``` (Statistical Analysis)

Il test più pesante. Esegue una **Simulazione Monte Carlo** (di default 1000 partite) alla massima velocità possibile, senza aggiornare la grafica.

* **Cosa fa:** Fa scontrare il Cluedo Solver Pro contro dei Bot "intelligenti" per migliaia di volte.
    
* **Obiettivo:** Misurare scientificamente la potenza dell'algoritmo.
    
* **Output:**
    
    * **Win Rate:** Percentuale di vittorie del Solver.
        
    * **Turni Medi:** Quanti turni impiega il Solver per risolvere il caso rispetto agli avversari.
        
    * _Nota:_ Durante l'esecuzione la console potrebbe sembrare "freezata" per qualche secondo mentre calcola.
