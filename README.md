<p align="center">
  <img src="assets/classact.webp" alt="ClassAct — inspect, run, watch, and build NVIDIA Object-Oriented Agents" width="720" />
</p>

<p align="center">
  <a href="https://github.com/cobusgreyling/classact/actions/workflows/ci.yml"><img src="https://github.com/cobusgreyling/classact/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/python-3.12%20%7C%203.13-blue" alt="Python 3.12 or 3.13" />
  <img src="https://img.shields.io/badge/nooa-0.0.9-76B900" alt="NOOA 0.0.9" />
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="Apache 2.0" />
</p>

# ClassAct

**Inspect a Python class. Run one method. Watch the call tree. Generate a new agent.**

A local studio for [NVIDIA Object-Oriented Agents (NOOA)](https://github.com/NVIDIA-NeMo/labs-OO-Agents). The agent *is* the class. `…` is the LLM. No local GPU — open [Nemotron 3.5 Lightning](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b) runs on hosted **NVIDIA NIM**.

ClassAct is the studio. **NOOA is what you ship.**

| I want to… | Do this |
|---|---|
| See an agent as a class | `./run.sh` → Inspect `ClassifierAgent` |
| Call a typed method on NIM | [Get a NIM key](https://build.nvidia.com) → Run `classify` |
| Build my own agent | **+ New agent** → Generate class → file lands in `workspace/` |
| Use it in my app | Copy the class, then `python examples/take_home.py` |

Guide: [`docs/GUIDE.md`](docs/GUIDE.md) (also **Docs** in the studio). Video: [`assets/classact.mp4`](assets/classact.mp4).

## Quick start

**Python 3.12 or 3.13** is required (`nooa` does not support 3.11). Inspect and Build work with no API key. Run needs NIM.

```bash
git clone https://github.com/cobusgreyling/classact.git
cd classact
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env    # optional until you Run — key from https://build.nvidia.com
./run.sh
# → http://127.0.0.1:7877
```

```bash
# NVIDIA_API_KEY=nvapi-…
NOOA_MODEL=nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b
NIM_MODEL_ID=nvidia/nemotron-3.5-lightning-30b-a3b
```

If you use [uv](https://docs.astral.sh/uv/): `uv sync --extra dev && uv run python app.py`.

## Studio

You pick the method in Run — the query does not auto-route.

| | |
|--|--|
| **Inspect** | UML class card · **+ New agent** · workspace **×** / **Delete** |
| **Run** | Prompt console — agent + method; reply stays on the tab |
| **Watch** | Live span tree — methods, generations, LLM calls, CodeAct cells |
| **Build** | Class is a label; Kind / Strategy on each method; generate `workspace/` |

```text
Browser
   │  HTTP + SSE
   ▼
ClassAct  FastAPI  ── inspect / run / watch / build
   │
   ├─ catalog/ + workspace/     Agent subclasses
   ├─ NOOA runtime              class = agent, … = LLM
   └─ LiteLLM ── HTTPS ──► NIM  Nemotron 3.5 Lightning
                                 (GPU stays in NVIDIA’s cloud)
```

## Sample agents

Kind and strategy are **per method**, not per class.

| Agent | Methods | What it shows |
|--|--|--|
| `ClassifierAgent` | `classify` · Agentic · Predict | Typed Pydantic output, no tools |
| `SupportAgent` | `get_order` / `is_refund_eligible` · Python; `triage` · Agentic · CodeAct | Tools on `self`; CodeAct may call them. Catalog orders are demo data. |

**+ New agent** opens Build on a blank `MyAgent`. **Generate class** writes `workspace/` and the agent appears in Inspect. **Open in Build** loads the agent you were inspecting.

## From studio to production

```bash
python examples/take_home.py --dry-run
python examples/take_home.py "Great product, but shipping was slow."
```

```python
agent = ClassifierAgent(llm=llm)
result = await agent.classify(text)
```

Copy the class (Inspect **Source**). Add your HTTP, auth, and database. Run CodeAct inside [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) or a container. Construct a **new** instance per request.

## Tests

```bash
python -m pytest -q
```

## Safety

NOOA can execute model-generated Python (CodeAct). ClassAct defaults new agents to **Predict**. Sample CodeAct tools are in-memory only. Treat OS isolation as the real containment boundary — do not point CodeAct at your home directory.

Never commit `NVIDIA_API_KEY`. `.env` is gitignored.

## License

Apache-2.0. NOOA is NVIDIA-labs research software (Apache-2.0). Nemotron weights follow their own licenses (OpenMDW). This studio is a UI over those projects, not a fork of the runtime.

---

<details>
<summary>Why this name</summary>

**ClassAct** is a class, and an act.

- NOOA agents *are* Python classes.
- Agentic methods are implemented by **CodeAct** (or Predict).
- A “class act” is the standard this studio holds the object to: typed, inspectable, runnable.

</details>

<details>
<summary>GTC Berlin Golden Ticket</summary>

Built for the [NVIDIA GTC Berlin Golden Ticket Developer Contest](https://developer.nvidia.com/gtc-golden-ticket-contest) (open models, 18 Aug – 10 Sep 2026).

Suggested post:

> Inspect, run, watch, and build NVIDIA Object-Oriented Agents — as Python classes — on open **Nemotron 3.5 Lightning** via NIM. No GPU on my desk. Repo: https://github.com/cobusgreyling/classact  #NVIDIAGTC

Tag the judge you heard it from.

</details>
