# Patch records

`0001-SpiderQuick-CZ-1.0.2.patch` is a binary-capable unified diff from the preceding SpiderQuick source tree to the SpiderQuick-CZ 1.0.2 source tree. It records the complete project delta for this release, including Czech localization, release metadata, and compatibility/documentation changes. The repository itself contains the already-patched final source tree; the patch is included for provenance and review, not required by the normal `make` build.

The `.mcaddon` is built directly from the committed `behavior_pack/` and `resource_pack/` trees. This avoids ambiguous patch replay or external source downloads during ordinary builds.
