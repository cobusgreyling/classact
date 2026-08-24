"""CodeAct sample: deterministic Python tools plus one ellipsis method."""

from __future__ import annotations

from typing import Literal

from nooa import Agent
from pydantic import BaseModel, Field


class Ticket(BaseModel):
    kind: Literal["refund", "shipping", "other"]
    priority: Literal["low", "medium", "high"]
    order_id: str
    note: str = Field(description="One sentence the human agent can act on.")


class SupportAgent(Agent):
    """You are a support agent for a hardware storefront.

    Look up live order state with self.get_order and self.is_refund_eligible
    before you decide. Never invent an order. Refunds are only valid when
    is_refund_eligible returns True. Keep the returned Ticket typed and short.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.orders: dict[str, dict] = {
            "ORD-1001": {
                "id": "ORD-1001",
                "item": "Studio headphones",
                "delivered": True,
                "days_since_delivery": 12,
            },
            "ORD-2044": {
                "id": "ORD-2044",
                "item": "DGX Spark",
                "delivered": False,
                "days_since_delivery": 0,
            },
            "ORD-3302": {
                "id": "ORD-3302",
                "item": "DisplayPort cable",
                "delivered": True,
                "days_since_delivery": 45,
            },
        }

    def get_order(self, order_id: str) -> dict:
        """Return the live order record, or an empty dict if unknown."""
        return dict(self.orders.get(order_id, {}))

    def is_refund_eligible(self, order_id: str) -> bool:
        """Refunds are allowed only if delivered within 30 days."""
        order = self.orders.get(order_id)
        if not order:
            return False
        return bool(order["delivered"] and order["days_since_delivery"] <= 30)

    async def triage(self, message: str, order_id: str = "ORD-1001") -> Ticket:
        """Create a typed support ticket for this message and order id."""
        ...
