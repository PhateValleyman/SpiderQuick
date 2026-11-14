#!/usr/bin/env python3
"""Run Node.js syntax checks for every behavior-pack JavaScript source."""
from __future__ import annotations
import argparse
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument("--node", default="node", help="Node.js executable")
	args = parser.parse_args()
	files = sorted((ROOT / "behavior_pack").rglob("*.js"))
	if not files:
		raise SystemExit("No behavior-pack JavaScript files found")
	for file in files:
		result = subprocess.run([args.node, "--check", str(file)], capture_output=True, text=True)
		if result.returncode:
			print(result.stderr, end="")
			raise SystemExit(f"JavaScript syntax check failed: {file.relative_to(ROOT)}")
	print(f"JavaScript syntax check passed: {len(files)} files")


if __name__ == "__main__":
	main()
