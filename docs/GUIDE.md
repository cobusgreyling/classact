# ClassAct user guide

**ClassAct** is a studio for [NVIDIA Object-Oriented Agents (NOOA)](https://github.com/NVIDIA-NeMo/labs-OO-Agents).

An agent is a Python class. Methods are capabilities. A method whose body is `…` is filled in at runtime by an LLM.

Open this guide from the studio **Docs** link, or keep reading here.

| | |
|--|--|
| **Model** | Open [Nemotron 3.5 Lightning](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b) on hosted NVIDIA NIM |
| **GPU** | Not required on your machine — weights stay in NVIDIA’s cloud |
| **Code** | [github.com/cobusgreyling/classact](https://github.com/cobusgreyling/classact) |

---

## Sixty seconds

1. **Inspect** — select `ClassifierAgent`. The UML card shows `… classify` (Predict).
2. Click that method row (or press `R`) and type a review: *Great product, but shipping was slow.*
3. **Run agent** (or **⌘↵**). The reply stays on Run; spans stream on the right.
4. **+ New agent** on Inspect opens **Build** on a blank `MyAgent`. Press `+` to add a method, then **Generate class**.
5. The new file lands in `workspace/` and appears in the Inspect rail.

Inspect and Build work without a key. Run needs `NVIDIA_API_KEY`.

---

## Architecture

```text
Browser  (black / green / white)
   │  HTTP + SSE
   ▼
ClassAct  FastAPI
   ├─ Inspect   catalog/ + workspace/   Agent subclasses
   ├─ Run       prompt → typed method
   ├─ Watch     OpenTelemetry span tree
   ├─ Build     class graph → Python file
   ├─ NOOA      class = agent, … = LLM
   └─ LiteLLM ── HTTPS ──► NIM  Lightning
```

ClassAct does not fork NOOA. It reflects classes, runs them with your NIM client, and writes new modules into `workspace/`.

---

## What NOOA is

NOOA is a **harness**, not a new model. Same ingredients as other agents (LLM, tools, loop, state). The new abstraction is **where they live**: one Python class instead of prompt + tool JSON + graph.

| Usual agent stack | NOOA |
|--|--|
| System prompt | Class / method **docstrings** |
| Tool schemas | **Methods** on `self` |
| Workflow graph | Ordinary **Python** |
| `agent.invoke(text)` | `await agent.triage(message, order_id)` |
| “Always check X” in the prompt | A real method that **must** run |

`…` means “model, implement this method.” Types are the contract. Facts and gates belong in Python so the model cannot skip them.

The LLM’s words can still be **wrong or invented**. Python tool returns are deterministic. Catalog orders (`ORD-1001`, …) are **demo data**, not a live store.

---

## Kind and strategy

These are **per method**, not for the whole class. A class can mix all three.

**Kind** — is this method Python or an LLM?

| Kind | Body | Who runs it |
|--|--|--|
| **Python** | Code you write | Ordinary Python. A **tool**. |
| **Agentic** | `…` | The LLM, using a strategy. |

**Strategy** — how the LLM implements an **agentic** method. Ignored for Python.

| Strategy | What the model does | Tools |
|--|--|--|
| **Predict** | Structured completion | No |
| **CodeAct** | Writes and runs Python | Yes — `self.get_order(...)` |

Example: `get_order` is Python (input is `order_id`). `triage` is Agentic + CodeAct (input is a *message*). `classify` is Agentic + Predict.

---

## Quick start

Python **3.12 or 3.13** is required (`nooa` does not support 3.11). Inspect and Build work with no key.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env    # set NVIDIA_API_KEY from build.nvidia.com
./run.sh
# → http://127.0.0.1:7877
# → http://127.0.0.1:7877/docs
```

```bash
NVIDIA_API_KEY=nvapi-…
NOOA_MODEL=nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b
NIM_MODEL_ID=nvidia/nemotron-3.5-lightning-30b-a3b
NIM_BASE_URL=https://integrate.api.nvidia.com/v1
```

Never commit `.env`.

---

## Inspect

The left rail lists agents from `catalog/` (shipped) and `workspace/` (generated).

**+ New agent** at the bottom of the rail opens Build on a **blank** `MyAgent` — no methods, only the class label. Press `+` on the graph to add a capability.

Workspace agents (generated) show **×** on the rail, and **Delete** next to **Open in Build** when that agent is selected. That removes the Python file. Shipped `catalog/` agents cannot be deleted from the UI.

The stage is a UML-style class card:

| Part | Meaning |
|--|--|
| **Fields** | Public annotated state |
| **Methods** | `…` = agentic (LLM). `def` = ordinary Python |
| **Source** | The file on disk |

Click a method row (`· run`) to jump to Run with that method selected. **Open in Build** copies an *existing* class onto the canvas (not blank).

---

## Run

Run is a prompt console. Submitting does **not** leave this tab.

**You pick the method.** The dropdown is the entry point. The query text does **not** auto-select `get_order` vs `triage`. Whatever is in **Method** is what ClassAct calls:

```python
agent = SupportAgent(llm=llm)
result = await agent.triage(message, order_id)   # because you chose triage
```

If **Method** is `get_order · python`, a sentence in the box is passed as `order_id` — that is the wrong door. Use `triage` for natural language; use `get_order` only with an id like `ORD-1001`.

The agent can still **choose later methods inside that run** if the method you started is **CodeAct**: the model may call `self.get_order` then `self.is_refund_eligible`. Predict does not call tools. There is **no chain to draw** in the GUI — the Build graph is the class (what exists), not the order of execution. Subsequent steps are Python or CodeAct, or `await` in your own app.

1. Pick **agent**, **method**, and **model**. The default method is the first **agentic** one, not a hidden `main`.
2. Type into the large box. That is the method’s main text argument (`text`, `message`, `prompt`, …). Extra arguments (`order_id`, …) sit under the prompt.
3. Use a **Try** chip, or press **⌘↵** / **Ctrl+Enter**.
4. **Reply** shows a readable card. Raw JSON is underneath. **Live trace** streams spans on the right. Changing the method dropdown does not re-run or re-route the last reply.

### What comes back

| Kind | What you get |
|--|--|
| **Python** | Whatever the method returns. Catalog `get_order` is a demo dict. |
| **Predict** | A typed object from the model. Fields can be invented. |
| **CodeAct** | The model writes Python; it may call `self.*`. The *plan* can still be wrong; the tool return is real. |

### What to type

| Agent | Method | Input |
|--|--|--|
| `ClassifierAgent` | `classify` | A customer review. Predict returns a `FeedbackAnalysis`. |
| `SupportAgent` | `triage` | A support message plus `order_id`: `ORD-1001` (refund-eligible), `ORD-2044` (not delivered), `ORD-3302` (too late). CodeAct may call `get_order` / `is_refund_eligible`. |
| `HeadlineAgent` | *(workspace)* | A product blurb if you generated one from Build. |

---

## Watch

Each box is an OpenTelemetry span. Nesting follows the **Python call tree**, not only the LLM transcript:

| Span | Meaning |
|--|--|
| `method.<name>` | Agent method |
| `generation` | Predict or CodeAct loop |
| `litellm.acompletion` | NIM call |
| `code_execution` | A CodeAct Python cell |

Use Watch for retries, generated code, and token counts. The same tree is mirrored on Run while a call is in flight.

---

## Build

A live object graph. The **class in the center is a label**, not an editor.

| Control | What it does |
|--|--|
| **Class name / Role** | Fields *above* the graph. Change `MyAgent` and its docstring here. |
| **Templates** | Headline, Classifier, Support, Blank. |
| **Method nodes** | Orbit the class. The selected node is high-contrast green; others dim. Click to inspect; drag to rearrange. |
| **`+`** | Add a capability. |
| **Inspector** | Kind (Agentic `…` vs Python tool), strategy (Predict vs CodeAct), args, docstring. Python tools get a **body editor** (deterministic code, ~24 lines). Agentic methods stay `…`. |
| **Live Python** | Updates as you type. |
| **Generate class** | Writes `workspace/<name>.py`. The agent appears under Inspect. |

**+ New agent** (Inspect) loads the Blank template: empty `MyAgent`, no methods.

**Open in Build** (Inspect) loads the currently viewed class, including its methods.

Class names must be PascalCase. Method and field names must be valid Python identifiers.

The graph is **not** a flowchart. You do not wire `get_order` → `triage`. You **Run** one method; CodeAct or Python may call others.

---

## From studio to production

ClassAct is a **studio**, not the server. Test here, then copy the **class** and the **same call**:

```bash
python examples/take_home.py --dry-run
python examples/take_home.py "Great product, but shipping was slow."
```

```python
agent = ClassifierAgent(llm=llm)
result = await agent.classify(text)
```

Inspect **Source** is the file to take. Add your HTTP, auth, database, and run CodeAct inside OpenShell or a container. Each Run in the studio (and each request in production) should construct a **new** instance so state does not leak.

---

## Models

The Run dropdown talks to hosted NIM. Defaults:

| LiteLLM id | Role |
|--|--|
| `nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b` | Default — open Lightning |
| `nvidia_nim/nvidia/nemotron-3-nano-30b-a3b` | Smaller open Nano |
| `nvidia_nim/nvidia/nemotron-3-super-120b-a12b` | Larger open Super |

No local GPU. Override with `NOOA_MODEL` / `NIM_MODEL_ID` in `.env`.

---

## Keyboard

| Key | Action |
|--|--|
| `I` | Inspect |
| `R` | Run (focuses the prompt) |
| `W` | Watch |
| `B` | Build |
| `⌘↵` / `Ctrl+Enter` | Submit Run |

Letter shortcuts are ignored while a text field is focused.

---

## Safety

NOOA can execute model-generated Python (CodeAct).

- **+ New agent** is blank. Add Agentic methods as Predict unless you opt into CodeAct.
- Shipped CodeAct tools on `SupportAgent` are in-memory only.
- In-process AST checks are not a sandbox. Run CodeAct in a container, a VM, or [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell).

---

## HTTP surface

| Method | Path | Role |
|--|--|--|
| `GET` | `/` | Studio |
| `GET` | `/docs` | This guide |
| `GET` | `/api/health` | Status (no NIM call). `?ping=1` probes NIM |
| `GET` | `/api/models` | Run dropdown |
| `GET` | `/api/agents` | Inspect payload |
| `DELETE` | `/api/agents/{id}` | Remove a workspace agent file |
| `POST` | `/api/runs` | Start a method call |
| `GET` | `/api/runs/{id}` | Result + spans |
| `GET` | `/api/runs/{id}/events` | SSE span stream |
| `POST` | `/api/build` | Write a workspace agent |
| `POST` | `/api/build/preview` | Generate source without writing |

OpenAPI: `/api/openapi`.

---

## Tests

```bash
python -m pytest -q
```

---

## License and credits

Apache-2.0. NOOA is NVIDIA-labs research software (Apache-2.0). Nemotron licenses are separate (OpenMDW). ClassAct is a UI over those projects, not a fork of the runtime.

Built for the [NVIDIA GTC Berlin Golden Ticket](https://developer.nvidia.com/gtc-golden-ticket-contest) (open models).
