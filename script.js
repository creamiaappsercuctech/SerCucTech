```javascript
document.addEventListener("DOMContentLoaded", () => {
    const formVetrina = document.getElementById("formVetrina");
    const listaVetrineDiv = document.getElementById("listaVetrine");

    // Carica le vetrine all'avvio
    caricaVetrine();

    formVetrina.addEventListener("submit", (event) => {
        event.preventDefault();
        const id = document.getElementById("id").value;
        const nome = document.getElementById("nome").value;
        const descrizione = document.getElementById("descrizione").value;
        const immagine = document.getElementById("immagine").value;

        const vetrina = { nome, descrizione, immagine };

        if (id) {
            aggiornaVetrina(id, vetrina).then(() => {
                resettaForm();
                caricaVetrine();
            });
        } else {
            salvaVetrina(vetrina).then(() => {
                resettaForm();
                caricaVetrine();
            });
        }
    });

    function caricaVetrine() {
        listaVetrine().then(vetrine => {
            listaVetrineDiv.innerHTML = "";
            vetrine.forEach(vetrina => {
                const div = document.createElement("div");
                div.classList.add("card");
                div.innerHTML = `
                    <h3>${vetrina.nome}</h3>
                    <p>${vetrina.descrizione}</p>
                    <img src="${vetrina.immagine}" alt="${vetrina.nome}" style="width: 100%;">
                    <button onclick="modificaVetrina(${vetrina.id})">Modifica</button>
                    <button onclick="rimuoviVetrina(${vetrina.id})">Rimuovi</button>
                `;
                listaVetrineDiv.appendChild(div);
            });
        });
    }

    window.modificaVetrina = function(id) {
        const vetrina = listaVetrine().then(vetrine => {
            return vetrine.find(v => v.id === id);
        });

        vetrina.then(v => {
            document.getElementById("id").value = v.id;
            document.getElementById("nome").value = v.nome;
            document.getElementById("descrizione").value = v.descrizione;
            document.getElementById("immagine").value = v.immagine;
        });
    }

    window.rimuoviVetrina = function(id) {
        rimuoviVetrina(id).then(() => {
            caricaVetrine();
        });
    }

    function resettaForm() {
        formVetrina.reset();
        document.getElementById("id").value = "";
    }
});
```
