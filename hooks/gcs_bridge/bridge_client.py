"""HTTP client for the local GCS bridge daemon."""

from __future__ import annotations

import json
import urllib.request
from typing import Any, Callable


class BridgeClient:
    def __init__(
        self,
        dashboard_url: str,
        bridge_token: str = "",
        hook_secret: str = "",
        user_agent: str | Callable[[], str] = "gcs-bridge",
    ) -> None:
        self.dashboard_url = dashboard_url.rstrip("/")
        self.bridge_token = bridge_token
        self.hook_secret = hook_secret
        self.user_agent = user_agent

    def headers(self) -> dict[str, str]:
        user_agent = self.user_agent() if callable(self.user_agent) else self.user_agent
        result = {"Content-Type": "application/json", "User-Agent": user_agent}
        if self.bridge_token:
            result["x-bridge-token"] = self.bridge_token
        if self.hook_secret:
            result["x-hook-secret"] = self.hook_secret
        return result

    def post_json(self, path: str, payload: dict[str, Any], timeout: int = 8) -> tuple[bool, str]:
        try:
            req = urllib.request.Request(
                f"{self.dashboard_url}{path}",
                data=json.dumps(payload).encode("utf-8"),
                headers=self.headers(),
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                return 200 <= resp.status < 300, body
        except Exception as exc:
            return False, str(exc)

    def post_json_data(self, path: str, payload: dict[str, Any], timeout: int = 8) -> tuple[bool, dict[str, Any] | str]:
        ok, body = self.post_json(path, payload, timeout=timeout)
        if not ok:
            return False, body
        try:
            data = json.loads(body)
        except Exception:
            return False, body
        if not isinstance(data, dict):
            return False, body
        return True, data

    def get_json(self, path: str, timeout: int = 8) -> tuple[bool, dict[str, Any] | str]:
        try:
            req = urllib.request.Request(
                f"{self.dashboard_url}{path}",
                headers=self.headers(),
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                if not (200 <= resp.status < 300):
                    return False, body
                data = json.loads(body)
                return (True, data) if isinstance(data, dict) else (False, body)
        except Exception as exc:
            return False, str(exc)

