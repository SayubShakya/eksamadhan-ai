package io.eksamadhan.controller;

import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The platform admin panel: only the system admin reaches it, and suspending a business locks it out. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminPanelTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;

    private User systemAdmin() {
        User admin = users.findAll().stream().filter(User::isSystemAdmin).findFirst().orElse(null);
        assumeTrue(admin != null, "needs the system admin account");
        return admin;
    }

    private User tenant() {
        User owner = users.findAll().stream()
                .filter(u -> u.getRole() == UserRole.OWNER && u.getStatus() == UserStatus.ACTIVE && !u.isSystemAdmin())
                .findFirst().orElse(null);
        assumeTrue(owner != null, "needs an active tenant");
        return users.findWithOrganizationById(owner.getId()).orElseThrow();
    }

    private String bearer(User u) { return "Bearer " + jwt.issueSession(u); }

    @Test
    void aWorkspaceOwnerCannotReachThePanel() throws Exception {
        User owner = tenant();
        for (String path : new String[] { "/overview", "/businesses", "/people", "/audit" }) {
            mvc.perform(get("/api/system/admin" + path).header("Authorization", bearer(owner)))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/system/admin/businesses/" + owner.getOrganization().getId() + "/suspend")
                        .header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"test\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void suspendingABusinessSignsItOutAndRestoringLetsItBackIn() throws Exception {
        User admin = systemAdmin();
        User owner = tenant();
        UUID org = owner.getOrganization().getId();

        mvc.perform(get("/api/system/admin/businesses").header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/system/admin/businesses/" + org + "/suspend").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/system/admin/businesses/" + org + "/suspend").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Unpaid test\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.business.status").value("SUSPENDED"));

        mvc.perform(get("/api/me").header("Authorization", bearer(owner))).andExpect(status().isUnauthorized());

        mvc.perform(post("/api/system/admin/businesses/" + org + "/restore").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.business.status").value("ACTIVE"));
        mvc.perform(get("/api/me").header("Authorization", bearer(owner))).andExpect(status().isOk());

        Integer logged = jdbc.queryForObject(
                "SELECT count(*) FROM admin_audit_log WHERE organization_id = ? AND action IN ('SUSPEND_BUSINESS', 'RESTORE_BUSINESS')"
                        + " AND created_at >= now()",
                Integer.class, org);
        assertEquals(2, logged);
    }

    @Test
    void aBusinessIsCreatedThenDeletedOnlyWhenSuspendedAndNamed() throws Exception {
        User admin = systemAdmin();
        String email = "owner-" + UUID.randomUUID() + "@example.com";
        String body = mvc.perform(post("/api/system/admin/businesses").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Admin Test Shop\",\"ownerEmail\":\"" + email + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.business.business.ownerInvited").value(true))
                .andExpect(jsonPath("$.inviteUrl").exists())
                .andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(body, "$.business.business.id");

        mvc.perform(post("/api/system/admin/businesses/" + id + "/delete").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirmName\":\"Admin Test Shop\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/system/admin/businesses/" + id + "/suspend").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"test\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/system/admin/businesses/" + id + "/delete").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirmName\":\"Wrong name\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/system/admin/businesses/" + id + "/delete").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirmName\":\"Admin Test Shop\"}"))
                .andExpect(status().isOk());

        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM organizations WHERE id = ?::uuid", Integer.class, id));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM invitations WHERE email = ?", Integer.class, email));
        assertEquals(1, jdbc.queryForObject(
                "SELECT count(*) FROM admin_audit_log WHERE action = 'DELETE_BUSINESS' AND detail LIKE 'Admin Test Shop%'", Integer.class));
    }

    @Test
    void makingSomeoneTenantLeavesExactlyOneTenant() throws Exception {
        User admin = systemAdmin();
        User owner = tenant();
        User staff = users.saveAndFlush(User.builder()
                .organization(owner.getOrganization())
                .email("tenant-" + UUID.randomUUID() + "@example.com")
                .firstName("Next").role(UserRole.AGENT).status(UserStatus.ACTIVE).build());
        mvc.perform(post("/api/system/admin/people/" + staff.getId() + "/make-tenant").header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
        assertEquals(UserRole.OWNER, users.findById(staff.getId()).orElseThrow().getRole());
        assertEquals(UserRole.ADMIN, users.findById(owner.getId()).orElseThrow().getRole());
        assertEquals(1, users.findByOrganization(owner.getOrganization()).stream()
                .filter(u -> u.getRole() == UserRole.OWNER).count());
    }

    @Test
    void thePlatformWorkspaceAndTheOwnerAreNotActedOn() throws Exception {
        User admin = systemAdmin();
        User owner = tenant();
        UUID platform = users.findWithOrganizationById(admin.getId()).orElseThrow().getOrganization().getId();
        mvc.perform(post("/api/system/admin/businesses/" + platform + "/suspend").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"x\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/system/admin/people/" + admin.getId() + "/disable").header("Authorization", bearer(admin)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/system/admin/people/" + owner.getId() + "/disable").header("Authorization", bearer(admin)))
                .andExpect(status().isConflict());
    }
}
