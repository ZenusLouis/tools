package dev.zenus.gcs.core.api;

import dev.zenus.gcs.core.bridge.BridgeAction;
import dev.zenus.gcs.core.bridge.BridgeActionService;
import dev.zenus.gcs.core.bridge.BridgeActionStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/core/bridge/file-actions")
public class BridgeActionController {
  private final BridgeActionService service;

  public BridgeActionController(BridgeActionService service) {
    this.service = service;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BridgeActionResponse enqueue(@Valid @RequestBody EnqueueRequest request) {
    return BridgeActionResponse.from(service.enqueue(
        request.workspaceId(),
        request.type(),
        request.deviceId(),
        request.payload() == null ? Map.of() : request.payload()));
  }

  @PostMapping("/pending")
  public PendingResponse pending(@Valid @RequestBody PendingRequest request) {
    List<BridgeActionResponse> actions = service.pending(
            request.workspaceId(),
            request.deviceId(),
            request.limit() == null ? 5 : request.limit())
        .stream()
        .map(BridgeActionResponse::from)
        .toList();
    return new PendingResponse(actions);
  }

  @PostMapping("/{id}/claim")
  public ClaimResponse claim(@PathVariable String id, @Valid @RequestBody ClaimRequest request) {
    BridgeAction action = service.claim(id, request.workspaceId(), request.deviceId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Action is not claimable"));
    return new ClaimResponse(true, action.claimToken(), action.leaseExpiresAt(), BridgeActionResponse.from(action));
  }

  @PostMapping("/{id}/lease")
  public LeaseResponse lease(@PathVariable String id, @Valid @RequestBody LeaseRequest request) {
    BridgeAction action = service.lease(id, request.workspaceId(), request.claimToken())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Action not found"));
    return new LeaseResponse(
        true,
        action.status().name(),
        action.status() == BridgeActionStatus.cancelled,
        action.leaseExpiresAt(),
        BridgeActionResponse.from(action));
  }

  @GetMapping("/{id}/status")
  public BridgeActionResponse status(@PathVariable String id) {
    return service.find(id)
        .map(BridgeActionResponse::from)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Action not found"));
  }

  @PostMapping("/{id}/cancel")
  public BridgeActionResponse cancel(@PathVariable String id, @Valid @RequestBody WorkspaceRequest request) {
    return service.cancel(id, request.workspaceId())
        .map(BridgeActionResponse::from)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Action not found"));
  }

  @PostMapping("/{id}/result")
  public BridgeActionResponse result(@PathVariable String id, @Valid @RequestBody ResultRequest request) {
    return service.result(
            id,
            request.workspaceId(),
            request.status(),
            request.result() == null ? Map.of() : request.result(),
            request.error())
        .map(BridgeActionResponse::from)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Action not found"));
  }

  public record EnqueueRequest(
      @NotBlank String workspaceId,
      @NotBlank String type,
      String deviceId,
      Map<String, Object> payload) {}

  public record PendingRequest(
      @NotBlank String workspaceId,
      String deviceId,
      @Min(1) @Max(10) Integer limit) {}

  public record ClaimRequest(@NotBlank String workspaceId, String deviceId) {}

  public record LeaseRequest(@NotBlank String workspaceId, String claimToken) {}

  public record WorkspaceRequest(@NotBlank String workspaceId) {}

  public record ResultRequest(
      @NotBlank String workspaceId,
      @NotNull
      BridgeActionStatus status,
      Map<String, Object> result,
      String error) {}

  public record PendingResponse(List<BridgeActionResponse> actions) {}

  public record ClaimResponse(boolean ok, String claimToken, Instant leaseExpiresAt, BridgeActionResponse action) {}

  public record LeaseResponse(boolean ok, String status, boolean cancelled, Instant leaseExpiresAt, BridgeActionResponse action) {}

  public record BridgeActionResponse(
      String id,
      String workspaceId,
      String type,
      String actionType,
      String deviceId,
      String status,
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
    public static BridgeActionResponse from(BridgeAction action) {
      return new BridgeActionResponse(
          action.id(),
          action.workspaceId(),
          action.type(),
          action.actionType(),
          action.deviceId(),
          action.status().name(),
          action.payloadVersion(),
          action.resultVersion(),
          action.attempt(),
          action.claimToken(),
          action.createdAt(),
          action.updatedAt(),
          action.claimedAt(),
          action.heartbeatAt(),
          action.leaseExpiresAt(),
          action.cancelRequestedAt(),
          action.completedAt(),
          action.payload(),
          action.result(),
          action.error());
    }
  }
}
