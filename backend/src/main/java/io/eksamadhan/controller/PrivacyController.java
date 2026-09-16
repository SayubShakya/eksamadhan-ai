package io.eksamadhan.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PrivacyController {

    @GetMapping(value = "/api/auth/privacy", produces = "text/html")
    public String getPrivacyPolicy() {
        return """
            <html>
                <head><title>Privacy Policy — Eksamadhan AI</title></head>
                <body style="font-family: sans-serif; padding: 20px; max-width: 700px;">
                    <h1>Privacy Policy</h1>
                    <p>Eksamadhan AI is a student project that centralises customer
                       support messages from Facebook and Instagram.</p>
                    <h2>What we store</h2>
                    <p>Message content, sender name and page identifiers for the
                       accounts you explicitly connect, so they can be shown in one
                       inbox and answered.</p>
                    <h2>Deleting your data</h2>
                    <p>See our <a href="/api/auth/data-deletion">data deletion
                       instructions</a>.</p>
                </body>
            </html>
            """;
    }

    /**
     * Meta requires a data-deletion URL distinct from the privacy policy URL —
     * it rejects the two being identical in App Settings > Basic.
     */
    @GetMapping(value = "/api/auth/data-deletion", produces = "text/html")
    public String getDataDeletionInstructions() {
        return """
            <html>
                <head><title>Data Deletion — Eksamadhan AI</title></head>
                <body style="font-family: sans-serif; padding: 20px; max-width: 700px;">
                    <h1>How to delete your data</h1>
                    <ol>
                        <li>Open Facebook <b>Settings &amp; privacy → Settings</b>.</li>
                        <li>Go to <b>Apps and websites</b>.</li>
                        <li>Select <b>Eksamadhan AI</b> and choose <b>Remove</b>.</li>
                    </ol>
                    <p>Removing the app disconnects your Page and Instagram account.
                       All stored messages, page records and access tokens for that
                       account are deleted from our database.</p>
                    <p>To request deletion directly, email
                       <a href="mailto:shakya.sayub123@gmail.com">shakya.sayub123@gmail.com</a>.</p>
                </body>
            </html>
            """;
    }
}
