package io.eksamadhan.controller;

import io.eksamadhan.model.UserRole;
import io.eksamadhan.service.AdminService;
import io.eksamadhan.service.CurrentUser;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The platform admin panel (AdminService). Like SystemController, every endpoint starts with
 * {@link CurrentUser#requireSystemAdmin()}: a workspace owner, admin or staff member gets 403.
 */
@RestController
@RequestMapping("/api/system/admin")
public class AdminController {

    private final CurrentUser currentUser;
    private final AdminService admin;

    public AdminController(CurrentUser currentUser, AdminService admin) {
        this.currentUser = currentUser;
        this.admin = admin;
    }

    public record CreateRequest(String name, String ownerEmail) {}
    public record SuspendRequest(String reason) {}
    public record DeleteRequest(String confirmName) {}
    public record InviteRequest(String email, UserRole role) {}
    public record RoleRequest(UserRole role) {}

    @GetMapping("/overview")
    public AdminService.Overview overview(@RequestParam(defaultValue = "30") int days) {
        currentUser.requireSystemAdmin();
        return admin.overview(days);
    }

    @GetMapping("/businesses")
    public List<AdminService.BusinessRow> businesses(@RequestParam(required = false) String q,
                                                     @RequestParam(required = false) String status) {
        currentUser.requireSystemAdmin();
        return admin.businesses(q, status);
    }

    @PostMapping("/businesses")
    public AdminService.Created create(@RequestBody CreateRequest body) {
        return admin.create(currentUser.requireSystemAdmin(), body.name(), body.ownerEmail());
    }

    @GetMapping("/businesses/{id}")
    public AdminService.BusinessDetail business(@PathVariable UUID id) {
        currentUser.requireSystemAdmin();
        return admin.business(id);
    }

    @PatchMapping("/businesses/{id}")
    public AdminService.BusinessDetail edit(@PathVariable UUID id, @RequestBody AdminService.Edit body) {
        return admin.update(currentUser.requireSystemAdmin(), id, body);
    }

    @PostMapping("/businesses/{id}/delete")
    public Map<String, Boolean> delete(@PathVariable UUID id, @RequestBody(required = false) DeleteRequest body) {
        admin.delete(currentUser.requireSystemAdmin(), id, body == null ? null : body.confirmName());
        return Map.of("deleted", true);
    }

    @PostMapping("/businesses/{id}/suspend")
    public AdminService.BusinessDetail suspend(@PathVariable UUID id, @RequestBody(required = false) SuspendRequest body) {
        return admin.suspend(currentUser.requireSystemAdmin(), id, body == null ? null : body.reason());
    }

    @PostMapping("/businesses/{id}/restore")
    public AdminService.BusinessDetail restore(@PathVariable UUID id) {
        return admin.restore(currentUser.requireSystemAdmin(), id);
    }

    @PostMapping("/businesses/{id}/invites")
    public AdminService.Invited invite(@PathVariable UUID id, @RequestBody InviteRequest body) {
        return admin.inviteInto(currentUser.requireSystemAdmin(), id, body.email(), body.role());
    }

    @GetMapping("/people")
    public List<AdminService.Member> people(@RequestParam(required = false) String q,
                                            @RequestParam(required = false) String role,
                                            @RequestParam(required = false) String status,
                                            @RequestParam(required = false) UUID business) {
        currentUser.requireSystemAdmin();
        return admin.people(q, role, status, business);
    }

    @PostMapping("/people/{id}/disable")
    public AdminService.Member disable(@PathVariable UUID id) {
        return admin.disable(currentUser.requireSystemAdmin(), id);
    }

    @PostMapping("/people/{id}/enable")
    public AdminService.Member enable(@PathVariable UUID id) {
        return admin.enable(currentUser.requireSystemAdmin(), id);
    }

    @PostMapping("/people/{id}/sign-out")
    public AdminService.Member signOut(@PathVariable UUID id) {
        return admin.signOutEverywhere(currentUser.requireSystemAdmin(), id);
    }

    @PostMapping("/people/{id}/password-reset")
    public Map<String, Object> passwordReset(@PathVariable UUID id) {
        return admin.sendPasswordReset(currentUser.requireSystemAdmin(), id);
    }

    @PostMapping("/people/{id}/make-tenant")
    public AdminService.Member makeTenant(@PathVariable UUID id) {
        return admin.makeTenant(currentUser.requireSystemAdmin(), id);
    }

    @PatchMapping("/people/{id}/role")
    public AdminService.Member role(@PathVariable UUID id, @RequestBody RoleRequest body) {
        return admin.changeRole(currentUser.requireSystemAdmin(), id, body == null ? null : body.role());
    }

    @GetMapping("/audit")
    public List<AdminService.AuditRow> audit(@RequestParam(required = false) UUID business,
                                             @RequestParam(required = false) String action,
                                             @RequestParam(defaultValue = "0") int days,
                                             @RequestParam(defaultValue = "200") int limit) {
        currentUser.requireSystemAdmin();
        return admin.audit(business, action, days, limit);
    }
}
