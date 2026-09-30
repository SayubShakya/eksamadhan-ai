package io.eksamadhan.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The security audit's fixes, each checked on the code path that had the hole. */
class SecurityFixesTest {

    @Test
    void theWebsiteCrawlRefusesToStartOnThisServerOrItsNetwork() {
        WebCrawler crawler = new WebCrawler(5, 1, 0);
        for (String url : new String[] { "localhost:8080", "http://127.0.0.1/api/system/messages",
                "http://169.254.169.254/latest/meta-data/", "192.168.1.1" }) {
            assertThatThrownBy(() -> crawler.checkStart(url))
                    .as(url).isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not a public website");
        }
    }

    @Test
    void aWorkspaceNameCannotAddALinkToTheInviteEmail() {
        EmailService email = new EmailService("", "test@example.com", false);
        String html = email.button("https://app.example/invite/abc", "Join <a href=\"//evil\">Reset password</a>");
        assertThat(html).doesNotContain("<a href=\"//evil\"")
                .contains("Join &lt;a href=&quot;//evil&quot;&gt;Reset password&lt;/a&gt;");
    }
}
