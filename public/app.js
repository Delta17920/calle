const scenariosEl = document.getElementById("scenarios");
const examplesEl = document.getElementById("examples");

async function loadScenarios() {
  let scenarios = [];
  try {
    scenarios = await (await fetch("/api/scenarios")).json();
  } catch {
    scenarios = [
      { id: "easy-scale", title: "Easy demo: scale four", sayOnPhone: "Scale four. Confirm go." },
      { id: "bad-deploy-5xx", title: "Bad deploy - checkout 5xx", sayOnPhone: "Rollback. Confirm go." }
    ];
  }
  scenariosEl.innerHTML = scenarios
    .map(
      (item) => `<button class="scenario" type="button" data-id="${item.id}">
        <i class="ph ph-lightning"></i>
        <span>${escapeHtml(item.title)}</span>
      </button>`
    )
    .join("");
  for (const button of scenariosEl.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      const target = document.getElementById(`example-${button.dataset.id}`) || document.getElementById("examples");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      for (const card of document.querySelectorAll(".example-card")) card.classList.remove("active");
      document.getElementById(`example-${button.dataset.id}`)?.classList.add("active");
    });
  }
}

function renderExample(item) {
  const spoken = item.spoken || {};
  const execution = item.execution || {};
  return `<article class="example-card" id="example-${escapeHtml(item.scenarioId)}">
    <p class="status"><i class="ph-fill ph-check-circle"></i> ${escapeHtml(item.status)}</p>
    <h2>${escapeHtml(item.title)}</h2>
    <p class="trigger">${escapeHtml(item.triggerReason)}</p>
    <div class="say">
      <h3><i class="ph ph-phone-call"></i> What to say</h3>
      <p><code>${escapeHtml(item.sayOnPhone)}</code></p>
      <p class="conf">Code: <code>${escapeHtml(item.confirmationCode)}</code></p>
      <pre>${escapeHtml(execution.command || "")}</pre>
    </div>
    <div class="grid">
      <div class="card">
        <h3><i class="ph ph-terminal-window"></i> What was decided</h3>
        <pre>${escapeHtml(
          JSON.stringify(
            {
              decision: spoken.decision,
              scaleTo: spoken.scaleTo,
              confirmationOk: spoken.confirmationOk,
              notes: spoken.notes,
              execution: execution.output
            },
            null,
            2
          )
        )}</pre>
      </div>
      <div class="card">
        <h3><i class="ph ph-chats-circle"></i> Transcript</h3>
        <div class="transcript">${(item.transcript || [])
          .map(
            (turn) =>
              `<p class="${turn.speaker === "bot" ? "bot" : ""}"><strong>${
                turn.speaker === "bot" ? "CALL-E" : "You"
              }:</strong> ${escapeHtml(turn.text)}</p>`
          )
          .join("")}</div>
      </div>
    </div>
    <div class="audit">
      <h3><i class="ph ph-clock-counter-clockwise"></i> What happened</h3>
      <pre>${escapeHtml((item.audit || []).join("\n"))}</pre>
    </div>
  </article>`;
}

async function loadExamples() {
  const examples = await (await fetch("/examples.json")).json();
  examplesEl.innerHTML = `<h2 class="examples-title">Two full runs</h2>
    <p class="examples-lead">What the call sounded like, what was decided, and which runbook ran.</p>
    ${examples.map(renderExample).join("")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

loadScenarios();
loadExamples();
