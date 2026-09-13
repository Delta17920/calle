const listEl = document.getElementById("list");
const detailEl = document.getElementById("detail");
const healthEl = document.getElementById("health");
const scenariosEl = document.getElementById("scenarios");

let selectedId = null;
let incidents = [];

async function loadHealth() {
  try {
    const health = await (await fetch("/api/health")).json();
    const calle = health.calleConfigured ? "CALL-E key set" : "CALL-E key missing";
    healthEl.textContent = `${calle} · on-call ${health.oncallConfigured ? "set" : "missing"} · failure catalog ready`;
    healthEl.className = `health ${health.calleConfigured && health.oncallConfigured ? "ok" : "bad"}`;
  } catch (error) {
    healthEl.textContent = String(error);
    healthEl.className = "health bad";
  }
}

async function loadScenarios() {
  const scenarios = await (await fetch("/api/scenarios")).json();
  scenariosEl.innerHTML = scenarios
    .map(
      (item) => `<button class="scenario" type="button" data-id="${item.id}">
        <strong>${escapeHtml(item.title)}</strong>
        ${escapeHtml(item.summary)}
        <small>Say: ${escapeHtml(item.sayOnPhone.replace("{code}", "CODE"))}</small>
      </button>`
    )
    .join("");
  for (const button of scenariosEl.querySelectorAll("button")) {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const created = await (
          await fetch("/api/incidents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: "console", scenarioId: button.dataset.id })
          })
        ).json();
        if (created.error) throw new Error(created.error);
        selectedId = created.id;
        await loadIncidents();
      } catch (error) {
        alert(error.message ?? error);
      } finally {
        button.disabled = false;
      }
    });
  }
}

async function loadIncidents() {
  incidents = await (await fetch("/api/incidents")).json();
  renderList();
  if (selectedId) {
    const match = incidents.find((item) => item.id === selectedId);
    if (match) renderDetail(match);
  } else if (incidents[0]) {
    selectedId = incidents[0].id;
    renderDetail(incidents[0]);
    renderList();
  }
}

function renderList() {
  listEl.innerHTML = incidents
    .map(
      (item) => `<li data-id="${item.id}" class="${item.id === selectedId ? "active" : ""}">
        <div class="status">${item.status}</div>
        <div>${escapeHtml(item.triggerReason).slice(0, 90)}</div>
        <small>${new Date(item.createdAt).toLocaleString()}</small>
      </li>`
    )
    .join("");
  for (const li of listEl.querySelectorAll("li")) {
    li.addEventListener("click", () => {
      selectedId = li.dataset.id;
      const item = incidents.find((row) => row.id === selectedId);
      renderList();
      if (item) renderDetail(item);
    });
  }
}

function renderDetail(item) {
  const snap = item.snapshot;
  const post = item.postActionSnapshot;
  const line = item.sayOnPhone
    ? item.sayOnPhone.replace("{code}", item.confirmationCode)
    : `Say the action, then confirm ${item.confirmationCode}.`;
  detailEl.innerHTML = `
    <p class="status">${item.status}</p>
    <h2>${escapeHtml(item.scenarioId || item.source)}</h2>
    <p>${escapeHtml(item.triggerReason)}</p>
    <div class="say">
      <h3>When the phone rings, say exactly</h3>
      <p><code>${escapeHtml(line)}</code></p>
      <p>Confirmation phrase: <code>${escapeHtml(item.confirmationCode)}</code></p>
      <pre>${escapeHtml(item.fixCommand || "")}</pre>
      ${
        item.calleCallId && !item.execution
          ? `<button type="button" id="sync">Pull CALL-E result</button>`
          : ""
      }
    </div>
    <p>CALL-E <code>${escapeHtml(item.calleCallId ?? "not placed yet")}</code></p>
    <div class="grid">
      <div class="card">
        <h3>Failure telemetry</h3>
        ${snap ? snapshotHtml(snap) : "<p>Loading case…</p>"}
      </div>
      <div class="card">
        <h3>Spoken decision / real fix</h3>
        <pre>${escapeHtml(JSON.stringify({ spoken: item.spoken, execution: item.execution }, null, 2))}</pre>
        ${item.error ? `<p class="health bad">${escapeHtml(item.error)}</p>` : ""}
      </div>
      <div class="card">
        <h3>Transcript</h3>
        <div class="transcript">${
          item.transcript?.length
            ? item.transcript
                .map(
                  (turn) =>
                    `<p class="${turn.speaker === "bot" ? "bot" : ""}"><strong>${escapeHtml(
                      turn.speaker
                    )}</strong> ${escapeHtml(turn.text)}</p>`
                )
                .join("")
            : "<p>Waiting for CALL-E.</p>"
        }</div>
      </div>
      <div class="card">
        <h3>After the runbook</h3>
        ${post ? snapshotHtml(post) : "<p>No post-action snapshot yet.</p>"}
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Audit</h3>
      <pre>${escapeHtml((item.audit ?? []).map((row) => `${row.at}  ${row.kind}  ${row.detail}`).join("\n"))}</pre>
    </div>
  `;
  const syncBtn = document.getElementById("sync");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      syncBtn.disabled = true;
      try {
        const updated = await (
          await fetch(`/api/incidents/${item.id}/sync`, { method: "POST" })
        ).json();
        if (updated.error) throw new Error(updated.error);
        selectedId = updated.id;
        await loadIncidents();
      } catch (error) {
        alert(error.message ?? error);
      } finally {
        syncBtn.disabled = false;
      }
    });
  }
}

function snapshotHtml(snap) {
  return `<pre>${escapeHtml(
    [
      `${snap.region} ${snap.cluster}/${snap.service}`,
      `running ${snap.runningCount} desired ${snap.desiredCount} pending ${snap.pendingCount}`,
      `task ${snap.currentRevision} → previous ${snap.previousRevision ?? "none"}`,
      `alarm ${snap.alarm.name ?? "-"} ${snap.alarm.state ?? ""} ${snap.alarm.reason ?? ""}`,
      `cpu ${snap.cpuPercent ?? "-"}%  5xx ${snap.target5xx ?? "-"}  unhealthy ${snap.unhealthyTargets ?? "-"}`,
      snap.securityGroup ? `sg ${snap.securityGroup.id}: ${snap.securityGroup.ingress.join("; ")}` : "",
      ...(snap.events ?? []).slice(0, 4),
      ...(snap.recentLogs ?? []).slice(-4)
    ]
      .filter(Boolean)
      .join("\n")
  )}</pre>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const stream = new EventSource("/api/stream");
stream.addEventListener("incident", () => {
  loadIncidents();
});

loadHealth();
loadScenarios();
loadIncidents();
setInterval(loadHealth, 15000);
