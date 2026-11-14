#!/usr/bin/env python3
"""Build one installable .mcaddon from the merged behavior/resource pack folders."""
from __future__ import annotations

import argparse
import json
import os
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKS = (
	("SpiderQuick-Behavior.mcpack", ROOT / "behavior_pack"),
	("SpiderQuick-Resources.mcpack", ROOT / "resource_pack"),
)
FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)


def add_file(archive: zipfile.ZipFile, archive_name: str, source: Path) -> None:
	info = zipfile.ZipInfo(archive_name, date_time=FIXED_ZIP_TIME)
	info.create_system = 3
	info.external_attr = 0o100644 << 16
	info.compress_type = zipfile.ZIP_DEFLATED
	with source.open("rb") as handle:
		archive.writestr(info, handle.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)


def write_pack(output: Path, pack_root: Path) -> None:
	manifest = pack_root / "manifest.json"
	if not manifest.is_file():
		raise RuntimeError(f"Missing pack manifest: {manifest}")
	json.loads(manifest.read_text(encoding="utf-8"))
	with zipfile.ZipFile(output, "w", allowZip64=True) as archive:
		for file in sorted(pack_root.rglob("*")):
			if file.is_file():
				add_file(archive, file.relative_to(pack_root).as_posix(), file)
	with zipfile.ZipFile(output) as archive:
		bad = archive.testzip()
		if bad:
			raise RuntimeError(f"Corrupt .mcpack entry {bad} in {output.name}")
		if "manifest.json" not in archive.namelist():
			raise RuntimeError(f"Pack manifest is not at archive root: {output.name}")
		json.loads(archive.read("manifest.json"))


def main() -> None:
	parser = argparse.ArgumentParser(description="Build a reproducible SpiderQuick .mcaddon.")
	parser.add_argument("--output", type=Path, required=True, help="Output .mcaddon path")
	parser.add_argument("--force", action="store_true", help="Replace this build output")
	args = parser.parse_args()
	output = args.output.expanduser().resolve()
	if output.suffix.lower() != ".mcaddon":
		raise ValueError("The output filename must end in .mcaddon")
	if output.exists() and not args.force:
		raise FileExistsError(f"Refusing to overwrite existing output without --force: {output}")
	output.parent.mkdir(parents=True, exist_ok=True)
	with tempfile.TemporaryDirectory(prefix="spiderquick-build-", dir=output.parent) as temp_name:
		temp = Path(temp_name)
		pack_files: list[tuple[str, Path]] = []
		for filename, pack_root in PACKS:
			pack_file = temp / filename
			write_pack(pack_file, pack_root)
			pack_files.append((filename, pack_file))
		temporary_output = temp / output.name
		with zipfile.ZipFile(temporary_output, "w", allowZip64=True) as archive:
			for filename, pack_file in pack_files:
				add_file(archive, filename, pack_file)
		with zipfile.ZipFile(temporary_output) as archive:
			bad = archive.testzip()
			if bad:
				raise RuntimeError(f"Corrupt .mcaddon entry {bad}")
			if archive.namelist() != [name for name, _ in pack_files]:
				raise RuntimeError("The .mcaddon must contain exactly the behavior and resource packs")
		os.replace(temporary_output, output)
	print(json.dumps({
		"output": str(output),
		"sizeBytes": output.stat().st_size,
		"packs": [name for name, _ in pack_files],
		"deterministicZipMetadata": True,
	}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
	main()
