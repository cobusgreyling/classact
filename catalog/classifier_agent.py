"""Predict-only sample: structured classification, no generated Python."""

from __future__ import annotations

from typing import Literal

from nooa import Agent, strategy
from nooa.strategies import PredictStrategy
from pydantic import BaseModel, Field


class FeedbackAnalysis(BaseModel):
    """Validated ticket the rest of the program can consume."""

    sentiment: Literal["positive", "negative", "neutral", "mixed"] = Field(
        description="Overall tone of the feedback."
    )
    urgency: Literal["low", "medium", "high"] = Field(
        description="How quickly the feedback needs a response."
    )
    topics: list[str] = Field(description="Concrete subjects mentioned in the text.")
    summary: str = Field(description="One-sentence faithful summary.")
    confidence: float = Field(ge=0, le=1, description="Confidence in [0, 1].")


class ClassifierAgent(Agent):
    """You are a precise customer-feedback classifier for a hardware storefront.

    Be faithful to the supplied text. Do not invent product names, order ids,
    or urgency that the message does not support. Prefer mixed sentiment when
    praise and complaints both appear.
    """

    @strategy(PredictStrategy())
    async def classify(self, text: str) -> FeedbackAnalysis:
        """Classify the customer message into a typed FeedbackAnalysis."""
        ...
