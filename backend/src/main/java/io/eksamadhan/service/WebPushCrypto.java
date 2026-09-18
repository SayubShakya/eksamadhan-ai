package io.eksamadhan.service;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.time.Instant;
import java.util.Base64;

/**
 * Web Push encryption and VAPID signing, to the letter of RFC 8291 and RFC 8292.
 *
 * A push message passes through a push service — Google's, Mozilla's, Apple's — that the
 * business has no relationship with and must not be able to read a customer's name or message.
 * So the payload is encrypted end to end against a key the browser generated and never shared
 * with anyone but us, and the request is signed so the push service can tell who sent it.
 *
 * Written against the JDK rather than pulling in a push library and BouncyCastle with it: this
 * is a few hundred lines of standard primitives, and {@code WebPushCryptoTest} checks it
 * against the worked example in RFC 8291 §5, so it is verified rather than merely plausible.
 */
public final class WebPushCrypto {

    private static final Base64.Encoder URL64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL64_DECODER = Base64.getUrlDecoder();

    /** One record, so the whole message is sent in a single AES-GCM block. */
    private static final int RECORD_SIZE = 4096;
    private static final int SALT_LENGTH = 16;
    private static final int KEY_LENGTH = 16;      // AES-128
    private static final int NONCE_LENGTH = 12;
    private static final int TAG_BITS = 128;

    private static final SecureRandom RANDOM = new SecureRandom();

    private WebPushCrypto() {}

    // ── Encryption (RFC 8291) ───────────────────────────────────────────────

    /**
     * Encrypts {@code plaintext} for one browser subscription.
     *
     * @param uaPublicKey the subscription's {@code p256dh}, raw uncompressed P-256 point
     * @param authSecret  the subscription's {@code auth}, 16 random bytes from the browser
     * @return the request body: salt, record size, the sender's public key, then the ciphertext
     */
    public static byte[] encrypt(byte[] uaPublicKey, byte[] authSecret, byte[] plaintext) {
        byte[] salt = new byte[SALT_LENGTH];
        RANDOM.nextBytes(salt);
        return encrypt(uaPublicKey, authSecret, plaintext, generateKeyPair(), salt);
    }

    /**
     * The same encryption with the sender's key pair and salt supplied.
     *
     * Only a test has any business calling this — fixing both is what makes the output
     * reproducible, and therefore comparable to the RFC's worked example.
     */
    static byte[] encrypt(byte[] uaPublicKey, byte[] authSecret, byte[] plaintext,
                          KeyPair senderKeys, byte[] salt) {
        try {
            byte[] senderPublic = rawPublicKey((ECPublicKey) senderKeys.getPublic());

            KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
            agreement.init(senderKeys.getPrivate());
            agreement.doPhase(publicKeyFrom(uaPublicKey), true);
            byte[] sharedSecret = agreement.generateSecret();

            // The auth secret salts the shared secret, so knowing the ECDH result is not
            // enough: an attacker also needs the value the browser gave only to us.
            byte[] ikm = hkdf(authSecret, sharedSecret,
                    concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII),
                            uaPublicKey, senderPublic), 32);

            byte[] key = hkdf(salt, ikm, label("aes128gcm"), KEY_LENGTH);
            byte[] nonce = hkdf(salt, ikm, label("nonce"), NONCE_LENGTH);

            // 0x02 is the padding delimiter that marks this as the last record.
            byte[] padded = concat(plaintext, new byte[]{2});

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(TAG_BITS, nonce));
            byte[] ciphertext = cipher.doFinal(padded);

            ByteBuffer body = ByteBuffer.allocate(
                    SALT_LENGTH + 4 + 1 + senderPublic.length + ciphertext.length);
            body.put(salt);
            body.putInt(RECORD_SIZE);
            body.put((byte) senderPublic.length);
            body.put(senderPublic);
            body.put(ciphertext);
            return body.array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not encrypt the push message", e);
        }
    }

    /** RFC 8188's info strings, which are what separate the key from the nonce. */
    private static byte[] label(String purpose) {
        return ("Content-Encoding: " + purpose + "\0").getBytes(StandardCharsets.US_ASCII);
    }

    /** HKDF with a single output block, which is all Web Push ever needs. */
    private static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length)
            throws GeneralSecurityException {
        byte[] prk = hmac(salt, ikm);
        byte[] output = hmac(prk, concat(info, new byte[]{1}));
        byte[] truncated = new byte[length];
        System.arraycopy(output, 0, truncated, 0, length);
        return truncated;
    }

    private static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    // ── VAPID (RFC 8292) ────────────────────────────────────────────────────

    /**
     * The {@code Authorization} header value identifying this server to the push service.
     *
     * @param endpoint the subscription endpoint; only its origin is signed over, so one token
     *                 covers every subscription at the same push service
     * @param subject  a mailto: or https: address a push service operator can complain to
     */
    public static String vapidHeader(String endpoint, String subject,
                                     String publicKey, String privateKey) {
        try {
            java.net.URI uri = java.net.URI.create(endpoint);
            String audience = uri.getScheme() + "://" + uri.getHost()
                    + (uri.getPort() == -1 ? "" : ":" + uri.getPort());

            // Twelve hours: comfortably inside the 24-hour ceiling push services enforce,
            // and long enough that clock skew on this machine cannot invalidate it.
            long expiry = Instant.now().plusSeconds(12 * 3600).getEpochSecond();

            String header = URL64.encodeToString(
                    "{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
            String claims = URL64.encodeToString(
                    ("{\"aud\":\"" + audience + "\",\"exp\":" + expiry + ",\"sub\":\"" + subject + "\"}")
                            .getBytes(StandardCharsets.UTF_8));
            String signingInput = header + "." + claims;

            // P1363 gives the raw r||s pair JWS requires; the default DER encoding is rejected.
            Signature signature = Signature.getInstance("SHA256withECDSAinP1363Format");
            signature.initSign(privateKeyFrom(decode(privateKey)));
            signature.update(signingInput.getBytes(StandardCharsets.US_ASCII));
            String token = signingInput + "." + URL64.encodeToString(signature.sign());

            return "vapid t=" + token + ", k=" + publicKey;
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not sign the VAPID token", e);
        }
    }

    // ── Keys ────────────────────────────────────────────────────────────────

    /** The curve every Web Push implementation uses; nothing else is permitted. */
    private static ECParameterSpec p256() throws GeneralSecurityException {
        AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
        parameters.init(new ECGenParameterSpec("secp256r1"));
        return parameters.getParameterSpec(ECParameterSpec.class);
    }

    static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
            return generator.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not generate a key pair", e);
        }
    }

    /** A 65-byte uncompressed point, as the browser and the RFC both write public keys. */
    static ECPublicKey publicKeyFrom(byte[] uncompressed) throws GeneralSecurityException {
        if (uncompressed.length != 65 || uncompressed[0] != 0x04) {
            throw new InvalidKeyException("Not an uncompressed P-256 public key");
        }
        byte[] x = new byte[32];
        byte[] y = new byte[32];
        System.arraycopy(uncompressed, 1, x, 0, 32);
        System.arraycopy(uncompressed, 33, y, 0, 32);

        ECPoint point = new ECPoint(new BigInteger(1, x), new BigInteger(1, y));
        return (ECPublicKey) KeyFactory.getInstance("EC")
                .generatePublic(new ECPublicKeySpec(point, p256()));
    }

    /** A 32-byte scalar, which is how every VAPID generator writes a private key. */
    static ECPrivateKey privateKeyFrom(byte[] scalar) throws GeneralSecurityException {
        return (ECPrivateKey) KeyFactory.getInstance("EC")
                .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, scalar), p256()));
    }

    static byte[] rawPublicKey(ECPublicKey key) {
        byte[] x = unsigned(key.getW().getAffineX());
        byte[] y = unsigned(key.getW().getAffineY());
        byte[] raw = new byte[65];
        raw[0] = 0x04;
        System.arraycopy(x, 0, raw, 1, 32);
        System.arraycopy(y, 0, raw, 33, 32);
        return raw;
    }

    /** Fixed-width, left-padded: a coordinate with a leading zero byte is still 32 bytes. */
    private static byte[] unsigned(BigInteger value) {
        byte[] bytes = value.toByteArray();
        byte[] fixed = new byte[32];
        if (bytes.length <= 32) {
            System.arraycopy(bytes, 0, fixed, 32 - bytes.length, bytes.length);
        } else {
            System.arraycopy(bytes, bytes.length - 32, fixed, 0, 32);
        }
        return fixed;
    }

    /** Browsers send unpadded base64url; some tools pad it. Accept either. */
    public static byte[] decode(String base64url) {
        String value = base64url.trim().replace('+', '-').replace('/', '_');
        int padding = value.indexOf('=');
        return URL64_DECODER.decode(padding < 0 ? value : value.substring(0, padding));
    }

    public static String encode(byte[] bytes) {
        return URL64.encodeToString(bytes);
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) out.writeBytes(part);
        return out.toByteArray();
    }
}
