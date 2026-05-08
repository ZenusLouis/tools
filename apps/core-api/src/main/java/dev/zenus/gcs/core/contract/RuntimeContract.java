package dev.zenus.gcs.core.contract;

import java.util.List;

public record RuntimeContract(
    int contractVersion,
    String runtimeMode,
    List<String> stagedCapabilities,
    BridgeActionContract bridgeAction) {}
