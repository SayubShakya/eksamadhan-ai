package io.eksamadhan.controller;

import io.eksamadhan.model.User;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.EmailService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Email confirmation and password reset, end to end over HTTP, with the email captured. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class EmailLinkTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwordEncoder;
    @MockitoBean EmailService email;

    private static final Pattern TOKEN = Pattern.compile("token=([A-Za-z0-9_-]+)");

    private String unique() { return "link-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com"; }

    private String lastLink(String subjectPart) {
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(email, atLeastOnce()).send(anyString(), contains(subjectPart), anyString(), text.capture());
        Matcher m = TOKEN.matcher(text.getValue());
        assertTrue(m.find(), "the email carries a link");
        return m.group(1);
    }

    private void signUp(String address) throws Exception {
        when(email.button(anyString(), anyString())).thenReturn("<a>link</a>");
        when(email.layout(anyString(), anyString())).thenReturn("<p>mail</p>");
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"organizationName\":\"Links Ltd\",\"firstName\":\"Lina\",\"email\":\"" + address + "\",\"password\":\"first-password\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.emailVerified").value(false));
    }

    @Test
    void aPasswordSignUpIsUnverifiedUntilTheEmailedLinkIsOpened() throws Exception {
        String address = unique();
        signUp(address);
        String token = lastLink("Confirm your email");

        mvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\"}")).andExpect(status().isOk());
        assertTrue(users.findByEmailIgnoreCase(address).orElseThrow().isEmailVerified());

        // A link works once.
        mvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\"}")).andExpect(status().isGone());
    }

    @Test
    void forgotPasswordEmailsALinkThatSetsANewPasswordOnce() throws Exception {
        String address = unique();
        signUp(address);
        mvc.perform(post("/api/auth/password/forgot").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + address + "\"}")).andExpect(status().isOk());
        String token = lastLink("Reset your");

        mvc.perform(get("/api/auth/password/reset/" + token)).andExpect(jsonPath("$.usable").value(true));
        mvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"newPassword\":\"second-password\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").exists());

        User user = users.findByEmailIgnoreCase(address).orElseThrow();
        assertTrue(passwordEncoder.matches("second-password", user.getPasswordHash()));
        assertTrue(user.isEmailVerified(), "a reset proves the address too");
        mvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"newPassword\":\"third-password\"}"))
                .andExpect(status().isGone());
    }

    @Test
    void forgotPasswordGivesTheSameAnswerForAnAddressWithNoAccount() throws Exception {
        mvc.perform(post("/api/auth/password/forgot").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"nobody-" + UUID.randomUUID() + "@example.com\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.sent").value(true));
        verify(email, never()).send(anyString(), contains("Reset"), anyString(), anyString());
    }

    @Test
    void aMadeUpOrShortResetIsRefused() throws Exception {
        mvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"not-a-real-token\",\"newPassword\":\"long-enough-1\"}"))
                .andExpect(status().isGone());
        mvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"x\",\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }
}
