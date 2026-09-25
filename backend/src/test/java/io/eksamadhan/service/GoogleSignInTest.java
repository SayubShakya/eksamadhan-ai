package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.InvitationRepository;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Who a Google account may become, against the real database: the member who has the address,
 * the person an invitation was sent to, or a new workspace's owner — and nobody else. The
 * token itself is checked in FirebaseTokenVerifierTest; here the identity is taken as proven.
 * Rolled back.
 */
@SpringBootTest
@Transactional
class GoogleSignInTest {

    @Autowired AccountService accounts;
    @Autowired UserRepository users;
    @Autowired InvitationRepository invitations;
    @Autowired OrganizationRepository organizations;

    private Organization workspace;
    private final String suffix = UUID.randomUUID().toString().substring(0, 8);

    @BeforeEach
    void setUp() {
        workspace = organizations.save(Organization.builder().name("ZZ Google Test").apiKey("zz-google-" + suffix).build());
    }

    private FirebaseTokenVerifier.GoogleIdentity google(String email, String uid) {
        return new FirebaseTokenVerifier.GoogleIdentity(uid, email, "Rita Gurung", "https://lh3.googleusercontent.com/a/photo");
    }

    private String invite(String email) {
        String token = "zz-invite-" + UUID.randomUUID();
        invitations.save(Invitation.builder().organization(workspace).email(email).role(UserRole.AGENT)
                .token(token).createdAt(OffsetDateTime.now()).expiresAt(OffsetDateTime.now().plusDays(7)).build());
        return token;
    }

    @Test
    void staffJoinFromTheirInviteWithoutAPasswordAndCanSignInAgain() {
        String email = "rita-" + suffix + "@example.com";
        User rita = accounts.acceptInvitationWithGoogle(invite(email), google(email, "uid-rita-" + suffix));

        assertNull(rita.getPasswordHash(), "no password was ever created");
        assertEquals(UserRole.AGENT, rita.getRole(), "the role comes from the invitation");
        assertEquals("Rita", rita.getFirstName());
        assertEquals("Gurung", rita.getLastName());

        assertEquals(rita.getId(), accounts.signInWithGoogle(google(email, "uid-rita-" + suffix)).getId());

        // And the password form cannot be used to get in: there is no password to guess.
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> accounts.signIn(email, ""));
        assertEquals(HttpStatus.UNAUTHORIZED, e.getStatusCode());
    }

    @Test
    void anInviteCannotBeTakenByADifferentGoogleAccount() {
        String token = invite("rita-" + suffix + "@example.com");
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> accounts.acceptInvitationWithGoogle(token, google("someone-" + suffix + "@gmail.com", "uid-x")));
        assertEquals(HttpStatus.FORBIDDEN, e.getStatusCode());
    }

    @Test
    void aGoogleAccountWithNoMembershipIsToldHowToJoin() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> accounts.signInWithGoogle(google("nobody-" + suffix + "@gmail.com", "uid-y")));
        assertEquals(HttpStatus.NOT_FOUND, e.getStatusCode());
        assertTrue(e.getReason().contains("invitation"), e.getReason());
    }

    @Test
    void aPasswordMemberCanStartUsingGoogleAndIsThenPinnedToThatAccount() {
        String email = "owner-" + suffix + "@example.com";
        accounts.signUp("ZZ Google Owner " + suffix, "Sayub", "Shakya", email, "a-long-password");

        User first = accounts.signInWithGoogle(google(email, "uid-owner-" + suffix));
        assertEquals("uid-owner-" + suffix, first.getFirebaseUid(), "linked on first use");
        assertNotNull(first.getPasswordHash(), "their password still works too");

        // A different Google account presenting the same address is someone else.
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> accounts.signInWithGoogle(google(email, "uid-impostor")));
        assertEquals(HttpStatus.FORBIDDEN, e.getStatusCode());
    }

    @Test
    void theSystemAdminCannotSignInWithGoogle() {
        String email = "platform-" + suffix + "@example.com";
        User admin = accounts.signUp("ZZ Google Platform " + suffix, "System", "Admin", email, "a-long-password");
        admin.setSystemAdmin(true);
        users.save(admin);
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> accounts.signInWithGoogle(google(email, "uid-platform")));
        assertEquals(HttpStatus.FORBIDDEN, e.getStatusCode());
    }

    @Test
    void anOwnerCanCreateAWorkspaceWithGoogle() {
        String email = "founder-" + suffix + "@example.com";
        User owner = accounts.signUpWithGoogle("ZZ Google Founded " + suffix, google(email, "uid-founder-" + suffix));
        assertEquals(UserRole.OWNER, owner.getRole());
        assertNull(owner.getPasswordHash());
        assertEquals("ZZ Google Founded " + suffix, owner.getOrganization().getName());
    }
}
