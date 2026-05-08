import os, sys
from pathlib import Path

# Add d:\GlobalClaudeSkills\hooks to sys.path
sys.path.append(r"d:\GlobalClaudeSkills\hooks")

from gcs_env import ROOT, bridge_user_agent, load_dashboard_env, local_device_identity
from gcs_bridge.bridge_client import BridgeClient
from gcs_bridge.heartbeat import send_heartbeat
from gcs_bridge.local_paths import collect_project_paths as collect_local_project_paths

load_dashboard_env()

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://gcs-dashboard.zenus.dev").rstrip("/")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
HOOK_SECRET = os.environ.get("HOOK_SECRET", "")
CLIENT = BridgeClient(DASHBOARD_URL, BRIDGE_TOKEN, HOOK_SECRET, bridge_user_agent)

LOCAL_PROJECT_PATHS = Path(r"d:\GlobalClaudeSkills\hooks\.gcs_project_paths.json")
PROJECTS_DIR = Path(r"d:\GlobalClaudeSkills\projects")

def collect_project_paths():
    return collect_local_project_paths(PROJECTS_DIR, LOCAL_PROJECT_PATHS)

print("Sending heartbeat to verify Gemini availability...")
ok = send_heartbeat(
    CLIENT,
    BRIDGE_TOKEN,
    HOOK_SECRET,
    local_device_identity,
    collect_project_paths,
    verbose=True
)

if ok:
    print("Heartbeat sent successfully!")
else:
    print("Heartbeat failed.")
