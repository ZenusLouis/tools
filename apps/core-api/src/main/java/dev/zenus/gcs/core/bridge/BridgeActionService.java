package dev.zenus.gcs.core.bridge;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class BridgeActionService {
  private static final Duration DEFAULT_LEASE = Duration.ofMinutes(2);
  private final Map<String, BridgeAction> actions = new ConcurrentHashMap<>();
  private final SecureRandom random = new SecureRandom();
  private final Clock clock;

  public BridgeActionService(Clock clock) {
    this.clock = clock;
  }

  public BridgeAction enqueue(String workspaceId, String type, String deviceId, Map<String, Object> payload) {
    Instant now = Instant.now(clock);
    String id = UUID.randomUUID().toString();
    Map<String, Object> nextPayload = new LinkedHashMap<>(payload == null ? Map.of() : payload);
    nextPayload.putIfAbsent("payloadVersion", 1);
    nextPayload.putIfAbsent("actionType", type);
    BridgeAction action = new BridgeAction(
        id,
        workspaceId,
        type,
        String.valueOf(nextPayload.get("actionType")),
        deviceId,
        BridgeActionStatus.pending,
        1,
        0,
        0,
        null,
        now,
        now,
        null,
        null,
        null,
        null,
        null,
        nextPayload,
        Map.of(),
        null);
    actions.put(id, action);
    return action;
  }

  public Optional<BridgeAction> find(String id) {
    expireStale();
    return Optional.ofNullable(actions.get(id));
  }

  public List<BridgeAction> pending(String workspaceId, String deviceId, int limit) {
    expireStale();
    return actions.values().stream()
        .filter(action -> action.workspaceId().equals(workspaceId))
        .filter(action -> action.status() == BridgeActionStatus.pending)
        .filter(action -> action.deviceId() == null || action.deviceId().equals(deviceId))
        .sorted(Comparator.comparing(BridgeAction::createdAt))
        .limit(Math.max(1, Math.min(limit, 10)))
        .toList();
  }

  public Optional<BridgeAction> claim(String id, String workspaceId, String deviceId) {
    expireStale();
    Instant now = Instant.now(clock);
    Instant leaseExpiresAt = now.plus(DEFAULT_LEASE);
    String claimToken = claimToken();
    return mutate(id, action -> {
      if (!action.workspaceId().equals(workspaceId) || action.status() != BridgeActionStatus.pending) return action;
      if (action.deviceId() != null && !action.deviceId().equals(deviceId)) return action;
      return action.withClaim(deviceId, claimToken, now, leaseExpiresAt);
    }).filter(action -> action.status() == BridgeActionStatus.claimed && claimToken.equals(action.claimToken()));
  }

  public Optional<BridgeAction> lease(String id, String workspaceId, String claimToken) {
    expireStale();
    Instant now = Instant.now(clock);
    Instant leaseExpiresAt = now.plus(DEFAULT_LEASE);
    return mutate(id, action -> {
      if (!action.workspaceId().equals(workspaceId)) return action;
      if (action.cancelRequestedAt() != null || action.status() == BridgeActionStatus.cancelled) {
        return action.withTerminal(BridgeActionStatus.cancelled, action.result(), action.error(), now);
      }
      if (action.claimToken() != null && claimToken != null && !action.claimToken().equals(claimToken)) return action;
      if (action.status() != BridgeActionStatus.claimed && action.status() != BridgeActionStatus.running) return action;
      return action.withLease(now, leaseExpiresAt);
    });
  }

  public Optional<BridgeAction> cancel(String id, String workspaceId) {
    expireStale();
    Instant now = Instant.now(clock);
    return mutate(id, action -> {
      if (!action.workspaceId().equals(workspaceId)) return action;
      if (isTerminal(action.status())) return action;
      if (action.status() == BridgeActionStatus.pending) {
        return action.withCancelRequested(now).withTerminal(BridgeActionStatus.cancelled, action.result(), "Cancelled before claim.", now);
      }
      return action.withCancelRequested(now);
    });
  }

  public Optional<BridgeAction> result(String id, String workspaceId, BridgeActionStatus status, Map<String, Object> result, String error) {
    if (!isTerminal(status)) {
      throw new IllegalArgumentException("Result status must be terminal");
    }
    Instant now = Instant.now(clock);
    Map<String, Object> nextResult = new LinkedHashMap<>(result == null ? Map.of() : result);
    nextResult.put("resultVersion", 1);
    nextResult.put("status", status.name());
    return mutate(id, action -> {
      if (!action.workspaceId().equals(workspaceId)) return action;
      if (action.status() == BridgeActionStatus.cancelled && status != BridgeActionStatus.cancelled) return action;
      return action.withTerminal(status, nextResult, error, now);
    });
  }

  public int expireStale() {
    Instant now = Instant.now(clock);
    int[] count = {0};
    actions.replaceAll((id, action) -> {
      if ((action.status() == BridgeActionStatus.claimed || action.status() == BridgeActionStatus.running)
          && action.leaseExpiresAt() != null
          && action.leaseExpiresAt().isBefore(now)) {
        count[0]++;
        return action.withTerminal(
            BridgeActionStatus.expired,
            Map.of("resultVersion", 1, "status", "expired", "errorCode", "LEASE_EXPIRED"),
            "Bridge action expired because the local bridge stopped refreshing its lease.",
            now);
      }
      return action;
    });
    return count[0];
  }

  private Optional<BridgeAction> mutate(String id, java.util.function.Function<BridgeAction, BridgeAction> mutator) {
    BridgeAction existing = actions.get(id);
    if (existing == null) return Optional.empty();
    BridgeAction next = mutator.apply(existing);
    actions.put(id, next);
    return Optional.of(next);
  }

  private boolean isTerminal(BridgeActionStatus status) {
    return status == BridgeActionStatus.succeeded
        || status == BridgeActionStatus.failed
        || status == BridgeActionStatus.cancelled
        || status == BridgeActionStatus.expired;
  }

  private String claimToken() {
    byte[] bytes = new byte[18];
    random.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
