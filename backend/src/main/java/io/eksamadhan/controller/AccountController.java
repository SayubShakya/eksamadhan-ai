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
    private final io.eksamadhan.service.FirebaseTokenVerifier firebase;
    private final io.eksamadhan.service.AuthRateLimiter rateLimiter;

    public AccountController(AccountService accountService,
                             JwtService jwtService,
                             CurrentUser currentUser,
                             UserRepository userRepository,
                             InvitationRepository invitationRepository,
                             io.eksamadhan.service.FirebaseTokenVerifier firebase,
                             io.eksamadhan.service.AuthRateLimiter rateLimiter) {
        this.accountService = accountService;
        this.jwtService = jwtService;
        this.currentUser = currentUser;
        this.userRepository = userRepository;
        this.invitationRepository = invitationRepository;
        this.firebase = firebase;
        this.rateLimiter = rateLimiter;
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
        // Paused after repeated wrong passwords for this address — see AuthRateLimiter.
        java.time.Duration paused = rateLimiter.loginPausedFor(request.email());
        if (!paused.isZero()) {
            long minutes = Math.max(1, (paused.toSeconds() + 59) / 60);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many wrong passwords for this account. Try again in " + minutes
                  + (minutes == 1 ? " minute." : " minutes."));
        }
        try {
            User user = accountService.signIn(request.email(), request.password());
            rateLimiter.recordSuccess(request.email());
            return session(user);
        } catch (ResponseStatusException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) rateLimiter.recordFailure(request.email());
            throw e;
        }
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

    // Sign in with Google. The token is checked against Google's keys before anything else
    // happens; see FirebaseTokenVerifier.

    @PostMapping("/auth/google")
    public Session logInWithGoogle(@RequestBody GoogleRequest request) {
        return session(accountService.signInWithGoogle(firebase.verify(request.idToken())));
    }

    @PostMapping("/auth/signup/google")
    public Session signUpWithGoogle(@RequestBody GoogleRequest request) {
        return session(accountService.signUpWithGoogle(request.organizationName(), firebase.verify(request.idToken())));
    }

    @PostMapping("/auth/invitations/{token}/accept/google")
    public Session acceptInvitationWithGoogle(@PathVariable String token, @RequestBody GoogleRequest request) {
        return session(accountService.acceptInvitationWithGoogle(token, firebase.verify(request.idToken())));
    }

    @GetMapping("/me")
    public Session me() {
        User user = currentUser.require();
        return session(user);
    }

    /**
     * Name and photo only, written as those three columns. Saving the whole user here failed
     * twice over: the copy save() returns has its workspace unloaded, so building the new session
     * threw LazyInitializationException (every profile save answered "Something went wrong"), and
     * writing the full row could undo a status or last-seen change made a moment earlier.
     */
    @PutMapping("/me")
    @org.springframework.transaction.annotation.Transactional
    public Session updateProfile(@RequestBody UpdateProfileRequest request) {
        User user = currentUser.require();
        String firstName = request.firstName() != null && !request.firstName().isBlank()
                ? request.firstName().trim() : user.getFirstName();
        String lastName = request.lastName() == null || request.lastName().isBlank() ? null : request.lastName().trim();
        userRepository.updateProfile(user.getId(), firstName, lastName, request.avatar());
        return session(userRepository.findWithOrganizationById(user.getId()).orElseThrow());
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
