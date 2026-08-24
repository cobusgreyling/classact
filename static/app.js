const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  agents: [],
  models: [],
  selectedId: null,
  lastRunId: null,
  health: null,
};

function showTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
  $$(".pane").forEach((p) => p.classList.toggle("on", p.id === `tab-${name}`));
}

$$(".tab").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

window.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select")) return;
  const map = { i: "inspect", r: "run", w: "watch", b: "build" };
  if (map[e.key.toLowerCase()]) showTab(map[e.key.toLowerCase()]);
});

async function jget(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function jpost(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { detail: text };
  }
  if (!r.ok) {
    const detail = data.detail || data.error || text;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

function agentById(id) {
  return state.agents.find((a) => a.id === id);
}

function renderList() {
  const box = $("#agentList");
  box.innerHTML = "";
  for (const a of state.agents) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "item" + (a.id === state.selectedId ? " on" : "");
    b.innerHTML = `<span class="cls">${esc(a.class_name)}</span><span class="meta">${esc(a.origin)} · ${a.methods.length} methods</span>`;
    b.addEventListener("click", () => selectAgent(a.id));
    box.appendChild(b);
  }
}

function selectAgent(id) {
  state.selectedId = id;
  renderList();
  renderInspect();
  fillRunSelectors();
}

function renderInspect() {
  const a = agentById(state.selectedId);
  if (!a) {
    $("#inspectEmpty").classList.remove("hidden");
    $("#inspectView").classList.add("hidden");
    return;
  }
  $("#inspectEmpty").classList.add("hidden");
  $("#inspectView").classList.remove("hidden");
  $("#inspectOrigin").textContent = `${a.origin} / ${a.module}.py`;
  $("#inspectName").textContent = a.class_name;
  $("#inspectRole").textContent = a.role || "";
  const fields = $("#inspectFields");
  fields.innerHTML = "";
  if (!a.fields.length) {
    fields.innerHTML = `<span class="muted">No public annotated fields.</span>`;
  } else {
    for (const f of a.fields) {
      const c = document.createElement("span");
      c.className = "chip";
      c.innerHTML = `<b>${esc(f.name)}</b>: ${esc(f.type)}`;
      fields.appendChild(c);
    }
  }
  const methods = $("#inspectMethods");
  methods.innerHTML = "";
  for (const m of a.methods) {
    const el = document.createElement("div");
    el.className = "method";
    const tag = m.kind === "agentic"
      ? `<span class="tag">${esc(m.strategy || "…")}</span>`
      : `<span class="tag py">python</span>`;
    el.innerHTML = `
      <div class="head"><span class="name">${esc(m.name)}</span>${tag}</div>
      <p class="sig">${esc(m.signature)}</p>
      <p class="doc">${esc(m.doc || "")}</p>
      <button class="use" type="button" data-method="${esc(m.name)}">Run this method</button>`;
    el.querySelector(".use").addEventListener("click", () => {
      fillRunSelectors(a.id, m.name);
      showTab("run");
    });
    methods.appendChild(el);
  }
  $("#inspectSource").textContent = a.source || "Loading…";
  if (!a.source) {
    jget(`/api/agents/${encodeURIComponent(a.id)}`).then((full) => {
      a.source = full.source;
      if (state.selectedId === a.id) $("#inspectSource").textContent = full.source;
    }).catch(() => {
      $("#inspectSource").textContent = "(source unavailable)";
    });
  }
}

function fillRunSelectors(agentId, methodName) {
  const agentSel = $("#runAgent");
  const methodSel = $("#runMethod");
  const modelSel = $("#runModel");
  const keepAgent = agentId || agentSel.value || state.selectedId;
  agentSel.innerHTML = state.agents.map((a) =>
    `<option value="${esc(a.id)}">${esc(a.class_name)}</option>`
  ).join("");
  if (keepAgent) agentSel.value = keepAgent;
  const agent = agentById(agentSel.value);
  const methods = agent ? agent.methods : [];
  methodSel.innerHTML = methods.map((m) =>
    `<option value="${esc(m.name)}">${esc(m.name)} · ${m.kind === "agentic" ? (m.strategy || "agentic") : "python"}</option>`
  ).join("");
  if (methodName) methodSel.value = methodName;
  modelSel.innerHTML = (state.models.length ? state.models : [{ id: "", label: "default" }])
    .map((m) => `<option value="${esc(m.id)}">${esc(m.label || m.id)}</option>`)
    .join("");
  renderRunArgs();
}

function currentMethod() {
  const agent = agentById($("#runAgent").value);
  if (!agent) return null;
  return agent.methods.find((m) => m.name === $("#runMethod").value) || null;
}

function renderRunArgs() {
  const m = currentMethod();
  const box = $("#runArgs");
  box.innerHTML = "";
  $("#runHint").textContent = m
    ? (m.doc || m.signature)
    : "Choose an agent and method.";
  if (!m) return;
  for (const arg of m.args) {
    const lab = document.createElement("label");
    const isLong = arg.type === "str" && arg.name.match(/text|message|prompt|input/i);
    const control = isLong
      ? `<textarea id="arg-${arg.name}" rows="4" placeholder="${esc(arg.type)}"></textarea>`
      : `<input id="arg-${arg.name}" type="text" placeholder="${esc(arg.type)}${arg.default ? " = " + esc(arg.default) : ""}" />`;
    lab.innerHTML = `${esc(arg.name)} <span class="muted">(${esc(arg.type)})</span>${control}`;
    box.appendChild(lab);
    if (arg.default) {
      const el = lab.querySelector("input, textarea");
      const raw = arg.default.replace(/^['"]|['"]$/g, "");
      if (arg.name === "order_id") el.value = "ORD-1001";
      else if (!isLong) el.value = raw;
    }
  }
}

$("#runAgent").addEventListener("change", renderRunArgs);
$("#runMethod").addEventListener("change", renderRunArgs);

$("#runBtn").addEventListener("click", async () => {
  const m = currentMethod();
  const agentId = $("#runAgent").value;
  if (!m || !agentId) return;
  const args = {};
  for (const arg of m.args) {
    const el = document.getElementById(`arg-${arg.name}`);
    if (!el) continue;
    let val = el.value;
    if (arg.type === "int") val = Number.parseInt(val, 10);
    if (arg.type === "float") val = Number.parseFloat(val);
    if (arg.type === "bool") val = ["1", "true", "yes", "on"].includes(String(val).toLowerCase());
    args[arg.name] = val;
  }
  $("#runBtn").disabled = true;
  $("#runStatus").textContent = "running…";
  $("#runOut").textContent = "…";
  showTab("watch");
  $("#watchTree").innerHTML = `<div class="muted">waiting for spans…</div>`;
  try {
    const started = await jpost("/api/runs", {
      agent_id: agentId,
      method: m.name,
      args,
      model: $("#runModel").value || null,
    });
    state.lastRunId = started.run_id;
    $("#watchRun").textContent = started.run_id;
    watchRun(started.run_id);
  } catch (err) {
    $("#runStatus").textContent = "error";
    $("#runOut").textContent = String(err.message || err);
    $("#watchTree").innerHTML = `<div class="error">${esc(String(err.message || err))}</div>`;
    $("#runBtn").disabled = false;
  }
});

function watchRun(runId) {
  const spans = [];
  const es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
  es.onmessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    if (data.type === "span") {
      spans.push(data);
      renderTree(spans);
    }
    if (data.type === "done") {
      es.close();
      finishRun(runId);
    }
  };
  es.onerror = () => {
    es.close();
    finishRun(runId);
  };
}

async function finishRun(runId) {
  try {
    const run = await jget(`/api/runs/${encodeURIComponent(runId)}`);
    renderTree(run.spans || []);
    $("#runStatus").textContent = run.status;
    if (run.status === "ok") {
      $("#runOut").textContent = JSON.stringify(run.result, null, 2);
    } else {
      $("#runOut").textContent = run.error || run.status;
    }
  } catch (err) {
    $("#runOut").textContent = String(err.message || err);
  } finally {
    $("#runBtn").disabled = false;
  }
}

function renderTree(spans) {
  const box = $("#watchTree");
  if (!spans.length) {
    box.innerHTML = `<div class="muted">no spans yet</div>`;
    return;
  }
  const byId = {};
  for (const s of spans) byId[s.span_id] = { ...s, children: [] };
  const roots = [];
  for (const s of spans) {
    const node = byId[s.span_id];
    if (s.parent_id && byId[s.parent_id]) byId[s.parent_id].children.push(node);
    else roots.push(node);
  }
  box.innerHTML = roots.map(renderNode).join("");
}

function renderNode(node) {
  const ms = node.start && node.end ? ((node.end - node.start) / 1e6).toFixed(1) + " ms" : "";
  const bits = [];
  const attrs = node.attrs || {};
  if (attrs["llm.model_name"]) bits.push(attrs["llm.model_name"]);
  const prompt = attrs["llm.token_count.prompt"] || attrs["llm.token_count.prompt_tokens"];
  const completion = attrs["llm.token_count.completion"] || attrs["llm.token_count.completion_tokens"];
  if (prompt != null) bits.push(`in ${prompt}`);
  if (completion != null) bits.push(`out ${completion}`);
  const snippet = attrs["output.value"] || attrs.code || "";
  const stClass = node.status === "ERROR" ? "bad" : "st";
  return `<div class="node">
    <div class="node-h">
      <span class="nm">${esc(node.name)}</span>
      <span class="${stClass}">${esc(node.status || "")}</span>
      <span class="muted">${esc(ms)} ${esc(bits.join(" · "))}</span>
    </div>
    ${snippet ? `<div class="dt">${esc(String(snippet).slice(0, 1200))}</div>` : ""}
    ${node.children.map(renderNode).join("")}
  </div>`;
}

function defaultMethodCard() {
  return {
    name: "write_headline",
    doc: "Write a single headline. No extra commentary.",
    arg: "text",
    strategy: "Predict",
  };
}

function renderBuildMethods(cards) {
  const box = $("#buildMethods");
  box.innerHTML = "";
  cards.forEach((card, idx) => {
    const el = document.createElement("div");
    el.className = "mcard";
    el.innerHTML = `
      <div class="row2">
        <label>Method <input class="mn" value="${esc(card.name)}" /></label>
        <label>Arg <input class="ma" value="${esc(card.arg)}" /></label>
        <label>Strategy
          <select class="ms">
            <option ${card.strategy === "Predict" ? "selected" : ""}>Predict</option>
            <option ${card.strategy === "CodeAct" ? "selected" : ""}>CodeAct</option>
          </select>
        </label>
        <button class="btn ghost rm" type="button">Remove</button>
      </div>
      <label>Docstring / prompt <input class="md" value="${esc(card.doc)}" /></label>`;
    el.querySelector(".rm").addEventListener("click", () => {
      cards.splice(idx, 1);
      renderBuildMethods(cards);
    });
    box.appendChild(el);
  });
  box._cards = cards;
}

function readBuildSpec() {
  const cards = $$("#buildMethods .mcard").map((el) => ({
    name: el.querySelector(".mn").value.trim(),
    doc: el.querySelector(".md").value.trim(),
    args: [{ name: el.querySelector(".ma").value.trim() || "text", type: "str" }],
    returns: "str",
    strategy: el.querySelector(".ms").value,
  }));
  return {
    class_name: $("#buildClass").value.trim(),
    role: $("#buildRole").value.trim(),
    methods: cards,
  };
}

$("#addMethod").addEventListener("click", () => {
  const cards = $$("#buildMethods .mcard").map((el) => ({
    name: el.querySelector(".mn").value,
    doc: el.querySelector(".md").value,
    arg: el.querySelector(".ma").value,
    strategy: el.querySelector(".ms").value,
  }));
  cards.push({ name: "summarize", doc: "Summarize in one sentence.", arg: "text", strategy: "Predict" });
  renderBuildMethods(cards);
});

$("#previewBtn").addEventListener("click", async () => {
  try {
    const data = await jpost("/api/build/preview", readBuildSpec());
    $("#buildOut").textContent = data.source;
  } catch (err) {
    $("#buildOut").textContent = String(err.message || err);
  }
});

$("#saveBtn").addEventListener("click", async () => {
  try {
    const data = await jpost("/api/build", readBuildSpec());
    $("#buildOut").textContent = data.source;
    await loadAgents();
    if (data.agent_id) {
      selectAgent(data.agent_id);
      showTab("inspect");
    }
  } catch (err) {
    $("#buildOut").textContent = String(err.message || err);
  }
});

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadAgents() {
  const data = await jget("/api/agents");
  state.agents = data.agents || [];
  renderList();
  fillRunSelectors();
  if (!state.selectedId && state.agents[0]) selectAgent(state.agents[0].id);
}

async function boot() {
  renderBuildMethods([defaultMethodCard()]);
  try {
    const health = await jget("/api/health");
    state.health = health;
    const nim = health.nim || {};
    const live = health.has_key && nim.ok;
    $("#statusLine").textContent = live
      ? `NIM live · ${health.nim_model} · ${health.agents} agents`
      : `offline inspect · ${nim.error || "no NVIDIA_API_KEY"}`;
    $("#statusLine").classList.toggle("error", !live);
  } catch (err) {
    $("#statusLine").textContent = String(err.message || err);
    $("#statusLine").classList.add("error");
  }
  try {
    const models = await jget("/api/models");
    state.models = models.models || [];
  } catch {
    state.models = [];
  }
  await loadAgents();
}

boot();
