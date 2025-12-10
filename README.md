# 🕵️ Cluedo Solver Pro

> **Il taccuino digitale definitivo per distruggere i tuoi amici a Cluedo e le amicizie nella vita vera.**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

## ⚠️ Disclaimer Responsabilità

> Questo software è stato sviluppato con il preciso scopo di annientare i tuoi avversari.
>
> L'utilizzo di algoritmi di deduzione per ottenere una superiorità tattica schiacciante è spesso riconosciuto come un vantaggio sleale e un atteggiamento contrario allo spirito dei giochi da tavolo.
>
> Lo sviluppatore declina ogni responsabilità qualora la frustrazione generata dalla tua ineluttabile vittoria dovesse trasformare la simulazione in una scena del crimine *reale*.

## 🧐 Che cos'è?

**Cluedo Solver Pro** è una Single Page Application (SPA) leggerissima che sostituisce il classico foglietto di carta con un motore logico avanzato.

Mentre i tuoi amici faticano a ricordare chi ha mostrato cosa tre turni fa, questo tool:
1.  Registra ogni mossa.
2.  Applica la logica ad eliminazione.
3.  Gestisce i vincoli (es: "Tizio ha mostrato una carta tra X, Y e Z").
4.  Risolve il caso matematicamente prima che chiunque altro se ne accorga.

## ✨ Funzionalità

* **🕵️ Gestione Giocatori:** Supporta da 3 a 6 giocatori con calcolo automatico della distribuzione delle carte.
* **🧠 Motore Deduttivo:** Algoritmo iterativo che incrocia le informazioni pubbliche e private per dedurre le carte in mano agli avversari.
* **🚫 Gestione Vincoli:** Se un giocatore mostra una carta a qualcun altro, il sistema ricorda il gruppo di possibilità e lo risolve automaticamente appena ottiene nuove informazioni.
* **✏️ Editor Turni:** Hai sbagliato a cliccare? Puoi annullare l'ultima mossa (Undo) o modificare manualmente la griglia.
* **📱 Mobile First:** Interfaccia "Dark Mode" ottimizzata per smartphone, così puoi tenerlo nascosto sotto il tavolo.
* **🤫 Rilevatore di Bluff:** Ti avvisa se stai per fare una domanda su carte che possiedi già (utile per confondere le acque).

## 🚀 Come usarlo

[Clicca qui](https://orangebaron.github.io/cluedo/)

## 📖 Guida Rapida

1.  **Setup:** Inserisci i nomi dei giocatori in **senso orario**, partendo da quello alla sinistra del mazziere.
2.  **La tua mano:** Seleziona le carte che possiedi. Il sistema verificherà se il numero di carte corrisponde alla matematica del mazzo.
3.  **Gioco:**
    * Inserisci chi fa la domanda.
    * Seleziona Sospettato, Arma e Stanza richiesti.
    * Inserisci chi risponde (chi mostra la carta).
    * Se rispondi tu, o se chiedi tu e qualcuno ti risponde, specifica *quale* carta è stata mostrata.
4.  **Vittoria:** Guarda la griglia riempirsi di ✔️ verdi e X rosse finché la soluzione non appare evidenziata in oro 🏆.

## 🛠️ Tecnologie & Logica

Il codice è scritto in **Vanilla JS** (nessun framework pesante). La logica di risoluzione si basa su:
* **Esclusione Diretta:** Se P1 ha la carta X, nessun altro ce l'ha.
* **Insiemi di Vincoli:** Quando P1 mostra una carta a P2 per la domanda {A, B, C}, il sistema sa che P1 possiede almeno una tra A, B o C. Se in seguito scopriamo che P1 non ha né A né B, il sistema deduce che ha C.
* **Principio dei Cassetti (Pigeonhole):** Se sappiamo che P1 ha 3 carte in totale e ne abbiamo già identificate 3, tutte le altre carte del mazzo sono segnate come "NON possedute" da P1.

## 🤝 Contribuire

Sentiti libero di aprire una **Pull Request** se trovi un bug o se vuoi aggiungere una feature (tipo un tasto per ridere in modo malvagio quando trovi la soluzione).

## 📄 Licenza

Distribuito sotto licenza MIT. Fanne quello che vuoi, ma a tuo rischio e pericolo (vedi Disclaimer).
