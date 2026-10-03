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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Changing a member's role from the Team page: the tenant only, and never the tenant's own. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TeamRoleTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;

    private User tenant() {
        User owner = users.findAll().stream()
                .filter(u -> u.getRole() == UserRole.OWNER && u.getStatus() == UserStatus.ACTIVE && !u.isSystemAdmin())
                .findFirst().orElse(null);
        assumeTrue(owner != null, "needs an active tenant");
        return users.findWithOrganizationById(owner.getId()).orElseThrow();
    }

    private User colleague(User tenant, UserRole role) {
        return users.saveAndFlush(User.builder()
                .organization(tenant.getOrganization())
                .email("role-" + UUID.randomUUID() + "@example.com")
                .firstName("Role").lastName("Test")
                .role(role).status(UserStatus.ACTIVE)
                .build());
    }

    private String bearer(User u) { return "Bearer " + jwt.issueSession(u); }

    private org.springframework.test.web.servlet.ResultActions setRole(User as, User who, String role) throws Exception {
        return mvc.perform(patch("/api/team/members/" + who.getId() + "/role").header("Authorization", bearer(as))
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"" + role + "\"}"));
    }

    @Test
    void theTenantMakesStaffAnAdminAndBack() throws Exception {
        User tenant = tenant();
        User staff = colleague(tenant, UserRole.AGENT);
        setRole(tenant, staff, "ADMIN").andExpect(status().isOk());
        assertEquals(UserRole.ADMIN, users.findById(staff.getId()).orElseThrow().getRole());
        setRole(tenant, staff, "AGENT").andExpect(status().isOk());
        assertEquals(UserRole.AGENT, users.findById(staff.getId()).orElseThrow().getRole());
    }

    @Test
    void nobodyElseChangesRolesAndNobodyBecomesTenantThisWay() throws Exception {
        User tenant = tenant();
        User admin = colleague(tenant, UserRole.ADMIN);
        User staff = colleague(tenant, UserRole.AGENT);
        setRole(admin, staff, "ADMIN").andExpect(status().isForbidden());
        setRole(staff, admin, "AGENT").andExpect(status().isForbidden());
        setRole(tenant, staff, "OWNER").andExpect(status().isBadRequest());
        setRole(tenant, tenant, "AGENT").andExpect(status().isForbidden());
    }
}
