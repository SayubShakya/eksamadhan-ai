package io.eksamadhan.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Checks the encryption against the worked example in RFC 8291 §5.
 *
 * Push encryption cannot be verified by using it: a wrong key or a wrong info string produces
 * a body that looks perfectly well-formed and is silently discarded by the browser, with the
 * push service reporting a cheerful 201. The RFC publishes its example with the salt and the
 * sender's key fixed precisely so an implementation can be compared byte for byte, which is
 * the only honest way to know this is right.
 */
class WebPushCryptoTest {

    private static final String PLAINTEXT = "When I grow up, I want to be a watermelon";

    private static final String UA_PUBLIC_KEY =
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
    private static final String AUTH_SECRET = "BTBZMqHH6r4Tts7J_aSIgg";

    private static final String SENDER_PUBLIC_KEY =
            "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
    private static final String SENDER_PRIVATE_KEY = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";

    private static final String SALT = "DGv6ra1nlYgDCS1FRnbzlw";

    private static final String EXPECTED_BODY =
            "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml"
            + "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT"
            + "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

    @Test
    @DisplayName("encrypts the RFC 8291 example to the byte")
    void matchesTheRfcExample() throws Exception {
        ECPrivateKey senderPrivate = WebPushCrypto.privateKeyFrom(WebPushCrypto.decode(SENDER_PRIVATE_KEY));
        KeyPair senderKeys = new KeyPair(
                WebPushCrypto.publicKeyFrom(WebPushCrypto.decode(SENDER_PUBLIC_KEY)), senderPrivate);

        byte[] body = WebPushCrypto.encrypt(
                WebPushCrypto.decode(UA_PUBLIC_KEY),
                WebPushCrypto.decode(AUTH_SECRET),
                PLAINTEXT.getBytes(StandardCharsets.UTF_8),
                senderKeys,
                WebPushCrypto.decode(SALT));

        assertEquals(EXPECTED_BODY, WebPushCrypto.encode(body));
    }

    @Test
    @DisplayName("a public key survives a round trip through its raw 65-byte form")
    void encodesPublicKeysTheWayBrowsersDo() throws Exception {
        String raw = SENDER_PUBLIC_KEY;
        assertEquals(raw, WebPushCrypto.encode(
                WebPushCrypto.rawPublicKey(WebPushCrypto.publicKeyFrom(WebPushCrypto.decode(raw)))));
    }
}
