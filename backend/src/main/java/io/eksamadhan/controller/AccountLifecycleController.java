package io.eksamadhan.controller;

import io.eksamadhan.model.AccountDeletionChallenge;
import io.eksamadhan.model.User;
import io.eksamadhan.service.AccountLifecycleService;
import io.eksamadhan.service.CurrentUser;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Settings, Data and privacy: download my data, deactivate, and the deletion flow. Every step
 * of the flow answers with the stage the server holds, which is the only thing the page may
 * show; see AccountLifecycleService.
 */
@RestController
@RequestMapping("/api/account")
public class AccountLifecycleController {

    private final CurrentUser currentUser;
    private final AccountLifecycleService lifecycle;

    public AccountLifecycleController(CurrentUser currentUser, AccountLifecycleService lifecycle) {
        this.currentUser = currentUser;
        this.lifecycle = lifecycle;
    }

    public record Answer(String value) {}

    /** Step 0 for a tenant: who takes the workspace over. */
    public record Successor(java.util.UUID successorId) {}

    private Map<String, Object> state(User me, AccountDeletionChallenge c) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("stage", c == null ? null : c.getStage());
        out.put("expiresAt", c == null ? null : c.getExpiresAt().toString());
        out.put("summary", lifecycle.summary(me));
        out.put("successorId", c == null ? null : c.getSuccessorId());
        return out;
    }

    @GetMapping("/deletion")
    public Map<String, Object> current() {
        User me = currentUser.require();
        return state(me, lifecycle.current(me).orElse(null));
    }

    @PostMapping("/deletion")
    public Map<String, Object> start() {
        User me = currentUser.require();
        try {
            return state(me, lifecycle.start(me));
        } catch (org.springframework.dao.DataIntegrityViolationException sameMoment) {
            // Two starts at the same moment (a double click, a page opened twice): the other one
            // made the record, so this one answers with it rather than an error.
            return state(me, lifecycle.current(me).orElseThrow(() -> sameMoment));
        }
    }

    @PostMapping("/deletion/back")
    public Map<String, Object> back() {
        User me = currentUser.require();
        return state(me, lifecycle.back(me));
    }

    @PostMapping("/deletion/cancel")
    public Map<String, Object> cancel() {
        User me = currentUser.require();
        lifecycle.cancel(me);
        return state(me, null);
    }

    @PostMapping("/deletion/read")
    public Map<String, Object> read(@RequestBody(required = false) Successor body) {
        User me = currentUser.require();
        return state(me, lifecycle.acknowledge(me, body == null ? null : body.successorId()));
    }

    @PostMapping("/deletion/word")
    public Map<String, Object> word(@RequestBody Answer answer) {
        User me = currentUser.require();
        return state(me, lifecycle.confirmWord(me, answer == null ? null : answer.value()));
    }

    @PostMapping("/deletion/identity")
    public Map<String, Object> identity(@RequestBody Answer answer) {
        User me = currentUser.require();
        return state(me, lifecycle.confirmIdentity(me, answer == null ? null : answer.value()));
    }

    @PostMapping("/deletion/code/resend")
    public Map<String, Object> resend() {
        User me = currentUser.require();
        return state(me, lifecycle.resend(me));
    }

    @PostMapping("/deletion/code")
    public Map<String, Object> code(@RequestBody Answer answer) {
        User me = currentUser.require();
        return state(me, lifecycle.verifyCode(me, answer == null ? null : answer.value()));
    }

    /** The last step. Refused by the service unless every step before it happened. */
    @DeleteMapping("/deletion")
    public Map<String, Object> delete() {
        User me = currentUser.require();
        lifecycle.delete(me);
        return Map.of("deleted", true);
    }

    @PostMapping("/deactivate")
    public Map<String, Object> deactivate() {
        User me = currentUser.require();
        lifecycle.deactivate(me);
        return Map.of("deactivated", true);
    }

    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> export() {
        User me = currentUser.require();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"eksamadhan-my-data.json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(lifecycle.export(me));
    }
}
