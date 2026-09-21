package io.eksamadhan.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The cache exists to stop one reply embedding the same question twice, so what matters is
 * that a repeat costs nothing and still returns the same vector.
 */
class EmbeddingClientCacheTest {

    /** Counts the calls that would have gone to the network. */
    private static class CountingClient extends EmbeddingClient {
        int calls;

        CountingClient() {
            super("test-key", "https://example.invalid", "test-model", 3, "http://localhost");
        }

        @Override
        public java.util.List<float[]> embedAll(java.util.List<String> texts) {
            calls++;
            return texts.stream().map(t -> new float[]{t.length(), 1, 2}).toList();
        }
    }

    @Test
    @DisplayName("the same text is embedded once, however often it is asked for")
    void repeatsAreFree() {
        CountingClient client = new CountingClient();

        float[] first = client.embed("what is the delivery cost?");
        float[] again = client.embed("what is the delivery cost?");

        assertEquals(1, client.calls, "second call should have been served from the cache");
        assertArrayEquals(first, again);
    }

    @Test
    @DisplayName("different text still reaches the API")
    void differentTextIsNotConfused() {
        CountingClient client = new CountingClient();
        client.embed("delivery cost");
        client.embed("opening hours");
        assertEquals(2, client.calls);
    }

    @Test
    @DisplayName("a caller mutating what it got back cannot corrupt the cache")
    void cachedVectorsAreCopied() {
        CountingClient client = new CountingClient();
        float[] mine = client.embed("delivery cost");
        mine[0] = -999;

        assertEquals(13f, client.embed("delivery cost")[0], "cache handed out its own array");
    }
}
