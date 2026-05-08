package dev.zenus.gcs.core.bridge;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public record BridgeAction(
    String id,
    String workspaceId,
    String type,
    String actionType,
    String deviceId,
    BridgeActionStatus status,
    int payloadVersion,
    int resultVersion,
    int attempt,
    String claimToken,
    Instant createdAt,
    Instant updatedAt,
    Instant claimedAt,
    Instant heartbeatAt,
    Instant leaseExpiresAt,
    Instant cancelRequestedAt,
    Instant completedAt,
    Map<String, Object> payload,
    Map<String, Object> result,
    String error) {

  public BridgeAction withStatus(BridgeActionStatus nextStatus, Instant now) {
    return new BridgeAction(
        id,
        workspaceId,
        type,
        actionType,
        deviceId,
        nextStatus,
        payloadVersion,
        resultVersion,
        attempt,
        claimToken,
        createdAt,
        now,
        claimedAt,
        heartbeatAt,
        leaseExpiresAt,
        cancelRequestedAt,
        completedAt,
        payload,
        result,
        error);
  }

  public BridgeAction withClaim(String nextDeviceId, String nextClaimToken, Instant now, Instant nextLeaseExpiresAt) {
    return new BridgeAction(
        id,
        workspaceId,
        type,
        actionType,
        nextDeviceId,
        BridgeActionStatus.claimed,
        payloadVersion,
        resultVersion,
        attempt + 1,
        nextClaimToken,
        createdAt,
        now,
        now,
        now,
        nextLeaseExpiresAt,
        cancelRequestedAt,
        completedAt,
        payload,
        result,
        error);
  }

  public BridgeAction withLease(Instant now, Instant nextLeaseExpiresAt) {
    return new BridgeAction(
        id,
        workspaceId,
        type,
        actionType,
        deviceId,
        BridgeActionStatus.running,
        payloadVersion,
        resultVersion,
        attempt,
        claimToken,
        createdAt,
        now,
        claimedAt,
        now,
        nextLeaseExpiresAt,
        cancelRequestedAt,
        completedAt,
        payload,
        result,
        error);
  }

  public BridgeAction withCancelRequested(Instant now) {
    return new BridgeAction(
        id,
        workspaceId,
        type,
        actionType,
        deviceId,
        status,
        payloadVersion,
        resultVersion,
        attempt,
        claimToken,
        createdAt,
        now,
        claimedAt,
        heartbeatAt,
        leaseExpiresAt,
        now,
        completedAt,
        payload,
        result,
        error);
  }

  public BridgeAction withTerminal(BridgeActionStatus nextStatus, Map<String, Object> nextResult, String nextError, Instant now) {
    return new BridgeAction(
        id,
        workspaceId,
        type,
        actionType,
        deviceId,
        nextStatus,
        payloadVersion,
        1,
        attempt,
        claimToken,
        createdAt,
        now,
        claimedAt,
        now,
        null,
        cancelRequestedAt,
        now,
        new LinkedHashMap<>(payload),
        new LinkedHashMap<>(nextResult),
        nextError);
  }
}
