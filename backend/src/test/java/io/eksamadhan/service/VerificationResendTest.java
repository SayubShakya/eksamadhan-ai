package io.eksamadhan.service;

import io.eksamadhan.model.User;
import io.eksamadhan.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** "Send it again" says what happened, rather than "sent" whatever the provider answered. */
class VerificationResendTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final EmailService email = mock(EmailService.class);
    private final PublicUrl publicUrl = mock(PublicUrl.class);
    private final EmailLinkService links = new EmailLinkService(jdbc, mock(UserRepository.class), email,
            mock(PasswordEncoder.class), publicUrl);

    private User unconfirmed() {
        User u = User.builder().email("rita@example.com").firstName("Rita").emailVerified(false).build();
        u.setId(UUID.randomUUID());
        return u;
    }

    private void recentLinks(int n) {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(), any(), any())).thenReturn(n);
    }

    @Test
    void aRefusedEmailIsReportedAndItsLinkWithdrawn() {
        recentLinks(0);
        when(publicUrl.get()).thenReturn("https://app.example");
        when(email.layout(anyString(), anyString())).thenReturn("<p>");
        when(email.send(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(EmailService.Result.failed("refused"));

        assertEquals(EmailLinkService.Sent.FAILED, links.sendVerification(unconfirmed()));
        verify(jdbc).update(startsWith("DELETE FROM email_links"), anyString());
    }

    @Test
    void aSecondAskWithinAMinuteSendsNothingAndSaysSo() {
        recentLinks(1);
        assertEquals(EmailLinkService.Sent.TOO_SOON, links.sendVerification(unconfirmed()));
        verify(email, never()).send(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void aSentEmailIsSent() {
        recentLinks(0);
        when(publicUrl.get()).thenReturn("https://app.example");
        when(email.layout(anyString(), anyString())).thenReturn("<p>");
        when(email.send(anyString(), anyString(), anyString(), anyString())).thenReturn(EmailService.Result.ok());
        assertEquals(EmailLinkService.Sent.SENT, links.sendVerification(unconfirmed()));
    }
}
