package dev.zenus.gcs.core.api;

import java.time.OffsetDateTime;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/core")
public class HealthController {
  private final String runtimeMode;

  public HealthController(@Value("${gcs.runtime.mode:contract-only}") String runtimeMode) {
    this.runtimeMode = runtimeMode;
  }

  @GetMapping("/health")
  public Map<String, Object> health() {
    return Map.of(
        "ok", true,
        "service", "gcs-core-api",
        "runtimeMode", runtimeMode,
        "time", OffsetDateTime.now().toString());
  }
}
