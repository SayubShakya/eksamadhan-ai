package io.eksamadhan.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The public pages Meta asks for in App Settings: a privacy policy URL, a terms URL and a
 * data-deletion URL, reachable through the fixed meta-proxy address even when the dashboard
 * itself is not public.
 *
 * Each is a short summary that links to the full text on the dashboard (/privacy, /terms,
 * written in frontend/src/pages/LegalPage.jsx), so the policy has one source rather than two
 * copies drifting apart. There used to be a second, older /api/auth/privacy in AuthController
 * calling the app a proof of concept, with a different contact address.
 */
@RestController
public class PrivacyController {

    private static final String CONTACT = "shakya.sayub123@gmail.com";

    private final String frontendUrl;

    public PrivacyController(@Value("${app.frontend-url}") String frontendUrl) {
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    @GetMapping(value = "/api/auth/privacy", produces = "text/html")
    public String getPrivacyPolicy() {
        return page("Privacy Policy", """
                <p>EkSamadhan AI is a customer-support inbox for Facebook Messenger and Instagram,
                   with AI replies and handover to people. It is a final-year project by Sayub Shakya at
                   the University of Bedfordshire.</p>
                <p>For the Pages and Instagram accounts a business connects, it stores the
                   conversations, the sender's name and profile photo as Meta provides them, and any
                   photos or voice notes sent, so they can be shown in one inbox and answered. It sells
                   no data, shows no advertising and uses no tracking.</p>
                <p>Read the <a href="%1$s/privacy">full Privacy Policy</a>, including who else handles
                   the data and your rights, or the <a href="/api/auth/data-deletion">data deletion
                   instructions</a>. Contact: <a href="mailto:%2$s">%2$s</a>.</p>
                """.formatted(frontendUrl, CONTACT));
    }

    @GetMapping(value = "/api/auth/terms", produces = "text/html")
    public String getTerms() {
        return page("Terms &amp; Conditions", """
                <p>By connecting a Page or signing in to EkSamadhan AI you agree to its terms: connect
                   only accounts you are allowed to manage and follow Meta's policies for them, be
                   responsible for your customers' data and for the knowledge you add, and check the
                   conversations that matter, because AI replies are automatic and can be wrong. The service
                   is a project under development, offered with no guarantee of availability.</p>
                <p>Read the <a href="%1$s/terms">full Terms &amp; Conditions</a>. Contact:
                   <a href="mailto:%2$s">%2$s</a>.</p>
                """.formatted(frontendUrl, CONTACT));
    }

    /**
     * Meta requires a data-deletion URL distinct from the privacy policy URL —
     * it rejects the two being identical in App Settings > Basic.
     */
    @GetMapping(value = "/api/auth/data-deletion", produces = "text/html")
    public String getDataDeletionInstructions() {
        return page("How to delete your data", """
                <p><strong>From Facebook:</strong></p>
                <ol>
                    <li>Open Facebook <b>Settings &amp; privacy → Settings</b>.</li>
                    <li>Go to <b>Apps and websites</b>.</li>
                    <li>Select <b>EkSamadhan AI</b> and choose <b>Remove</b>.</li>
                </ol>
                <p><strong>From EkSamadhan AI:</strong> a workspace owner can choose <b>Disconnect</b>
                   in Settings, which deletes the connected Pages and all their conversations and
                   messages.</p>
                <p>To ask for deletion directly, email <a href="mailto:%1$s">%1$s</a>.</p>
                """.formatted(CONTACT));
    }

    private static String page(String title, String body) {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>%1$s | EkSamadhan AI</title>
                </head>
                <body style="font-family: system-ui, sans-serif; line-height: 1.6; padding: 20px; max-width: 700px; margin: 0 auto; color: #111827;">
                  <h1>%1$s</h1>
                  %2$s
                </body>
                </html>
                """.formatted(title, body);
    }
}
