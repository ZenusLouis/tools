package dev.zenus.gcs.core.bridge;

public enum BridgeActionStatus {
  pending,
  claimed,
  running,
  succeeded,
  failed,
  cancelled,
  expired
}
