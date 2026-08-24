<p align="center">
  <img src="assets/header.jpg" alt="ClassAct — inspect, run, watch, and build NVIDIA Object-Oriented Agents" width="100%" />
</p>

# ClassAct

**A studio for [NVIDIA Object-Oriented Agents (NOOA)](https://github.com/NVIDIA-NeMo/labs-OO-Agents).**

Inspect a Python class. Run a method. Watch the call tree. Build a new agent.

**Docs:** studio **Docs** link → [`/docs`](http://127.0.0.1:7877/docs) · markdown [`docs/GUIDE.md`](docs/GUIDE.md)

The model is **open**: [Nemotron 3.5 Lightning](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b) on hosted **NVIDIA NIM**. No local GPU is required.

| | |
|--|--|
| **Inspect** | UML class card · **+ New agent** (blank Build) · Open in Build |
| **Run** | Prompt console — type a message, reply stays on the tab |
| **Watch** | Live span tree — methods, generations, LLM calls, CodeAct cells |
| **Build** | Class is a label; selected method is high-contrast; generate `workspace/` |

```text
Browser  (black / green / white)
   │  HTTP + SSE
   ▼
ClassAct  FastAPI  ── inspect / run / watch / build
   │
   ├─ catalog/ + workspace/     Agent subclasses
   ├─ NOOA runtime              class = agent, … = LLM
   └─ LiteLLM ── HTTPS ──► NIM  Nemotron 3.5 Lightning
                                 (GPU stays in NVIDIA’s cloud)
```

## Why this name

**ClassAct** is a class, and an act.

- NOOA agents *are* Python classes.
- Agentic methods are implemented by **CodeAct** (or Predict).
- A “class act” is the standard this studio holds the object to: typed, inspectable, runnable.

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set NVIDIA_API_KEY from build.nvidia.com
./run.sh
# → http://127.0.0.1:7877
```

Inspect and Build work without a key. Run and Watch need NIM.

```bash
# NVIDIA_API_KEY=nvapi-…
NOOA_MODEL=nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b
NIM_MODEL_ID=nvidia/nemotron-3.5-lightning-30b-a3b
```

## Sample agents

| Agent | Strategy | What it shows |
|--|--|--|
| `ClassifierAgent` | Predict | Structured Pydantic output, no generated code |
| `SupportAgent` | CodeAct + Python tools | `get_order` / `is_refund_eligible` as live methods, `triage(...)` is `…` |

**+ New agent** (Inspect rail) opens Build on a blank `MyAgent`. The class in the center is a label — name and role sit above the graph. Click a method node to select it (high-contrast); `+` adds a capability. **Generate class** writes `workspace/` and the agent appears in Inspect. **Open in Build** loads the agent you were inspecting, not a blank.

Full walkthrough: [`docs/GUIDE.md`](docs/GUIDE.md).

## Safety

NOOA can execute model-generated Python (CodeAct). ClassAct defaults new agents to **Predict**. Sample CodeAct tools are in-memory only. Treat OS isolation ([NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell), a container, or a VM) as the real containment boundary — do not point CodeAct at your home directory.

Never commit `NVIDIA_API_KEY`. `.env` is gitignored.

## Tests

```bash
python -m pytest -q
```

## GTC Berlin Golden Ticket

Built for the [NVIDIA GTC Berlin Golden Ticket Developer Contest](https://developer.nvidia.com/gtc-golden-ticket-contest) (open models, 18 Aug – 10 Sep 2026).

Suggested post:

> Inspect, run, watch, and build NVIDIA Object-Oriented Agents — as Python classes — on open **Nemotron 3.5 Lightning** via NIM. No GPU on my desk. Repo: (this URL)  #NVIDIAGTC

Tag the judge you heard it from.

## License

Apache-2.0. NOOA is NVIDIA-labs research software (Apache-2.0). Nemotron weights follow their own licenses (OpenMDW). This studio is a UI over those projects, not a fork of the runtime.
