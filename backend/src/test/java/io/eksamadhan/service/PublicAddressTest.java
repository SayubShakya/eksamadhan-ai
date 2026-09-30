package io.eksamadhan.service;

import org.junit.jupiter.api.Test;

import java.net.InetAddress;
import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The website crawl must never be pointed at this server, its network or a metadata address. */
class PublicAddressTest {

    private static boolean pub(String ip) throws Exception {
        return PublicAddress.isPublic(InetAddress.getByName(ip));
    }

    @Test
    void privateLocalAndMetadataAddressesAreRefused() throws Exception {
        for (String ip : new String[] {
                "127.0.0.1", "0.0.0.0", "10.1.2.3", "172.16.5.4", "192.168.1.1", "169.254.169.254",
                "100.64.0.1", "224.0.0.1", "255.255.255.255", "198.18.0.1", "::1", "fc00::1", "fe80::1",
                "::ffff:10.0.0.1", "::ffff:127.0.0.1" }) {
            assertThat(pub(ip)).as(ip).isFalse();
        }
    }

    @Test
    void publicAddressesAreAllowed() throws Exception {
        for (String ip : new String[] { "8.8.8.8", "1.1.1.1", "104.16.230.132", "2606:4700:4700::1111" }) {
            assertThat(pub(ip)).as(ip).isTrue();
        }
    }

    @Test
    void urlsToLocalHostsAreRefusedWithAReason() {
        for (String url : new String[] { "http://localhost:8080/api/system", "http://127.0.0.1/",
                "http://169.254.169.254/latest/meta-data/", "http://[::1]/" }) {
            assertThatThrownBy(() -> PublicAddress.require(URI.create(url)))
                    .as(url).isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not a public website");
        }
    }

    @Test
    void otherSchemesAreRefused() {
        assertThatThrownBy(() -> PublicAddress.require(URI.create("file:///etc/passwd")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PublicAddress.require(URI.create("ftp://example.com/")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
