package dev.zenus.gcs.core.api;

import static org.assertj.core.api.Assertions.assertThat;

import dev.zenus.gcs.core.contract.RuntimeContract;
import org.junit.jupiter.api.Test;

class RuntimeContractControllerTest {
  @Test
  void exposesBridgeActionContractV1() {
    RuntimeContract contract = new RuntimeContractController("contract-only").contract();

    assertThat(contract.contractVersion()).isEqualTo(1);
    assertThat(contract.bridgeAction().payloadVersion()).isEqualTo(1);
    assertThat(contract.bridgeAction().lifecycle()).contains("pending", "running", "succeeded", "expired");
    assertThat(contract.bridgeAction().actionTypes()).contains("run_task", "mcp_visual_review");
  }
}
