package io.eksamadhan.controller;

import io.eksamadhan.service.CurrentUser;
import io.eksamadhan.service.WidgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Setting up website chat on the Channels page. Anyone signed in sees it; the tenant and admins change it. */
@RestController
@RequestMapping("/api/widgets")
@RequiredArgsConstructor
public class WidgetSettingsController {

    private final WidgetService widgets;
    private final CurrentUser currentUser;

    public record Form(String name, List<String> origins, String greeting, String color) {}

    @GetMapping
    public List<WidgetService.Widget> list() {
        return widgets.list(currentUser.organization());
    }

    @PostMapping
    public WidgetService.Widget create(@RequestBody Form form) {
        currentUser.requireTeamManager();
        return widgets.create(currentUser.organization(), form.name(), form.origins(), form.greeting(), form.color());
    }

    @PutMapping("/{id}")
    public WidgetService.Widget update(@PathVariable UUID id, @RequestBody Form form) {
        currentUser.requireTeamManager();
        return widgets.update(currentUser.organization(), id, form.name(), form.origins(), form.greeting(), form.color());
    }

    @DeleteMapping("/{id}")
    public Map<String, Boolean> delete(@PathVariable UUID id) {
        currentUser.requireTeamManager();
        widgets.delete(currentUser.organization(), id);
        return Map.of("success", true);
    }
}
