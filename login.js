
```javascript
document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    // Semplice validazione (da sostituire con logica effettiva)
    if (username === "admin" && password === "password") {
        // Reindirizza alla pagina delle vetrine
        window.location.href = "vetrine.html";
    } else {
        const errorMessage = document.getElementById("error-message");
        errorMessage.innerText = "Credenziali non valide.";
        errorMessage.style.display = "block";
    }
});
```
