```javascript
let db;

const request = indexedDB.open("SerTechCucDB", 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    db.createObjectStore("vetrine", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = function(event) {
    db = event.target.result;
    console.log("IndexedDB pronta");
};

request.onerror = function() {
    console.log("Errore database");
};

// Aggiungi
function salvaVetrina(vetrina) {
    return new Promise((resolve) => {
        let tx = db.transaction("vetrine", "readwrite");
        tx.objectStore("vetrine").add(vetrina);
        tx.oncomplete = () => resolve();
    });
}

// Aggiorna
function aggiornaVetrina(id, vetrina) {
    return new Promise((resolve) => {
        let tx = db.transaction("vetrine", "readwrite");
        let store = tx.objectStore("vetrine");
        vetrina.id = id; // Associa l'id passato
        store.put(vetrina);
        tx.oncomplete = () => resolve();
    });
}

// Rimuovi
function rimuoviVetrina(id) {
    return new Promise((resolve) => {
        let tx = db.transaction("vetrine", "readwrite");
        tx.objectStore("vetrine").delete(id);
        tx.oncomplete = () => resolve();
    });
}

// Lista
function listaVetrine() {
    return new Promise((resolve) => {
        let tx = db.transaction("vetrine", "readonly");
        let store = tx.objectStore("vetrine");
        let req = store.getAll();
        req.onsuccess = () => resolve(req.result);
    });
}
```

 
