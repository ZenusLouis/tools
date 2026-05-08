package dev.zenus.gcs.core.api;

import dev.zenus.gcs.core.contract.BridgeActionContract;
import dev.zenus.gcs.core.contract.RuntimeContract;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/core/contract")
public class RuntimeContractController {
  private final String runtimeMode;

  public RuntimeContractController(@Value("${gcs.runtime.mode:contract-only}") String runtimeMode) {
    this.runtimeMode = runtimeMode;
  }

  @GetMapping
  public RuntimeContract contract() {
    return new RuntimeContract(
        1,
        runtimeMode,
        List.of(
            "bridge-action-lifecycle",
            "run-telemetry",
            "token-normalization",
            "zero-token-router",
            "memory-graph",
            "audit-log"),
        BridgeActionContract.v1());
  }
}
