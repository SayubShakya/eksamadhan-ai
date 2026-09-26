package io.eksamadhan.repository;

import io.eksamadhan.model.AccountDeletionChallenge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface AccountDeletionChallengeRepository extends JpaRepository<AccountDeletionChallenge, UUID> {

    Optional<AccountDeletionChallenge> findByUserId(UUID userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM AccountDeletionChallenge c WHERE c.userId = :userId")
    int deleteByUserId(UUID userId);
}
