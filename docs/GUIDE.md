# ClassAct user guide

**ClassAct** is a studio for [NVIDIA Object-Oriented Agents (NOOA)](https://github.com/NVIDIA-NeMo/labs-OO-Agents). An agent is a Python class. Methods are capabilities. A method whose body is `…` is filled in at runtime by an LLM.

This guide matches the studio at `http://127.0.0.1:7877`. In the UI, open **Docs**.

| | |
|--|--|
| **Model** | Open [Nemotron 3.5 Lightning](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b) on hosted NVIDIA NIM |
| **GPU** | Not required on your machine |
| **Code** | [github.com/cobusgreyling/classact](https://github.com/cobusgreyling/classact) |

---

## Architecture

```text
Browser  (black / green / white)
   │  HTTP + SSE
   ▼
ClassAct  FastAPI
   ├─ Inspect   catalog/ + workspace/  Agent subclasses
   ├─ Run       await a typed method
   ├─ Watch     OpenTelemetry span tree
   ├─ Build     class graph → Python file
   ├─ NOOA      class = agent, … = LLM
   └─ LiteLLM ── HTTPS ──► NIM  Lightning
                              (weights stay in NVIDIA’s cloud)
```

ClassAct does not fork NOOA. It reflects classes, instantiates them with your NIM client, and writes new modules into `workspace/`.

---

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # set NVIDIA_API_KEY from build.nvidia.com
./run.sh
# → http://127.0.0.1:7877
```

| Without a key | With `NVIDIA_API_KEY` |
|--|--|
| Inspect and Build | Run and Watch against NIM |

```bash
NVIDIA_API_KEY=nvapi-…
NOOA_MODEL=nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b
NIM_MODEL_ID=nvidia/nemotron-3.5-lightning-30b-a3b
NIM_BASE_URL=https://integrate.api.nvidia.com/v1
```

Never commit `.env`.

---

## Inspect

The left rail lists agents from `catalog/` (shipped) and `workspace/` (you generated).

The diagram is a UML-style class card:

- **Fields** — public annotated state
- **Methods** — `…` means agentic (LLM); `def` means ordinary Python
- **Source** — the file on disk

Click a method row (`· run`) to jump to Run with that method selected. **Open in Build** loads the class onto the Build canvas.

---

## Run

Run is a prompt console, not a buried form.

1. Pick **agent**, **method**, and **model**. Agentic methods are selected by default.
2. Type into the large message box. That maps to the method’s main text argument (`text`, `message`, `prompt`, …).
3. Fill extra arguments (for example `order_id`) under the prompt.
4. Click **Try** chips for examples, or press **⌘↵** / **Ctrl+Enter**.
5. The **Reply** panel stays on this tab. Structured objects (sentiment, ticket fields) render as cards; JSON is underneath. Spans stream in **Live trace**.

Watch is still available for a larger tree. Run no longer navigates away when you submit.

### Sample agents

| Agent | Method | What to type |
|--|--|--|
| `ClassifierAgent` | `classify` | A customer review. Predict returns a `FeedbackAnalysis` object. |
| `SupportAgent` | `triage` | A support message plus `order_id` (`ORD-1001`, `ORD-2044`, `ORD-3302`). CodeAct may call `get_order` / `is_refund_eligible`. |

---

## Watch

Each box is an OpenTelemetry span. Nesting follows the **Python call tree**:

- `method.<name>` — agent method
- `generation` — Predict or CodeAct loop
- `litellm.acompletion` — NIM call
- `code_execution` — a CodeAct Python cell

Use Watch when you care about retries, generated code, and token counts. The same tree is mirrored under Run while a call is in flight.

---

## Build

Build is a live object graph.

- The **class** in the center is a label. Name and role are the fields above the graph — the class node is not selected or edited.
- **Methods orbit** the class. The selected method is high-contrast (green on black, others dim). Click to inspect; drag to rearrange.
- **`+`** adds a capability.
- Kind: **Agentic (`…`)** vs **Python tool** (deterministic `return`).
- Strategy (agentic only): **Predict** (typed, no code exec) vs **CodeAct** (model writes Python).
- **Live Python** at the bottom updates as you type.
- Templates: Headline, Classifier, Support, Blank.
- **Generate class** writes `workspace/<name>.py` and the agent appears under Inspect.

Class names must be PascalCase identifiers. Method and field names must be valid Python identifiers.

---

## Keyboard

| Key | Tab |
|--|--|
| `I` | Inspect |
| `R` | Run (focuses the prompt) |
| `W` | Watch |
| `B` | Build |

Ignored while a text field is focused, except **⌘↵** / **Ctrl+Enter** on Run, which submits.

---

## Safety

NOOA can execute model-generated Python (CodeAct).

- New Build agents default to **Predict**.
- Shipped CodeAct tools (`SupportAgent`) are in-memory only.
- In-process AST checks are not a sandbox. Run CodeAct inside a container, VM, or [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell).

---

## HTTP surface

| Method | Path | Role |
|--|--|--|
| `GET` | `/` | Studio |
| `GET` | `/docs` | This guide |
| `GET` | `/api/health` | NIM ping + agent count |
| `GET` | `/api/agents` | Inspect payload |
| `POST` | `/api/runs` | Start a method call |
| `GET` | `/api/runs/{id}` | Result + spans |
| `GET` | `/api/runs/{id}/events` | SSE span stream |
| `POST` | `/api/build` | Write a workspace agent |
| `POST` | `/api/build/preview` | Generate source without writing |

OpenAPI for those routes: `/api/openapi`.

---

## Tests

```bash
python -m pytest -q
```

---

## License and credits

Apache-2.0. NOOA is NVIDIA-labs research software (Apache-2.0). Nemotron licenses are separate (OpenMDW). ClassAct is a UI over those projects, not a fork of the runtime.

Built for the [NVIDIA GTC Berlin Golden Ticket](https://developer.nvidia.com/gtc-golden-ticket-contest) (open models).
