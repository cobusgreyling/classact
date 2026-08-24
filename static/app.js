const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  agents: [],
  models: [],
  selectedId: null,
  lastRunId: null,
  health: null,
  build: null,
  selectedNode: null,
};

function nid() {
  return "n_" + Math.random().toString(36).slice(2, 9);
}

function showTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
  $$(".pane").forEach((p) => p.classList.toggle("on", p.id === `tab-${name}`));
  if (name === "build") requestAnimationFrame(() => renderBuild({ relayout: true }));
  if (name === "run") requestAnimationFrame(() => $("#runPrompt")?.focus());
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
    const nAgentic = a.methods.filter((m) => m.kind === "agentic").length;
    b.innerHTML = `<span class="cls">${esc(a.class_name)}</span><span class="meta">${esc(a.origin)} · ${nAgentic} ··· / ${a.methods.length}</span>`;
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
  $("#inspectDiagram").innerHTML = umlCard(a);
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

function umlCard(a) {
  const fields = (a.fields || []).map((f) =>
    `<div class="uml-row"><span>${esc(f.name)}</span><span class="muted">${esc(f.type)}</span></div>`
  ).join("") || `<div class="uml-row muted">no public fields</div>`;
  const methods = a.methods.map((m) => {
    const mark = m.kind === "agentic" ? `<span class="ell">…</span>` : `<span class="muted">def</span>`;
    return `<div class="uml-row hit" data-run-method="${esc(m.name)}"><span>${mark} ${esc(m.name)}</span><span class="muted">${esc(m.strategy || "python")} · run</span></div>`;
  }).join("");
  const orbs = a.methods.map((m) => {
    const cls = m.kind === "python" ? "chip" : "chip";
    return `<span class="${cls}"><b>${esc(m.kind === "agentic" ? "…" : "def")}</b> ${esc(m.name)}</span>`;
  }).join("");
  return `<article class="uml-card">
    <header>
      <span class="kicker">class</span>
      <strong>${esc(a.class_name)}</strong>
      <em>(Agent)</em>
    </header>
    <div class="uml-sec">${fields}</div>
    <div class="uml-sec">${methods}</div>
    <div class="uml-orbit">${orbs}</div>
  </article>`;
}

$("#forkBtn").addEventListener("click", () => {
  const a = agentById(state.selectedId);
  if (!a) return;
  loadBuildFromAgent(a);
  showTab("build");
});

$("#inspectDiagram").addEventListener("click", (e) => {
  const row = e.target.closest("[data-run-method]");
  if (!row) return;
  fillRunSelectors(state.selectedId, row.dataset.runMethod);
  showTab("run");
});

const TEXT_ARG = /^(text|message|prompt|query|input|question|content|body)$/i;

const RUN_SAMPLES = {
  ClassifierAgent: [
    { text: "Great product, but shipping was slow." },
    { text: "Broken feature, needs immediate fix!" },
    { text: "The headphones sound incredible and arrived a day early." },
  ],
  SupportAgent: [
    { text: "I want a refund for the studio headphones.", extras: { order_id: "ORD-1001" } },
    { text: "Package never arrived. Where is my DGX Spark?", extras: { order_id: "ORD-2044" } },
    { text: "The cable is fine but I changed my mind — can I send it back?", extras: { order_id: "ORD-3302" } },
  ],
  HeadlineAgent: [
    { text: "Nemotron 3.5 Lightning is now a NIM for always-on agents." },
    { text: "ClassAct lets you inspect, run, watch, and build object-oriented agents." },
  ],
  FeedbackAgent: [
    { text: "Love the build quality. Support took three days to reply." },
  ],
};

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
  else {
    const agentic = methods.find((m) => m.kind === "agentic");
    if (agentic) methodSel.value = agentic.name;
  }
  modelSel.innerHTML = (state.models.length ? state.models : [{ id: "", label: "default" }])
    .map((m) => `<option value="${esc(m.id)}">${esc(m.label || m.id)}</option>`)
    .join("");
  renderRunArgs();
}

function currentAgent() {
  return agentById($("#runAgent").value);
}

function currentMethod() {
  const agent = currentAgent();
  if (!agent) return null;
  return agent.methods.find((m) => m.name === $("#runMethod").value) || null;
}

function primaryTextArg(m) {
  if (!m || !m.args) return null;
  const strings = m.args.filter((a) => a.type === "str" || !a.type);
  return strings.find((a) => TEXT_ARG.test(a.name)) || strings[0] || null;
}

function renderRunArgs() {
  const agent = currentAgent();
  const m = currentMethod();
  const box = $("#runArgs");
  const prompt = $("#runPrompt");
  box.innerHTML = "";
  $("#runHint").textContent = m
    ? `${agent ? agent.class_name + "." : ""}${m.name} — ${m.doc || m.signature}`
    : "Choose an agent and method, then type a message.";
  if (!m) return;
  const primary = primaryTextArg(m);
  $("#promptLabel").textContent = primary ? primary.name : "input";
  prompt.placeholder = primary
    ? `Type ${primary.name} for ${m.name}…`
    : "This method has no text argument — fill the fields below.";
  prompt.disabled = !primary;
  for (const arg of m.args) {
    if (primary && arg.name === primary.name) continue;
    const lab = document.createElement("label");
    const raw = arg.default ? String(arg.default).replace(/^['"]|['"]$/g, "") : "";
    const fallback = arg.name === "order_id" ? "ORD-1001" : raw;
    lab.innerHTML = `${esc(arg.name)} <span class="muted">(${esc(arg.type)})</span>
      <input id="arg-${arg.name}" type="text" value="${esc(fallback)}" placeholder="${esc(arg.type)}" />`;
    box.appendChild(lab);
  }
  updatePromptCount();
  renderSamples(agent, m, primary);
}

function renderSamples(agent, method, primary) {
  const box = $("#runSamples");
  const key = agent ? agent.class_name : "";
  const list = RUN_SAMPLES[key] || [
    { text: "Summarize this in one sentence: always-on agents should execute on Lightning." },
    { text: "The unit works, but setup took too long." },
  ];
  box.innerHTML = list.map((s, i) =>
    `<button type="button" class="sample" data-i="${i}">${esc(s.text)}</button>`
  ).join("");
  box.querySelectorAll(".sample").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = list[Number(btn.dataset.i)];
      if (primary) $("#runPrompt").value = s.text;
      if (s.extras) {
        for (const [k, v] of Object.entries(s.extras)) {
          const el = document.getElementById(`arg-${k}`);
          if (el) el.value = v;
        }
      }
      updatePromptCount();
      $("#runPrompt").focus();
    });
  });
}

function updatePromptCount() {
  const n = ($("#runPrompt").value || "").length;
  $("#promptCount").textContent = `${n} chars`;
}

function collectRunArgs(m) {
  const args = {};
  const primary = primaryTextArg(m);
  if (primary) args[primary.name] = $("#runPrompt").value;
  for (const arg of m.args) {
    if (primary && arg.name === primary.name) continue;
    const el = document.getElementById(`arg-${arg.name}`);
    if (!el) continue;
    let val = el.value;
    if (arg.type === "int") val = Number.parseInt(val, 10);
    if (arg.type === "float") val = Number.parseFloat(val);
    if (arg.type === "bool") val = ["1", "true", "yes", "on"].includes(String(val).toLowerCase());
    args[arg.name] = val;
  }
  return args;
}

function renderReply(ok, value, error) {
  const box = $("#runResult");
  const raw = $("#runOut");
  if (!ok) {
    box.className = "reply err";
    box.textContent = error || "Run failed.";
    raw.classList.remove("hidden");
    raw.textContent = error || "";
    return;
  }
  box.className = "reply";
  if (value && typeof value === "object") {
    const lead = value.summary || value.note || "";
    const rows = Object.entries(value)
      .filter(([k]) => k !== "summary" && k !== "note")
      .map(([k, v]) => `<div class="kv"><b>${esc(k)}</b><span>${esc(Array.isArray(v) ? v.join(", ") : v)}</span></div>`)
      .join("");
    box.innerHTML = `${lead ? `<div class="lead">${esc(lead)}</div>` : ""}${rows || ""}`;
    raw.classList.remove("hidden");
    raw.textContent = JSON.stringify(value, null, 2);
  } else {
    box.innerHTML = `<div class="lead">${esc(String(value ?? ""))}</div>`;
    raw.classList.add("hidden");
    raw.textContent = String(value ?? "");
  }
}

$("#runAgent").addEventListener("change", () => {
  fillRunSelectors($("#runAgent").value);
});
$("#runMethod").addEventListener("change", renderRunArgs);
$("#runPrompt").addEventListener("input", updatePromptCount);
$("#runPrompt").addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    $("#runBtn").click();
  }
});

$("#runBtn").addEventListener("click", async () => {
  const m = currentMethod();
  const agentId = $("#runAgent").value;
  if (!m || !agentId) return;
  const args = collectRunArgs(m);
  $("#runBtn").disabled = true;
  $("#runStatus").textContent = "running on NIM…";
  $("#runResult").className = "reply wait";
  $("#runResult").textContent = "Calling the agent…";
  $("#runLive").innerHTML = `<div class="muted">waiting for spans…</div>`;
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
    renderReply(false, null, String(err.message || err));
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
    $("#runStatus").textContent = run.status === "ok" ? "done" : run.status;
    if (run.status === "ok") renderReply(true, run.result);
    else renderReply(false, null, run.error || run.status);
  } catch (err) {
    renderReply(false, null, String(err.message || err));
  } finally {
    $("#runBtn").disabled = false;
  }
}

function renderTree(spans) {
  const html = !spans.length ? `<div class="muted">no spans yet</div>` : null;
  if (html) {
    $("#watchTree").innerHTML = html;
    const live = $("#runLive");
    if (live) live.innerHTML = html;
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
  const painted = roots.map((n) => renderNode(n, 0)).join("");
  $("#watchTree").innerHTML = painted;
  const live = $("#runLive");
  if (live) live.innerHTML = painted;
}

function renderNode(node, depth) {
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
  return `<div class="tbox${depth ? " child" : ""}">
    <div class="th">
      <span class="nm">${esc(node.name)}</span>
      <span class="${stClass}">${esc(node.status || "")}</span>
      <span class="muted">${esc(ms)} ${esc(bits.join(" · "))}</span>
    </div>
    ${snippet ? `<div class="td">${esc(String(snippet).slice(0, 900))}</div>` : ""}
    ${node.children.map((c) => renderNode(c, depth + 1)).join("")}
  </div>`;
}

/* ───────── Build ───────── */

const TEMPLATES = [
  {
    id: "headline",
    label: "Headline",
    spec: () => ({
      class_name: "HeadlineAgent",
      role: "You write short, faithful headlines for product updates.",
      fields: [],
      methods: [
        meth("write_headline", "Write a single headline. No extra commentary.", [{ name: "text", type: "str" }], "str", "agentic", "Predict"),
      ],
    }),
  },
  {
    id: "classifier",
    label: "Classifier",
    spec: () => ({
      class_name: "FeedbackAgent",
      role: "You classify customer feedback faithfully. Do not invent facts.",
      fields: [],
      methods: [
        meth("classify", "Classify sentiment and urgency in one pass.", [{ name: "text", type: "str" }], "str", "agentic", "Predict"),
      ],
    }),
  },
  {
    id: "support",
    label: "Support",
    spec: () => ({
      class_name: "SupportDesk",
      role: "You are a support agent. Call live Python tools on self before you decide.",
      fields: [{ name: "region", type: "str" }],
      methods: [
        meth("get_order", "Return the live order record, or empty.", [{ name: "order_id", type: "str" }], "str", "python"),
        meth("is_refund_eligible", "True only if delivered within 30 days.", [{ name: "order_id", type: "str" }], "bool", "python"),
        meth("triage", "Create a typed support ticket for this message and order.", [{ name: "message", type: "str" }, { name: "order_id", type: "str" }], "str", "agentic", "CodeAct"),
      ],
    }),
  },
  {
    id: "blank",
    label: "Blank",
    spec: () => ({
      class_name: "MyAgent",
      role: "You are a focused specialist agent.",
      fields: [],
      methods: [],
    }),
  },
];

function meth(name, doc, args, returns, kind, strategy) {
  return {
    id: nid(),
    name,
    doc,
    args: args.map((a) => ({ ...a })),
    returns: returns || "str",
    kind: kind || "agentic",
    strategy: strategy || "Predict",
    pinned: false,
    x: 0,
    y: 0,
  };
}

function defaultBuild() {
  return TEMPLATES[0].spec();
}

function startNewAgent() {
  const blank = TEMPLATES.find((t) => t.id === "blank");
  state.build = blank.spec();
  state.selectedNode = null;
  showTab("build");
}

$("#newAgentBtn").addEventListener("click", startNewAgent);

function loadBuildFromAgent(a) {
  state.build = {
    class_name: a.class_name,
    role: (a.role || "").split("\n")[0],
    fields: (a.fields || []).map((f) => ({
      name: f.name,
      type: ["str", "int", "float", "bool"].includes(f.type) ? f.type : "str",
    })),
    methods: a.methods.map((m) => meth(
      m.name,
      m.doc || "",
      (m.args || []).map((arg) => ({
        name: arg.name,
        type: ["str", "int", "float", "bool"].includes(arg.type) ? arg.type : "str",
      })),
      ["str", "int", "float", "bool"].includes(m.returns) ? m.returns : "str",
      m.kind === "python" ? "python" : "agentic",
      m.strategy === "CodeAct" ? "CodeAct" : "Predict",
    )),
  };
  state.selectedNode = state.build.methods[0] ? state.build.methods[0].id : null;
}

function renderTemplates() {
  const box = $("#templates");
  box.innerHTML = TEMPLATES.map((t) =>
    `<button type="button" data-tpl="${t.id}">${esc(t.label)}</button>`
  ).join("");
  box.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = TEMPLATES.find((x) => x.id === btn.dataset.tpl);
      state.build = t.spec();
      state.selectedNode = state.build.methods[0] ? state.build.methods[0].id : null;
      renderBuild({ relayout: true });
    });
  });
}

function layoutOrbs(panel, force = false) {
  const b = state.build;
  const rect = panel.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height * 0.48;
  const slots = b.methods.length + 1;
  const radius = Math.max(150, Math.min(rect.width, rect.height) * 0.34);
  b.methods.forEach((m, i) => {
    if (m.pinned) return;
    if (!force && (m.x || m.y)) return;
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / slots;
    m.x = cx + radius * Math.cos(ang);
    m.y = cy + radius * Math.sin(ang);
  });
  const ang = -Math.PI / 2 + (2 * Math.PI * b.methods.length) / slots;
  return {
    cx,
    cy,
    addX: cx + radius * Math.cos(ang),
    addY: cy + radius * Math.sin(ang),
  };
}

function renderBuild(opts = {}) {
  if (!state.build) state.build = defaultBuild();
  const b = state.build;
  const panel = $("#graphPanel");
  const core = $("#classCore");
  $("#coreName").textContent = b.class_name || "Agent";
  $("#coreRole").textContent = b.role || "";
  $("#coreFields").innerHTML = (b.fields || []).map((f) =>
    `<span class="chip"><b>${esc(f.name)}</b>: ${esc(f.type)}</span>`
  ).join("");
  core.classList.remove("sel");
  if (!b.methods.some((m) => m.id === state.selectedNode)) {
    state.selectedNode = b.methods[0] ? b.methods[0].id : null;
  }
  const barClass = $("#barClass");
  const barRole = $("#barRole");
  if (barClass && document.activeElement !== barClass) barClass.value = b.class_name || "";
  if (barRole && document.activeElement !== barRole) barRole.value = b.role || "";

  const geom = layoutOrbs(panel, Boolean(opts.relayout));
  const layer = $("#orbLayer");
  layer.innerHTML = "";
  b.methods.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const kindClass = m.kind === "python" ? "py" : (m.strategy === "CodeAct" ? "act" : "");
    btn.className = `orb ${kindClass}${state.selectedNode === m.id ? " sel" : ""}`;
    btn.dataset.id = m.id;
    btn.style.left = `${m.x}px`;
    btn.style.top = `${m.y}px`;
    const glyph = m.kind === "python" ? "python" : (m.strategy === "CodeAct" ? "codeact …" : "predict …");
    const sig = (m.args || []).map((a) => a.name).join(", ");
    btn.innerHTML = `<span class="glyph">${esc(glyph)}</span><span class="oname">${esc(m.name)}</span><span class="osig">(${esc(sig)}) → ${esc(m.returns)}</span>`;
    btn.addEventListener("pointerdown", (ev) => startDrag(ev, m, btn));
    btn.addEventListener("click", (ev) => {
      if (btn.dataset.dragged === "1") return;
      ev.stopPropagation();
      state.selectedNode = m.id;
      renderBuild();
    });
    layer.appendChild(btn);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "orb add";
  add.style.left = `${geom.addX}px`;
  add.style.top = `${geom.addY}px`;
  add.textContent = "+";
  add.title = "Add method";
  add.addEventListener("click", () => {
    const n = meth("new_method", "Describe the task.", [{ name: "text", type: "str" }], "str", "agentic", "Predict");
    b.methods.push(n);
    state.selectedNode = n.id;
    renderBuild({ relayout: true });
  });
  layer.appendChild(add);

  drawWires(panel, geom, b.methods);
  renderInspector();
  $("#buildOut").textContent = generateSourceJS(b);
}

function drawWires(panel, geom, methods) {
  const svg = $("#buildWires");
  const w = panel.clientWidth;
  const h = panel.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.innerHTML = methods.map((m) => {
    const cls = m.kind === "python" ? "py" : (m.strategy === "CodeAct" ? "act" : "");
    const mx = (geom.cx + m.x) / 2;
    const my = (geom.cy + m.y) / 2 - 24;
    const on = m.id === state.selectedNode ? " on" : "";
    return `<path class="${cls}${on}" d="M ${geom.cx} ${geom.cy} Q ${mx} ${my} ${m.x} ${m.y}" />`;
  }).join("");
}

let drag = null;

function startDrag(ev, method, el) {
  ev.preventDefault();
  el.dataset.dragged = "0";
  el.setPointerCapture(ev.pointerId);
  const panel = $("#graphPanel").getBoundingClientRect();
  drag = {
    id: method.id,
    dx: ev.clientX - panel.left - method.x,
    dy: ev.clientY - panel.top - method.y,
    startX: ev.clientX,
    startY: ev.clientY,
    el,
  };
}

window.addEventListener("pointermove", (ev) => {
  if (!drag) return;
  const panel = $("#graphPanel").getBoundingClientRect();
  const m = state.build.methods.find((x) => x.id === drag.id);
  if (!m) return;
  m.x = clamp(ev.clientX - panel.left - drag.dx, 40, panel.width - 40);
  m.y = clamp(ev.clientY - panel.top - drag.dy, 40, panel.height - 40);
  m.pinned = true;
  drag.el.style.left = `${m.x}px`;
  drag.el.style.top = `${m.y}px`;
  if (Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) > 4) {
    drag.el.dataset.dragged = "1";
  }
  const geom = {
    cx: panel.width / 2,
    cy: panel.height * 0.48,
  };
  drawWires($("#graphPanel"), geom, state.build.methods);
});

window.addEventListener("pointerup", () => { drag = null; });

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

window.addEventListener("resize", () => {
  if ($("#tab-build").classList.contains("on")) {
    if (state.build) {
      state.build.methods.forEach((m) => { m.pinned = false; m.x = 0; m.y = 0; });
    }
    renderBuild({ relayout: true });
  }
});

function selectedMethod() {
  if (!state.build || !state.selectedNode) return null;
  return state.build.methods.find((m) => m.id === state.selectedNode) || null;
}

function renderInspector() {
  const box = $("#buildInspector");
  const b = state.build;
  const m = selectedMethod();
  if (!m) {
    box.innerHTML = `<h3>Method</h3><p class="muted">Click a method node, or press <strong>+</strong> to add one. The class in the center is only a label — name and role sit above the graph.</p>`;
    return;
  }
  const argsHtml = (m.args || []).map((a, i) => `
    <div class="arg-row" data-i="${i}">
      <input class="an" value="${esc(a.name)}" />
      <select class="at">
        ${["str", "int", "float", "bool"].map((t) => `<option ${t === a.type ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      <button type="button" class="btn ghost tiny ar">×</button>
    </div>`).join("");
  box.innerHTML = `
    <h3>Method</h3>
    <label>Name <input id="insName" value="${esc(m.name)}" /></label>
    <h4>Kind</h4>
    <div class="picker">
      <button type="button" class="pick ${m.kind === "agentic" ? "on" : ""}" data-kind="agentic">Agentic <small>body is … · LLM</small></button>
      <button type="button" class="pick ${m.kind === "python" ? "on" : ""}" data-kind="python">Python <small>deterministic tool</small></button>
    </div>
    <div id="stratWrap" class="${m.kind === "python" ? "hidden" : ""}">
      <h4>Strategy</h4>
      <div class="picker">
        <button type="button" class="pick ${m.strategy === "Predict" ? "on" : ""}" data-st="Predict">Predict <small>typed, no code exec</small></button>
        <button type="button" class="pick ${m.strategy === "CodeAct" ? "on" : ""}" data-st="CodeAct">CodeAct <small>model writes Python</small></button>
      </div>
    </div>
    <h4>Arguments</h4>
    <div id="insArgs">${argsHtml}</div>
    <button type="button" class="btn ghost tiny" id="addArg">Add arg</button>
    <label>Returns
      <select id="insRet">
        ${["str", "int", "float", "bool"].map((t) => `<option ${t === m.returns ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </label>
    <label>Docstring / prompt <textarea id="insDoc" rows="3">${esc(m.doc)}</textarea></label>
    <div class="inspector-actions">
      <button type="button" class="btn ghost tiny" id="dupM">Duplicate</button>
      <button type="button" class="btn ghost tiny" id="delM">Remove</button>
    </div>`;
  $("#insName").addEventListener("input", (e) => { m.name = e.target.value; patchOrb(m); liveSrc(); });
  $("#insDoc").addEventListener("input", (e) => { m.doc = e.target.value; liveSrc(); });
  $("#insRet").addEventListener("change", (e) => { m.returns = e.target.value; patchOrb(m); liveSrc(); });
  box.querySelectorAll("[data-kind]").forEach((btn) => {
    btn.addEventListener("click", () => { m.kind = btn.dataset.kind; renderBuild(); });
  });
  box.querySelectorAll("[data-st]").forEach((btn) => {
    btn.addEventListener("click", () => { m.strategy = btn.dataset.st; renderBuild(); });
  });
  $("#addArg").addEventListener("click", () => {
    m.args.push({ name: "value", type: "str" });
    renderBuild();
  });
  box.querySelectorAll(".arg-row").forEach((row) => {
    const i = Number(row.dataset.i);
    row.querySelector(".an").addEventListener("input", (e) => { m.args[i].name = e.target.value; patchOrb(m); liveSrc(); });
    row.querySelector(".at").addEventListener("change", (e) => { m.args[i].type = e.target.value; patchOrb(m); liveSrc(); });
    row.querySelector(".ar").addEventListener("click", () => { m.args.splice(i, 1); renderBuild(); });
  });
  $("#dupM").addEventListener("click", () => {
    const copy = meth(m.name + "_copy", m.doc, m.args, m.returns, m.kind, m.strategy);
    b.methods.push(copy);
    state.selectedNode = copy.id;
    renderBuild();
  });
  $("#delM").addEventListener("click", () => {
    b.methods = b.methods.filter((x) => x.id !== m.id);
    state.selectedNode = b.methods[0] ? b.methods[0].id : null;
    renderBuild();
  });
}

function renderFieldEditor() {
  const wrap = $("#insFields");
  const b = state.build;
  wrap.innerHTML = (b.fields || []).map((f, i) => `
    <div class="arg-row" data-i="${i}">
      <input class="fn" value="${esc(f.name)}" />
      <select class="ft">
        ${["str", "int", "float", "bool"].map((t) => `<option ${t === f.type ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      <button type="button" class="btn ghost tiny fr">×</button>
    </div>`).join("") || `<p class="muted">No fields — the object holds no extra state.</p>`;
  wrap.querySelectorAll(".arg-row").forEach((row) => {
    const i = Number(row.dataset.i);
    row.querySelector(".fn").addEventListener("input", (e) => { b.fields[i].name = e.target.value; syncCore(); liveSrc(); });
    row.querySelector(".ft").addEventListener("change", (e) => { b.fields[i].type = e.target.value; syncCore(); liveSrc(); });
    row.querySelector(".fr").addEventListener("click", () => { b.fields.splice(i, 1); renderBuild(); });
  });
}

function syncCore() {
  const b = state.build;
  $("#coreName").textContent = b.class_name || "Agent";
  $("#coreRole").textContent = b.role || "";
  $("#coreFields").innerHTML = (b.fields || []).map((f) =>
    `<span class="chip"><b>${esc(f.name)}</b>: ${esc(f.type)}</span>`
  ).join("");
}

function patchOrb(m) {
  const el = document.querySelector(`.orb[data-id="${m.id}"]`);
  if (!el) return;
  const glyph = m.kind === "python" ? "python" : (m.strategy === "CodeAct" ? "codeact …" : "predict …");
  const sig = (m.args || []).map((a) => a.name).join(", ");
  const g = el.querySelector(".glyph");
  const n = el.querySelector(".oname");
  const s = el.querySelector(".osig");
  if (g) g.textContent = glyph;
  if (n) n.textContent = m.name;
  if (s) s.textContent = `(${sig}) → ${m.returns}`;
}

function liveSrc() {
  $("#buildOut").textContent = generateSourceJS(state.build);
}

function toSpec(b) {
  return {
    class_name: b.class_name.trim(),
    role: b.role.trim(),
    fields: (b.fields || []).filter((f) => f.name.trim()).map((f) => ({ name: f.name.trim(), type: f.type })),
    methods: (b.methods || []).map((m) => ({
      name: m.name.trim(),
      doc: m.doc,
      args: (m.args || []).filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), type: a.type })),
      returns: m.returns,
      kind: m.kind,
      strategy: m.strategy,
    })),
  };
}

const DEFAULTS = { str: '""', int: "0", float: "0.0", bool: "False" };

function generateSourceJS(b) {
  try {
    const spec = toSpec(b);
    if (!spec.methods.length) return "# add a method to generate a class";
    const agentic = spec.methods.filter((m) => m.kind === "agentic");
    const strategies = [...new Set(agentic.map((m) => m.strategy === "CodeAct" ? "CodeActStrategy" : "PredictStrategy"))].sort();
    const role = (spec.role || "You are a focused specialist agent.").replaceAll('\\', '\\\\').replaceAll('"""', "'''");
    const lines = [
      '"""Generated by ClassAct. Agent class for NVIDIA Object-Oriented Agents."""',
      "",
      strategies.length ? "from nooa import Agent, strategy" : "from nooa import Agent",
    ];
    if (strategies.length) lines.push(`from nooa.strategies import ${strategies.join(", ")}`);
    lines.push("", "", `class ${spec.class_name}(Agent):`, `    """${role}"""`, "");
    for (const f of spec.fields) {
      lines.push(`    ${f.name}: ${f.type} = ${DEFAULTS[f.type]}`);
    }
    if (spec.fields.length) lines.push("");
    for (const m of spec.methods) {
      const args = ["self", ...m.args.map((a) => `${a.name}: ${a.type}`)].join(", ");
      const doc = (m.doc || `Run ${m.name}.`).replaceAll('\\', '\\\\').replaceAll('"""', "'''");
      if (m.kind === "python") {
        lines.push(`    def ${m.name}(${args}) -> ${m.returns}:`);
        lines.push(`        """${doc}"""`);
        lines.push(`        return ${DEFAULTS[m.returns] || "None"}`);
      } else {
        const st = m.strategy === "CodeAct" ? "CodeActStrategy" : "PredictStrategy";
        lines.push(`    @strategy(${st}())`);
        lines.push(`    async def ${m.name}(${args}) -> ${m.returns}:`);
        lines.push(`        """${doc}"""`);
        lines.push("        ...");
      }
      lines.push("");
    }
    return lines.join("\n").trimEnd() + "\n";
  } catch (err) {
    return `# ${err.message || err}`;
  }
}

$("#saveBtn").addEventListener("click", async () => {
  const spec = toSpec(state.build);
  $("#buildStatus").textContent = "writing…";
  try {
    const data = await jpost("/api/build", spec);
    $("#buildOut").textContent = data.source;
    $("#buildStatus").textContent = "saved to workspace/";
    await loadAgents();
    if (data.agent_id) {
      selectAgent(data.agent_id);
      showTab("inspect");
    }
  } catch (err) {
    $("#buildStatus").textContent = "error";
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
  state.build = defaultBuild();
  state.selectedNode = state.build.methods[0] ? state.build.methods[0].id : null;
  renderTemplates();
  $("#barClass").addEventListener("input", (e) => {
    if (!state.build) return;
    state.build.class_name = e.target.value;
    syncCore();
    liveSrc();
  });
  $("#barRole").addEventListener("input", (e) => {
    if (!state.build) return;
    state.build.role = e.target.value;
    syncCore();
    liveSrc();
  });
  try {
    const health = await jget("/api/health");
    state.health = health;
    const nim = health.nim || {};
    const live = health.has_key && nim.ok;
    $("#statusLine").textContent = live
      ? `NIM live · ${health.nim_model} · ${health.agents} agents`
      : `offline inspect · ${nim.error || "no NVIDIA_API_KEY"}`;
    $("#statusLine").classList.toggle("error", !live);
    $("#liveDot").classList.toggle("on", live);
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
