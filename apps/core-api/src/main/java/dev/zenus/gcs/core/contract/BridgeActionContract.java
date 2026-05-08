package dev.zenus.gcs.core.contract;

import java.util.List;

public record BridgeActionContract(
    int payloadVersion,
    int resultVersion,
    List<String> actionTypes,
    List<String> lifecycle,
    List<String> lifecycleEndpoints,
    List<String> requiredPayloadFields,
    List<String> resultTelemetryFields) {

  public static BridgeActionContract v1() {
    return new BridgeActionContract(
        1,
        1,
        List.of(
            "run_analysis",
            "run_task",
            "generate_code_index",
            "sync_project_metadata",
            "mcp_design_inspection",
            "mcp_ui_brief",
            "mcp_design_implementation",
            "mcp_visual_review"),
        List.of("pending", "claimed", "running", "succeeded", "failed", "cancelled", "expired"),
        List.of(
            "POST /api/core/bridge/file-actions",
            "POST /api/core/bridge/file-actions/pending",
            "POST /api/core/bridge/file-actions/{id}/claim",
            "POST /api/core/bridge/file-actions/{id}/lease",
            "GET /api/core/bridge/file-actions/{id}/status",
            "POST /api/core/bridge/file-actions/{id}/result",
            "POST /api/core/bridge/file-actions/{id}/cancel"),
        List.of("payloadVersion", "actionType", "projectName", "workspaceId"),
        List.of(
            "providerTokens",
            "codexCredits",
            "normalizedCostUsd",
            "source",
            "tokenMeter",
            "contextReport",
            "skillFeedback"));
  }
}
