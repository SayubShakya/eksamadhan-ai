package io.eksamadhan.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/** Links follow a running Cloudflare quick tunnel, and fall back to the configured address. */
class PublicUrlTest {

    @Test
    void readsTheTunnelsAddressAndIgnoresAnythingElse() {
        assertEquals("https://abc-def.trycloudflare.com", PublicUrl.fromStatus("{\"hostname\":\"abc-def.trycloudflare.com\"}"));
        assertNull(PublicUrl.fromStatus("{\"hostname\":\"\"}"));
        assertNull(PublicUrl.fromStatus("{\"hostname\":\"evil.com/<script>\"}"));
        assertNull(PublicUrl.fromStatus("not json"));
        assertNull(PublicUrl.fromStatus("{}"));
    }

    @Test
    void withNoTunnelItIsTheConfiguredAddress() {
        assertEquals("http://localhost:5174", new PublicUrl("http://localhost:5174/", "").get());
        // Nothing listening on that port: same answer, and quickly.
        long started = System.nanoTime();
        assertEquals("http://localhost:5174", new PublicUrl("http://localhost:5174", "http://127.0.0.1:1/quicktunnel").get());
        assertTrue((System.nanoTime() - started) / 1_000_000 < 3000, "a missing tunnel must not hold up a request");
    }

    @Test
    void withATunnelRunningItIsTheTunnel() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/quicktunnel", ex -> {
            byte[] body = "{\"hostname\":\"fresh-name-here.trycloudflare.com\"}".getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
        try {
            // The first port asked has nothing on it, as when another program holds 20241.
            PublicUrl url = new PublicUrl("http://localhost:5174",
                    "http://127.0.0.1:1/quicktunnel, http://127.0.0.1:" + server.getAddress().getPort() + "/quicktunnel");
            assertEquals("https://fresh-name-here.trycloudflare.com", url.get());
            assertEquals("http://localhost:5174", url.configured());
        } finally {
            server.stop(0);
        }
    }
}
