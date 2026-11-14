# SpiderQuick-CZ package recipe

This directory follows the package-recipe separation used by FFP 0.7 source trees: package identity/version are declared in `Makefile`, provenance inputs live under `sources/`, patch records live under `patches/`, and `check`, `prepare`, `build`, `install`, `package`, and `clean` are separate targets.

The packaged product is a Minecraft Bedrock `.mcaddon`, not an FFP package. The recipe uses the source files committed at the repository root, checks pack manifests and JavaScript, builds both `.mcpack` files, then bundles them into the addon. The upstream archives are retained as provenance inputs; no network fetch, checksum, or signature is required to reproduce the committed addon.
