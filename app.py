#!/usr/bin/env python3
"""ClassAct — inspect, run, watch, and build NVIDIA Object-Oriented Agents."""

from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from src.builder import generate_source, write_agent
from src.catalog import Catalog
from src.inspect_agent import inspect_record
from src.nim import nim_model_id, nooa_model, nvidia_api_key, ping_nim
from src.runner import RunManager
from src.schemas import BuildSpec, RunRequest
from src.traces import TraceHub, install_tracing

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "7877"))
STATIC = ROOT / "static"
ASSETS = ROOT / "assets"
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()

hub = TraceHub()
catalog = Catalog(ROOT / "catalog", ROOT / "workspace")
runs = RunManager(hub)


def _ensure_static() -> None:
    STATIC.mkdir(parents=True, exist_ok=True)
    for name in ("header.jpg", "classact.mp4", "classact.gif", "classact.webp"):
        src = ASSETS / name
        dst = STATIC / name
        if src.exists() and (
            not dst.exists() or src.stat().st_mtime > dst.stat().st_mtime
        ):
            dst.write_bytes(src.read_bytes())


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _ensure_static()
    catalog.reload()
    hub.attach_loop(asyncio.get_running_loop())
    try:
        install_tracing(hub, ROOT / "traces")
    except Exception as exc:
        print(f"ClassAct: tracing not enabled ({exc})")
    yield


app = FastAPI(
    title="ClassAct",
    version=VERSION,
    lifespan=lifespan,
    docs_url="/api/openapi",
    redoc_url=None,
)


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/docs")
def user_docs() -> FileResponse:
    return FileResponse(STATIC / "docs.html")


@app.get("/api/health")
async def health(ping: bool = Query(False)) -> dict:
    """Studio status. Does not call NIM unless ?ping=1."""
    has_key = bool(nvidia_api_key())
    if ping:
        nim = await ping_nim() if has_key else {
            "ok": False,
            "error": "NVIDIA_API_KEY is not set",
        }
        nim["pinged"] = has_key
    else:
        nim = {
            "ok": has_key,
            "pinged": False,
            "error": None if has_key else "NVIDIA_API_KEY is not set",
        }
    return {
        "ok": True,
        "name": "ClassAct",
        "version": VERSION,
        "has_key": has_key,
        "nooa_model": nooa_model(),
        "nim_model": nim_model_id(),
        "agents": len(catalog.list()),
        "nim": nim,
    }


@app.get("/api/models")
def models() -> dict:
    return {
        "default": nooa_model(),
        "models": [
            {
                "id": "nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b",
                "label": "Nemotron 3.5 Lightning 30B-A3B (open, NIM)",
                "open": True,
            },
            {
                "id": "nvidia_nim/nvidia/nemotron-3-nano-30b-a3b",
                "label": "Nemotron 3 Nano 30B-A3B (open, NIM)",
                "open": True,
            },
            {
                "id": "nvidia_nim/nvidia/nemotron-3-super-120b-a12b",
                "label": "Nemotron 3 Super 120B-A12B (open, NIM)",
                "open": True,
            },
        ],
    }


@app.get("/api/agents")
def list_agents() -> dict:
    catalog.reload()
    return {"agents": [inspect_record(rec) for rec in catalog.list()]}


@app.get("/api/agents/{agent_id}")
def get_agent(agent_id: str) -> dict:
    try:
        rec = catalog.get(agent_id)
    except KeyError as exc:
        raise HTTPException(404, f"unknown agent {agent_id}") from exc
    data = inspect_record(rec)
    data["source"] = rec.source
    return data


@app.delete("/api/agents/{agent_id}")
def delete_agent(agent_id: str) -> dict:
    try:
        rec = catalog.get(agent_id)
    except KeyError as exc:
        raise HTTPException(404, f"unknown agent {agent_id}") from exc
    try:
        path = catalog.delete(agent_id)
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    return {"ok": True, "id": rec.id, "path": str(path)}


@app.get("/api/agents/{agent_id}/source")
def get_source(agent_id: str) -> dict:
    try:
        rec = catalog.get(agent_id)
    except KeyError as exc:
        raise HTTPException(404, f"unknown agent {agent_id}") from exc
    return {"id": rec.id, "path": str(rec.path), "source": rec.source}


@app.post("/api/runs")
async def post_run(req: RunRequest) -> dict:
    try:
        rec = catalog.get(req.agent_id)
    except KeyError as exc:
        raise HTTPException(404, f"unknown agent {req.agent_id}") from exc
    model = req.model or nooa_model()
    run = runs.register(rec, req.method, req.args, model)
    asyncio.create_task(runs._execute(rec, run))
    return {
        "run_id": run.id,
        "status": run.status,
        "agent_id": run.agent_id,
        "method": run.method,
        "model": run.model,
    }


@app.get("/api/runs/{run_id}")
def get_run(run_id: str) -> dict:
    try:
        run = runs.get(run_id)
    except KeyError as exc:
        raise HTTPException(404, f"unknown run {run_id}") from exc
    return {
        "run_id": run.id,
        "status": run.status,
        "agent_id": run.agent_id,
        "method": run.method,
        "model": run.model,
        "args": run.args,
        "result": run.result,
        "error": run.error,
        "started": run.started,
        "finished": run.finished,
        "spans": hub.spans(run.id),
    }


@app.get("/api/runs/{run_id}/events")
async def run_events(run_id: str) -> StreamingResponse:
    queue = hub.subscribe(run_id)

    async def gen():
        try:
            while True:
                event = await queue.get()
                payload = json.dumps(event, default=str)
                yield f"data: {payload}\n\n"
                if event.get("type") == "done":
                    break
        finally:
            hub.unsubscribe(run_id, queue)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/build/preview")
def build_preview(spec: BuildSpec) -> dict:
    try:
        source = generate_source(spec)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"source": source, "class_name": spec.class_name}


@app.post("/api/build")
def build_save(spec: BuildSpec) -> dict:
    try:
        path = write_agent(spec, ROOT / "workspace")
        catalog.reload()
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    rec = next(
        (
            r
            for r in catalog.list()
            if r.class_name == spec.class_name and r.origin == "workspace"
        ),
        None,
    )
    return {
        "ok": True,
        "path": str(path),
        "agent_id": rec.id if rec else None,
        "source": path.read_text(encoding="utf-8"),
    }


app.mount("/static", StaticFiles(directory=STATIC), name="static")


if __name__ == "__main__":
    _ensure_static()
    uvicorn.run("app:app", host=HOST, port=PORT, reload=False)
