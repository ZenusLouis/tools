package dev.zenus.gcs.core.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CoreApiConfig {
  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }
}
