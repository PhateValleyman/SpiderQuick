# Upstream source inputs

This directory preserves the source inputs used to assemble SpiderQuick-CZ 1.0.2. The two original Minecraft Bedrock pack archives are stored byte-for-byte as `.mcpack` files. The QuickCraft source snapshot is exported from the clean local checkout of `PhateValleyman/QuickCraft` on its `master` branch and stored as a tar.gz archive. No MD5/SHA checksums or digital signatures are used.

- `Spider-Man BehaviorPack.mcpack` — original behavior-pack archive.
- `Spider-Man TexturePack.mcpack` — original resource-pack archive.
- `QuickCraft-master-2026-11-14.tar.gz` — tracked QuickCraft source snapshot from `origin/master` as present in the task workspace on 2026-11-14.

The complete committed SpiderQuick-CZ 1.0.2 pack source is also stored at the repository root. `patches/0001-SpiderQuick-CZ-1.0.2.patch` records the source-tree delta from the preceding SpiderQuick tree to this Czech release. The build recipe consumes the committed pack directories directly, so a fresh checkout can build without network access or unpacking the provenance archives.
