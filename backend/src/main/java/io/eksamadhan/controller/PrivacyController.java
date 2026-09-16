package io.eksamadhan.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/privacy")
public class PrivacyController {

    @GetMapping(produces = "text/html")
    public String getPrivacyPolicy() {
        return """
            <html>
                <head><title>Privacy Policy</title></head>
                <body style="font-family: sans-serif; padding: 20px;">
                    <h1>Privacy Policy</h1>
                    <p>Eksamadhan AI - To delete your data, remove the app from your Facebook settings.</p>
                </body>
            </html>
            """;
    }
}
