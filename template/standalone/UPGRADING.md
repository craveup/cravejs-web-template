# Upgrade Contract

The external CLI and upgrade engine are not implemented yet. There is currently no local generation,
upgrade, or provenance command, and this content pack must not be copied by hand as evidence of a
generated project.

## Future Release Selection

An accepted upgrade will select one immutable semantic template release, exact 40-character reviewed
commit, artifact checksum, exact SDK/API/config-schema identities, and compatible CLI version. It
will reject branches, mutable archives, aliases, workspace checkouts, private source coordinates, or
mismatched release metadata.

The generated project's immutable `projectId` remains unchanged. Changing that identifier creates a
different project rather than upgrading the existing one.

## Non-Destructive Changes

Before writing files, the future upgrade flow will:

1. verify the target release and checksum;
2. compare the recorded project provenance with the compatibility policy;
3. show a deterministic dry-run and file diff;
4. identify required environment/configuration changes;
5. stop on modified template-owned files or ownership conflicts;
6. preserve user-owned content and extension files; and
7. require explicit approval before applying a compatible change.

An upgrade never silently overwrites user work. Mechanical compatible changes may use a reviewed
codemod; semantic or major changes require a migration guide.

## Verification And Rollback

After a future upgrade, run a frozen install, verification, production build, both-profile-safe
checks, core browser journeys, accessibility checks, and private-reference scans. Rollback restores
the previous immutable release and provenance record without deleting user-owned content.

Until the external implementation and signed release evidence exist, generated-project upgrade and
rollback acceptance remain pending.
