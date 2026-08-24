"""HTTP / builder contracts."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class ArgSpec(BaseModel):
    name: str
    type: Literal["str", "int", "float", "bool"] = "str"

    @field_validator("name")
    @classmethod
    def _ident(cls, v: str) -> str:
        if not v.isidentifier() or v == "self":
            raise ValueError(f"invalid argument name: {v}")
        return v


class FieldSpec(BaseModel):
    name: str
    type: Literal["str", "int", "float", "bool"] = "str"

    @field_validator("name")
    @classmethod
    def _ident(cls, v: str) -> str:
        if not v.isidentifier() or v.startswith("_"):
            raise ValueError(f"invalid field name: {v}")
        return v


class MethodSpec(BaseModel):
    name: str
    doc: str = "Do the task faithfully and concisely."
    args: list[ArgSpec] = Field(default_factory=lambda: [ArgSpec(name="text", type="str")])
    returns: Literal["str", "int", "float", "bool"] = "str"
    kind: Literal["agentic", "python"] = "agentic"
    strategy: Literal["Predict", "CodeAct"] = "Predict"

    @field_validator("name")
    @classmethod
    def _ident(cls, v: str) -> str:
        if not v.isidentifier() or v.startswith("_"):
            raise ValueError(f"invalid method name: {v}")
        return v


class BuildSpec(BaseModel):
    class_name: str
    role: str = "You are a focused specialist agent."
    fields: list[FieldSpec] = Field(default_factory=list)
    methods: list[MethodSpec] = Field(default_factory=list)

    @field_validator("class_name")
    @classmethod
    def _class(cls, v: str) -> str:
        if not v.isidentifier() or not v[:1].isupper():
            raise ValueError("class_name must be a PascalCase identifier")
        return v


class RunRequest(BaseModel):
    agent_id: str
    method: str
    args: dict[str, Any] = Field(default_factory=dict)
    model: str | None = None
