import "server-only";
import { BRIDGE_PAYLOAD_VERSION, BRIDGE_RESULT_VERSION } from "@/lib/bridge-actions";

export type CoreApiRuntimeStatus = {
  enabled: boolean;
  url: string | null;
  reachable: boolean;
  contractVersion: number | null;
  runtimeMode: string | null;
  error: string | null;
};

export type CoreApiSmokeStep = {
  name: string;
  ok: boolean;
  status?: string | null;
  detail?: string | null;
};

export type CoreApiSmokeResult = {
  ok: boolean;
  enabled: boolean;
  url: string | null;
  actionId: string | null;
  steps: CoreApiSmokeStep[];
  error: string | null;
};

export type CoreApiContractCompare = {
  ok: boolean;
  enabled: boolean;
  url: string | null;
  local: CoreApiBridgeContract;
  remote: CoreApiBridgeContract | null;
  mismatches: string[];
  error: string | null;
};

type CoreApiBridgeContract = {
  payloadVersion: number;
  resultVersion: number;
  actionTypes: string[];
  lifecycle: string[];
  lifecycleEndpoints: string[];
  requiredPayloadFields: string[];
  resultTelemetryFields: string[];
};

const LOCAL_BRIDGE_CONTRACT: CoreApiBridgeContract = {
  payloadVersion: BRIDGE_PAYLOAD_VERSION,
  resultVersion: BRIDGE_RESULT_VERSION,
  actionTypes: [
    "run_analysis",
    "run_task",
    "generate_code_index",
    "sync_project_metadata",
    "mcp_design_inspection",
    "mcp_ui_brief",
    "mcp_design_implementation",
    "mcp_visual_review",
  ],
  lifecycle: ["pending", "claimed", "running", "succeeded", "failed", "cancelled", "expired"],
  lifecycleEndpoints: [
    "POST /api/core/bridge/file-actions",
    "POST /api/core/bridge/file-actions/pending",
    "POST /api/core/bridge/file-actions/{id}/claim",
    "POST /api/core/bridge/file-actions/{id}/lease",
    "GET /api/core/bridge/file-actions/{id}/status",
    "POST /api/core/bridge/file-actions/{id}/result",
    "POST /api/core/bridge/file-actions/{id}/cancel",
  ],
  requiredPayloadFields: ["payloadVersion", "actionType", "projectName", "workspaceId"],
  resultTelemetryFields: [
    "providerTokens",
    "codexCredits",
    "normalizedCostUsd",
    "source",
    "tokenMeter",
    "contextReport",
    "skillFeedback",
  ],
};

export function coreApiConfig() {
  const enabled = process.env.GCS_CORE_API_ENABLED === "true";
  const url = process.env.GCS_CORE_API_URL?.replace(/\/$/, "") || null;
  return { enabled, url };
}

export async function compareCoreApiContract(): Promise<CoreApiContractCompare> {
  const config = coreApiConfig();
  if (!config.enabled || !config.url) {
    return {
      ok: false,
      enabled: config.enabled,
      url: config.url,
      local: LOCAL_BRIDGE_CONTRACT,
      remote: null,
      mismatches: [config.enabled ? "GCS_CORE_API_URL is not configured." : "GCS_CORE_API_ENABLED is false."],
      error: config.enabled ? "GCS_CORE_API_URL is not configured." : "GCS_CORE_API_ENABLED is false.",
    };
  }

  try {
    const body = await coreGet(config.url, "/api/core/contract");
    const remote = bridgeContractFromRemote(recordField(body, "bridgeAction"));
    const mismatches = compareBridgeContracts(LOCAL_BRIDGE_CONTRACT, remote);
    return {
      ok: mismatches.length === 0,
      enabled: true,
      url: config.url,
      local: LOCAL_BRIDGE_CONTRACT,
      remote,
      mismatches,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      enabled: true,
      url: config.url,
      local: LOCAL_BRIDGE_CONTRACT,
      remote: null,
      mismatches: ["Core API contract endpoint could not be read."],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getCoreApiRuntimeStatus(): Promise<CoreApiRuntimeStatus> {
  const config = coreApiConfig();
  if (!config.enabled || !config.url) {
    return {
      enabled: config.enabled,
      url: config.url,
      reachable: false,
      contractVersion: null,
      runtimeMode: null,
      error: config.enabled ? "GCS_CORE_API_URL is not configured." : null,
    };
  }

  try {
    const response = await fetch(`${config.url}/api/core/contract`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    const body = await response.json().catch(() => ({})) as { contractVersion?: unknown; runtimeMode?: unknown };
    if (!response.ok) throw new Error(`Core API returned HTTP ${response.status}`);
    return {
      enabled: true,
      url: config.url,
      reachable: true,
      contractVersion: typeof body.contractVersion === "number" ? body.contractVersion : null,
      runtimeMode: typeof body.runtimeMode === "string" ? body.runtimeMode : null,
      error: null,
    };
  } catch (error) {
    return {
      enabled: true,
      url: config.url,
      reachable: false,
      contractVersion: null,
      runtimeMode: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runCoreApiLifecycleSmoke(): Promise<CoreApiSmokeResult> {
  const config = coreApiConfig();
  const steps: CoreApiSmokeStep[] = [];
  if (!config.enabled || !config.url) {
    return {
      ok: false,
      enabled: config.enabled,
      url: config.url,
      actionId: null,
      steps,
      error: config.enabled ? "GCS_CORE_API_URL is not configured." : "GCS_CORE_API_ENABLED is false.",
    };
  }

  try {
    const workspaceId = `smoke-${Date.now()}`;
    const deviceId = "dashboard-smoke";
    const enqueue = await corePost(config.url, "/api/core/bridge/file-actions", {
      workspaceId,
      type: "sync_project_metadata",
      deviceId,
      payload: {
        projectName: "dashboard-smoke",
        source: "dashboard-core-runtime-smoke",
      },
    });
    const actionId = typeof enqueue.id === "string" ? enqueue.id : null;
    steps.push({ name: "enqueue", ok: !!actionId, status: stringField(enqueue.status), detail: actionId });
    if (!actionId) throw new Error("Core API did not return an action id.");

    const claim = await corePost(config.url, `/api/core/bridge/file-actions/${actionId}/claim`, { workspaceId, deviceId });
    const claimToken = typeof claim.claimToken === "string" ? claim.claimToken : null;
    steps.push({ name: "claim", ok: !!claimToken, status: stringField(recordField(claim, "action").status), detail: claimToken ? "claim token issued" : "missing claim token" });
    if (!claimToken) throw new Error("Core API did not return a claim token.");

    const lease = await corePost(config.url, `/api/core/bridge/file-actions/${actionId}/lease`, { workspaceId, claimToken });
    steps.push({ name: "lease", ok: stringField(lease.status) === "running", status: stringField(lease.status), detail: "lease refreshed" });

    const result = await corePost(config.url, `/api/core/bridge/file-actions/${actionId}/result`, {
      workspaceId,
      status: "succeeded",
      result: {
        source: "dashboard-core-runtime-smoke",
        actualTokens: 0,
      },
    });
    steps.push({ name: "result", ok: stringField(result.status) === "succeeded", status: stringField(result.status), detail: "terminal result accepted" });

    const status = await coreGet(config.url, `/api/core/bridge/file-actions/${actionId}/status`);
    const finalStatus = stringField(status.status);
    steps.push({ name: "status", ok: finalStatus === "succeeded", status: finalStatus, detail: "final status readback" });

    return {
      ok: steps.every((step) => step.ok),
      enabled: true,
      url: config.url,
      actionId,
      steps,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      enabled: true,
      url: config.url,
      actionId: steps[0]?.detail ?? null,
      steps,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function corePost(baseUrl: string, path: string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Core API ${path} returned HTTP ${response.status}`);
  return payload;
}

async function coreGet(baseUrl: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Core API ${path} returned HTTP ${response.status}`);
  return payload;
}

function recordField(record: Record<string, unknown>, field: string): Record<string, unknown> {
  const value = record[field];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : null;
}

function bridgeContractFromRemote(remote: Record<string, unknown>): CoreApiBridgeContract {
  return {
    payloadVersion: numberField(remote.payloadVersion),
    resultVersion: numberField(remote.resultVersion),
    actionTypes: stringArray(remote.actionTypes),
    lifecycle: stringArray(remote.lifecycle),
    lifecycleEndpoints: stringArray(remote.lifecycleEndpoints),
    requiredPayloadFields: stringArray(remote.requiredPayloadFields),
    resultTelemetryFields: stringArray(remote.resultTelemetryFields),
  };
}

function compareBridgeContracts(local: CoreApiBridgeContract, remote: CoreApiBridgeContract) {
  const mismatches: string[] = [];
  if (local.payloadVersion !== remote.payloadVersion) {
    mismatches.push(`payloadVersion mismatch: local=${local.payloadVersion}, core=${remote.payloadVersion}`);
  }
  if (local.resultVersion !== remote.resultVersion) {
    mismatches.push(`resultVersion mismatch: local=${local.resultVersion}, core=${remote.resultVersion}`);
  }
  compareSet("actionTypes", local.actionTypes, remote.actionTypes, mismatches);
  compareSet("lifecycle", local.lifecycle, remote.lifecycle, mismatches);
  compareSet("lifecycleEndpoints", local.lifecycleEndpoints, remote.lifecycleEndpoints, mismatches);
  compareSet("requiredPayloadFields", local.requiredPayloadFields, remote.requiredPayloadFields, mismatches);
  compareSet("resultTelemetryFields", local.resultTelemetryFields, remote.resultTelemetryFields, mismatches);
  return mismatches;
}

function compareSet(label: string, local: string[], remote: string[], mismatches: string[]) {
  const missing = local.filter((item) => !remote.includes(item));
  const extra = remote.filter((item) => !local.includes(item));
  if (missing.length > 0) mismatches.push(`${label} missing in core: ${missing.join(", ")}`);
  if (extra.length > 0) mismatches.push(`${label} extra in core: ${extra.join(", ")}`);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberField(value: unknown) {
  return typeof value === "number" ? value : -1;
}
