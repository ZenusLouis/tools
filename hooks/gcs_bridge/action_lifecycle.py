"""Bridge file-action lifecycle helpers."""

from __future__ import annotations

from typing import Any

from gcs_bridge.bridge_client import BridgeClient
from gcs_bridge.sanitizer import sanitize_text


class ActionLifecycle:
    def __init__(self, client: BridgeClient) -> None:
        self.client = client

    def post_progress(self, action_id: str, lines: list[str], timeout: int = 4) -> None:
        if not action_id or not lines:
            return
        self.client.post_json(
            f"/api/bridge/file-actions/{action_id}/progress",
            {"lines": [sanitize_text(line) for line in lines]},
            timeout=timeout,
        )

    def refresh_lease(self, action_id: str, claim_token: str | None = None, timeout: int = 4) -> bool:
        if not action_id:
            return False
        payload = {"claimToken": claim_token} if claim_token else {}
        ok, data = self.client.post_json_data(f"/api/bridge/file-actions/{action_id}/lease", payload, timeout=timeout)
        if ok and isinstance(data, dict):
            return not bool(data.get("cancelled"))
        return ok

    def is_cancelled(self, action_id: str, timeout: int = 3) -> bool:
        if not action_id:
            return False
        ok, data = self.client.get_json(f"/api/bridge/file-actions/{action_id}/status", timeout=timeout)
        if not ok or not isinstance(data, dict):
            return False
        return bool(data.get("cancelled") or data.get("status") == "cancelled")

    def status(self, action_id: str, timeout: int = 3) -> tuple[bool, dict[str, Any] | str]:
        if not action_id:
            return False, "missing action id"
        return self.client.get_json(f"/api/bridge/file-actions/{action_id}/status", timeout=timeout)
