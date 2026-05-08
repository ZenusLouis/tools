package dev.zenus.gcs.core.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class BridgeActionControllerTest {
  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void supportsClaimLeaseAndResultLifecycle() throws Exception {
    JsonNode enqueued = postJson("/api/core/bridge/file-actions", """
        {
          "workspaceId": "ws-test",
          "type": "run_task",
          "deviceId": "device-1",
          "payload": { "projectName": "omnibooking", "taskId": "T1" }
        }
        """);
    String id = enqueued.get("id").asText();

    mvc.perform(post("/api/core/bridge/file-actions/pending")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "workspaceId": "ws-test", "deviceId": "device-1", "limit": 5 }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.actions[0].id").value(id))
        .andExpect(jsonPath("$.actions[0].status").value("pending"));

    JsonNode claimed = postJson("/api/core/bridge/file-actions/" + id + "/claim", """
        { "workspaceId": "ws-test", "deviceId": "device-1" }
        """);
    String claimToken = claimed.get("claimToken").asText();
    assertThat(claimToken).isNotBlank();
    assertThat(claimed.at("/action/status").asText()).isEqualTo("claimed");
    assertThat(claimed.at("/action/attempt").asInt()).isEqualTo(1);

    mvc.perform(post("/api/core/bridge/file-actions/" + id + "/lease")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                { "workspaceId": "ws-test", "claimToken": "%s" }
                """.formatted(claimToken)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("running"))
        .andExpect(jsonPath("$.action.status").value("running"));

    mvc.perform(post("/api/core/bridge/file-actions/" + id + "/result")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "workspaceId": "ws-test",
                  "status": "succeeded",
                  "result": { "actualTokens": 123, "source": "unit-test" }
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("succeeded"))
        .andExpect(jsonPath("$.result.resultVersion").value(1))
        .andExpect(jsonPath("$.result.actualTokens").value(123));

    mvc.perform(get("/api/core/bridge/file-actions/" + id + "/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("succeeded"));
  }

  @Test
  void cancelPendingActionImmediatelyMarksTerminal() throws Exception {
    JsonNode enqueued = postJson("/api/core/bridge/file-actions", """
        {
          "workspaceId": "ws-cancel",
          "type": "mcp_visual_review",
          "payload": { "projectName": "dashboard" }
        }
        """);
    String id = enqueued.get("id").asText();

    mvc.perform(post("/api/core/bridge/file-actions/" + id + "/cancel")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{ \"workspaceId\": \"ws-cancel\" }"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("cancelled"))
        .andExpect(jsonPath("$.cancelRequestedAt").exists())
        .andExpect(jsonPath("$.completedAt").exists());
  }

  private JsonNode postJson(String path, String body) throws Exception {
    MvcResult result = mvc.perform(post(path)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body))
        .andReturn();
    assertThat(result.getResponse().getStatus()).isIn(200, 201);
    return objectMapper.readTree(result.getResponse().getContentAsString());
  }
}
