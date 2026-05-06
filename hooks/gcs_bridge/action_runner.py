"""Poll and complete dashboard file actions for the local bridge."""

from __future__ import annotations

from typing import Any, Callable

from gcs_bridge.bridge_client import BridgeClient
from gcs_bridge.sanitizer import sanitize_json, sanitize_text


ActionExecutor = Callable[[dict[str, Any]], dict[str, Any]]
IdentityProvider = Callable[[], dict[str, str]]


class FileActionPoller:
    def __init__(
        self,
        client: BridgeClient,
        identity_provider: IdentityProvider,
        executor: ActionExecutor,
    ) -> None:
        self.client = client
        self.identity_provider = identity_provider
        self.executor = executor

    def poll(self, limit: int = 5) -> int:
        device_key = self.identity_provider()["deviceKey"]
        ok, data = self.client.post_json_data(
            "/api/bridge/file-actions/pending",
            {"deviceKey": device_key, "limit": limit},
            timeout=8,
        )
        if not ok:
            print(f"[file-actions] poll failed: {str(data)[:160]}", flush=True)
            return 0

        actions = data.get("actions") if isinstance(data, dict) else []
        if not isinstance(actions, list) or not actions:
            return 0

        completed = 0
        for action in actions:
            if not isinstance(action, dict) or not action.get("id"):
                continue
            action_id = str(action["id"])
            try:
                result = self.executor(action)
                action_status = "failed" if isinstance(result, dict) and int(result.get("exitCode") or 0) != 0 else "succeeded"
                ok, detail = self.client.post_json_data(
                    "/api/bridge/file-actions/result",
                    {"id": action_id, "status": action_status, "deviceKey": device_key, "result": sanitize_json(result)},
                    timeout=8,
                )
                if ok:
                    completed += 1
                    count = result.get("count", 0) if isinstance(result, dict) else 0
                    print(f"[file-actions] completed {action_id}: {count} file(s)", flush=True)
                else:
                    print(f"[file-actions] result failed {action_id}: {str(detail)[:160]}", flush=True)
            except Exception as exc:
                self.client.post_json_data(
                    "/api/bridge/file-actions/result",
                    {"id": action_id, "status": "failed", "deviceKey": device_key, "error": sanitize_text(str(exc))},
                    timeout=8,
                )
                print(f"[file-actions] failed {action_id}: {exc}", flush=True)
        return completed
