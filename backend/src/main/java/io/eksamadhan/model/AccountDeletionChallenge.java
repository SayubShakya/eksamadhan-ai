package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Where someone is in deleting their account. The server's record, not the browser's: each
 * step moves `stage` on only when it is done, and the final delete is refused unless the
 * stage is FINAL. Expires after a few minutes and is removed when the account is deleted.
 */
@Entity
@Table(name = "account_deletion_challenges")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccountDeletionChallenge {

    /** 0 read what goes, 1 typed DELETE, 2 proved the email, 3 entered the code, 4 last chance. */
    public static final int READ = 0, TYPE_WORD = 1, IDENTITY = 2, CODE = 3, FINAL = 4;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(nullable = false)
    private int stage;

    /** SHA-256 of the code and this challenge's id: the code itself is never stored. */
    @Column(name = "code_hash", length = 64)
    private String codeHash;

    @Column(name = "code_sent_at")
    private OffsetDateTime codeSentAt;

    @Column(name = "code_sends", nullable = false)
    private int codeSends;

    @Column(name = "code_attempts", nullable = false)
    private int codeAttempts;

    /** Only for a tenant: who becomes the tenant when this account is deleted. */
    @Column(name = "successor_id")
    private UUID successorId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;
}
