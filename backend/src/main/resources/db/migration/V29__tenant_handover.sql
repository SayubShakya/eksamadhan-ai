-- A tenant may delete their account once they have named who takes the workspace over.
-- The choice is held on the deletion record and acted on only at the final step, in the same
-- transaction as the deletion, so stopping part way leaves the workspace exactly as it was.
ALTER TABLE account_deletion_challenges
    ADD COLUMN successor_id uuid REFERENCES users (id) ON DELETE SET NULL;
