package io.eksamadhan.controller;

import io.eksamadhan.dto.AuthDtos.*;
import io.eksamadhan.model.User;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.AccountService;
import io.eksamadhan.service.CurrentUser;
import io.eksamadhan.service.JwtService;
import io.eksamadhan.model.Invitation;
import io.eksamadhan.repository.InvitationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Signing up, signing in, and reading or editing your own profile.
 *
 * Signing out is not here: the token is stateless, so the browser simply discards it.
 */
@RestController
@RequestMapping("/api")
public class AccountController {

    private final AccountService accountService;
    private final JwtService jwtService;
    private final CurrentUser currentUser;
    private final UserRepository userRepository;
    private final InvitationRepository invitationRepository;

    public AccountController(AccountService accountService,
                             JwtService jwtService,
                             CurrentUser currentUser,
                             UserRepository userRepository,
                             InvitationRepository invitationRepository) {
        this.accountService = accountService;
        this.jwtService = jwtService;
        this.currentUser = currentUser;
        this.userRepository = userRepository;
        this.invitationRepository = invitationRepository;
    }

    @PostMapping("/auth/signup")
    public Session signUp(@RequestBody SignupRequest request) {
        User user = accountService.signUp(
                request.organizationName(), request.firstName(), request.lastName(),
                request.email(), request.password());
        return session(user);
    }

    @PostMapping("/auth/login")
    public Session logIn(@RequestBody LoginRequest request) {
        return session(accountService.signIn(request.email(), request.password()));
    }

    /**
     * What an invite link is for, shown before the recipient has an account. Public by
     * necessity — the whole point is that they cannot sign in yet.
     */
    @GetMapping("/auth/invitations/{token}")
    public InvitePreview previewInvitation(@PathVariable String token) {
        Invitation invitation = invitationRepository.findByToken(token)
                .filter(Invitation::isUsable)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "This invite link is not valid or has expired"));
        return new InvitePreview(invitation.getEmail(), invitation.getRole(),
                invitation.getOrganization().getName(), invitation.getExpiresAt());
    }

    @PostMapping("/auth/invitations/{token}/accept")
    public Session acceptInvitation(@PathVariable String token, @RequestBody AcceptInviteRequest request) {
        return session(accountService.acceptInvitation(
                token, request.firstName(), request.lastName(), request.password()));
    }

    @GetMapping("/me")
    public Session me() {
        User user = currentUser.require();
        return session(user);
    }

    @PutMapping("/me")
    public Session updateProfile(@RequestBody UpdateProfileRequest request) {
        User user = currentUser.require();
        if (request.firstName() != null && !request.firstName().isBlank()) {
            user.setFirstName(request.firstName().trim());
        }
        user.setLastName(request.lastName() == null ? null : request.lastName().trim());
        user.setAvatar(request.avatar());
        return session(userRepository.save(user));
    }

    /**
     * Every response re-issues the token, so a profile edit also refreshes the 24h window
     * and the name carried in the claims.
     */
    private Session session(User user) {
        return new Session(
                jwtService.issueSession(user),
                Profile.of(user),
                Workspace.of(user.getOrganization()));
    }
}
