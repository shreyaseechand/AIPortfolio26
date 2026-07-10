/* Shared gate behaviour — password verified server-side by /api/login. */
(function () {
  var gate   = document.getElementById("gate");
  var form   = document.getElementById("gateForm");
  var input  = document.getElementById("gateInput");
  var submit = document.getElementById("gateSubmit");
  var error  = document.getElementById("gateError");

  function reject() {
    error.classList.add("is-visible");
    gate.classList.remove("is-shaking");
    void gate.offsetWidth; // reflow so the shake replays
    gate.classList.add("is-shaking");
    input.select();
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    submit.disabled = true;
    try {
      var res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: input.value }),
      });
      if (res.ok) {
        var back = new URLSearchParams(location.search).get("from");
        location.replace(back || "/");
        return;
      }
    } catch (_) { /* network error → treat as failure */ }
    submit.disabled = false;
    reject();
  });

  input.addEventListener("input", function () {
    error.classList.remove("is-visible");
  });
})();
