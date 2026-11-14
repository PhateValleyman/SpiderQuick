#!/usr/bin/env python3
"""Create a reproducible source archive (no generated binaries or Git metadata)."""
from __future__ import annotations
import argparse
import gzip
import os
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = "SpiderQuick-CZ-1.0.2"
EXCLUDED_DIRS = {".git", "dist", "__pycache__", "node_modules"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo"}


def source_files() -> list[Path]:
	files: list[Path] = []
	for path in ROOT.rglob("*"):
		relative = path.relative_to(ROOT)
		if any(part in EXCLUDED_DIRS for part in relative.parts):
			continue
		if path.is_file() and path.suffix not in EXCLUDED_SUFFIXES:
			files.append(path)
	return sorted(files, key=lambda item: item.relative_to(ROOT).as_posix())


def main() -> None:
	parser = argparse.ArgumentParser(description="Create a deterministic SpiderQuick source archive")
	parser.add_argument("--output", type=Path, required=True)
	parser.add_argument("--force", action="store_true")
	args = parser.parse_args()
	output = args.output.expanduser().resolve()
	if output.suffixes[-2:] != [".tar", ".gz"]:
		raise ValueError("The source archive filename must end in .tar.gz")
	if output.exists() and not args.force:
		raise FileExistsError(f"Refusing to overwrite existing output without --force: {output}")
	output.parent.mkdir(parents=True, exist_ok=True)
	files = source_files()
	with tempfile.NamedTemporaryFile(prefix="spiderquick-source-", dir=output.parent, delete=False) as temporary:
		temporary_path = Path(temporary.name)
	try:
		with temporary_path.open("wb") as raw:
			with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as compressed:
				with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
					for source in files:
						relative = source.relative_to(ROOT).as_posix()
						info = archive.gettarinfo(str(source), arcname=f"{PACKAGE}/{relative}")
						info.uid = 0
						info.gid = 0
						info.uname = ""
						info.gname = ""
						info.mtime = 0
						with source.open("rb") as handle:
							archive.addfile(info, handle)
		os.replace(temporary_path, output)
	except BaseException:
		if temporary_path.exists():
			temporary_path.unlink()
		raise
	print(f"Created {output} ({output.stat().st_size} bytes; {len(files)} source files)")


if __name__ == "__main__":
	main()
