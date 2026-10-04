package io.eksamadhan.model;

import io.eksamadhan.service.TokenCipher;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.stereotype.Component;

/**
 * Applied to {@link SocialPage#getAccessToken()}: the entity holds the plain token, the column
 * holds it encrypted. Spring builds this converter for Hibernate, so it gets the configured key.
 */
@Component
@Converter
public class EncryptedTokenConverter implements AttributeConverter<String, String> {

    private final TokenCipher cipher;

    public EncryptedTokenConverter(TokenCipher cipher) {
        this.cipher = cipher;
    }

    @Override
    public String convertToDatabaseColumn(String token) {
        return cipher.encrypt(token);
    }

    @Override
    public String convertToEntityAttribute(String stored) {
        return cipher.decrypt(stored);
    }
}
