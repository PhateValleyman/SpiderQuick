#!/usr/bin/env python3
"""Validate the merged Minecraft Bedrock add-on without launching the game."""
from __future__ import annotations

import json
import re
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / "behavior_pack"
RP = ROOT / "resource_pack"
ERRORS: list[str] = []
WARNINGS: list[str] = []


def fail(message: str) -> None:
	ERRORS.append(message)


def strip_jsonc(text: str) -> str:
	out: list[str] = []
	i = 0
	in_string = False
	escaped = False
	while i < len(text):
		ch = text[i]
		if in_string:
			out.append(ch)
			if escaped:
				escaped = False
			elif ch == "\\":
				escaped = True
			elif ch == '"':
				in_string = False
			i += 1
			continue
		if ch == '"':
			in_string = True
			out.append(ch)
			i += 1
			continue
		if ch == "/" and i + 1 < len(text) and text[i + 1] == "/":
			i += 2
			while i < len(text) and text[i] not in "\r\n":
				i += 1
			continue
		if ch == "/" and i + 1 < len(text) and text[i + 1] == "*":
			i += 2
			while i + 1 < len(text) and text[i:i + 2] != "*/":
				i += 1
			i = min(len(text), i + 2)
			continue
		out.append(ch)
		i += 1
	cleaned = "".join(out)
	# Bedrock JSONC permits trailing commas; strip them only before a close token.
	return re.sub(r",(\s*[}\]])", r"\1", cleaned)


def load_jsonc(path: Path):
	duplicates: list[str] = []
	def pairs_hook(pairs):
		result = {}
		for key, value in pairs:
			if key in result:
				duplicates.append(key)
			result[key] = value
		return result
	try:
		value = json.loads(strip_jsonc(path.read_text(encoding="utf-8")), object_pairs_hook=pairs_hook)
	except Exception as exc:
		fail(f"JSONC parse failed: {path.relative_to(ROOT)}: {exc}")
		return None
	if duplicates:
		fail(f"Duplicate JSON key(s) in {path.relative_to(ROOT)}: {', '.join(sorted(set(duplicates)))}")
	return value


def valid_uuid(value: str) -> bool:
	try:
		uuid.UUID(value)
		return True
	except (ValueError, TypeError, AttributeError):
		return False


def local_texture_path(value: str) -> bool:
	if not value.startswith("textures/"):
		return True
	path = RP / value
	if path.suffix:
		return path.is_file()
	return any(Path(str(path) + ext).is_file() for ext in (".png", ".tga", ".jpg", ".jpeg"))


# Validate every JSON/JSONC file in the packs, including strict JSON manifests.
json_files = sorted([*BP.rglob("*.json"), *RP.rglob("*.json")])
parsed: dict[Path, object] = {}
for file in json_files:
	parsed[file] = load_jsonc(file)

bp_manifest = parsed.get(BP / "manifest.json")
rp_manifest = parsed.get(RP / "manifest.json")
known_uuids: set[str] = set()
seen_uuids: dict[str, str] = {}
pack_headers: dict[str, str] = {}

for pack_name, manifest in (("behavior_pack", bp_manifest), ("resource_pack", rp_manifest)):
	if not isinstance(manifest, dict):
		fail(f"Missing/invalid {pack_name}/manifest.json")
		continue
	header = manifest.get("header", {})
	expected_name = "SpiderQuick — balíček chování" if pack_name == "behavior_pack" else "SpiderQuick — balíček prostředků"
	if not isinstance(header, dict) or header.get("name") != expected_name:
		fail(f"Unexpected user-facing pack name in {pack_name}: {header.get('name') if isinstance(header, dict) else header}")
	if isinstance(header, dict) and header.get("version") != [1, 0, 2]:
		fail(f"Unexpected header version in {pack_name}: {header.get('version')}")
	authors = manifest.get("metadata", {}).get("authors", []) if isinstance(manifest.get("metadata"), dict) else []
	if authors != ["PhateValleyman <Jonas.Ned@outlook.com>"]:
		fail(f"Unexpected author metadata in {pack_name}: {authors}")
	header_uuid = header.get("uuid") if isinstance(header, dict) else None
	if not valid_uuid(header_uuid):
		fail(f"Invalid header UUID in {pack_name}")
	else:
		pack_headers[pack_name] = header_uuid
		known_uuids.add(header_uuid)
		seen_uuids[header_uuid] = f"{pack_name} header"
	modules = manifest.get("modules", [])
	if not isinstance(modules, list) or not modules:
		fail(f"{pack_name} has no modules")
		modules = []
	for index, module in enumerate(modules):
		module_uuid = module.get("uuid") if isinstance(module, dict) else None
		if not valid_uuid(module_uuid):
			fail(f"Invalid module UUID in {pack_name} module {index}")
			continue
		if module.get("version") != [1, 0, 2]:
			fail(f"Unexpected module version in {pack_name} module {index}: {module.get('version')}")
		if module_uuid in seen_uuids:
			fail(f"Duplicate UUID {module_uuid}: {seen_uuids[module_uuid]} and {pack_name} module {index}")
		seen_uuids[module_uuid] = f"{pack_name} module {index}"
		known_uuids.add(module_uuid)
		minimum = header.get("min_engine_version") if isinstance(header, dict) else None
		if minimum != [1, 21, 80]:
			fail(f"Unexpected min_engine_version in {pack_name}: {minimum}")

# All declared pack UUID dependencies must resolve to a pack or module UUID.
for pack_name, manifest in (("behavior_pack", bp_manifest), ("resource_pack", rp_manifest)):
	if not isinstance(manifest, dict):
		continue
	for dependency in manifest.get("dependencies", []) or []:
		if isinstance(dependency, dict) and "uuid" in dependency:
			dep_uuid = dependency["uuid"]
			if dep_uuid not in known_uuids:
				fail(f"Unresolved manifest dependency in {pack_name}: {dep_uuid}")

if isinstance(bp_manifest, dict) and isinstance(rp_manifest, dict):
	bp_deps = bp_manifest.get("dependencies", [])
	rp_deps = rp_manifest.get("dependencies", [])
	for manifest_name, dependencies, target_name, target_manifest in (
		("behavior_pack", bp_deps, "resource_pack", rp_manifest),
		("resource_pack", rp_deps, "behavior_pack", bp_manifest),
	):
		matching = [dep for dep in dependencies if isinstance(dep, dict) and dep.get("uuid") == pack_headers.get(target_name)]
		if len(matching) != 1:
			fail(f"{manifest_name} must have exactly one dependency on {target_name}")
		elif matching[0].get("version") != target_manifest.get("header", {}).get("version"):
			fail(f"{manifest_name} dependency version does not match {target_name}")
	script_modules = [m for m in bp_manifest.get("modules", []) if isinstance(m, dict) and m.get("type") == "script"]
	if len(script_modules) != 1:
		fail(f"Expected exactly one BP script module, got {len(script_modules)}")
	else:
		entry = script_modules[0].get("entry")
		if not isinstance(entry, str) or not (BP / entry).is_file():
			fail(f"Missing script module entry: {entry}")
	api_deps = {d.get("module_name"): d.get("version") for d in bp_deps if isinstance(d, dict) and d.get("module_name")}
	if api_deps.get("@minecraft/server") != "2.0.0":
		fail("BP must declare @minecraft/server 2.0.0")
	if api_deps.get("@minecraft/server-ui") != "2.0.0":
		fail("BP must declare @minecraft/server-ui 2.0.0")

# Check that atlas entries point to files inside the RP when they are custom textures.
atlas_report = {}
for atlas_name in ("item_texture.json", "terrain_texture.json"):
	atlas_path = RP / "textures" / atlas_name
	atlas = parsed.get(atlas_path)
	data = atlas.get("texture_data", {}) if isinstance(atlas, dict) else {}
	if isinstance(atlas, dict) and atlas.get("resource_pack_name") != "SpiderQuick":
		fail(f"Unexpected resource pack name in {atlas_name}")
	if not isinstance(data, dict):
		fail(f"Invalid texture_data in {atlas_name}")
		continue
	checked = 0
	missing_custom: list[str] = []
	for key, entry in data.items():
		values = entry.get("textures") if isinstance(entry, dict) else None
		if isinstance(values, str):
			values = [values]
		elif not isinstance(values, list):
			continue
		for value in values:
			if not isinstance(value, str) or not value.startswith("textures/"):
				continue
			checked += 1
			custom = any(token in value.lower() or token in key.lower() for token in ("spider", "venom", "qc_", "quickcraft", "black_cat", "miles", "web"))
			if custom and not local_texture_path(value):
				missing_custom.append(f"{key} -> {value}")
	if missing_custom:
		for item in missing_custom:
			fail(f"Missing custom atlas texture in {atlas_name}: {item}")
	atlas_report[atlas_name] = {"entries": len(data), "localPathsChecked": checked, "missingCustom": missing_custom}

item_atlas = parsed.get(RP / "textures" / "item_texture.json")
item_data = item_atlas.get("texture_data", {}) if isinstance(item_atlas, dict) else {}
if "qc_menu" not in item_data:
	fail("QuickCraft qc_menu texture atlas entry is missing")
menu_item = parsed.get(BP / "items" / "qc_menu.json")
menu_display = menu_item.get("minecraft:item", {}).get("components", {}).get("minecraft:display_name", {}).get("value") if isinstance(menu_item, dict) else None
if menu_display != "SpiderQuick — stavební menu":
	fail(f"Unexpected SpiderQuick menu item display name: {menu_display}")
ui_theme = parsed.get(RP / "ui" / "server_form.json")
theme_binding = ui_theme.get("quickcraft_shell", {}).get("bindings", [{}])[0].get("source_property_name", "") if isinstance(ui_theme, dict) else ""
if "SpiderQuick" not in theme_binding:
	fail("Resource-pack UI theme does not target SpiderQuick form titles")

item_icon_refs = 0
def check_item_icons(value, source: Path) -> None:
	global item_icon_refs
	if isinstance(value, dict):
		icon = value.get("minecraft:icon")
		if isinstance(icon, dict):
			texture = icon.get("texture")
			if isinstance(texture, str):
				item_icon_refs += 1
				custom = any(token in texture.lower() for token in ("spider", "venom", "qc_", "quickcraft", "black_cat", "miles", "web"))
				if custom and texture not in item_data and (not texture.startswith("textures/") or not local_texture_path(texture)):
					fail(f"Unresolved item icon in {source.relative_to(ROOT)}: {texture}")
		for child in value.values():
			check_item_icons(child, source)
	elif isinstance(value, list):
		for child in value:
			check_item_icons(child, source)

for item_file in sorted((BP / "items").rglob("*.json")) if (BP / "items").exists() else []:
	check_item_icons(parsed.get(item_file), item_file)

# QuickCraft's supported opening routes must remain available; do not advertise the removed chat event.
main_js = BP / "scripts" / "main.js"
if main_js.is_file():
	main_text = main_js.read_text(encoding="utf-8")
	if "qc:menu" not in main_text:
		fail("QuickCraft script-event route qc:menu is missing")
	if "chatSend" in main_text:
		fail("Unsupported world.beforeEvents.chatSend remains in QuickCraft main.js")
else:
	fail("QuickCraft main.js is missing")

swing_impulse = BP / "scripts" / "web_shooter" / "swing_impulse.js"
if swing_impulse.is_file():
	text = swing_impulse.read_text(encoding="utf-8")
	if "runOptionalGlobalHandler" not in text or "super_slingshot_slow(player);" in text or "super_slingshot_full(player);" in text:
		fail("Optional slingshot handler is not fail-safe")

kick_effect = BP / "scripts" / "spiderman" / "kick_effect.js"
if kick_effect.is_file():
	text = kick_effect.read_text(encoding="utf-8")
	if "player.setVelocity" in text or "player.velocity" in text:
		fail("Unsupported direct velocity API remains in kick_effect.js")

structure_files = sorted((BP / "structures").rglob("*.mcstructure")) if (BP / "structures").exists() else []
if not structure_files:
	fail("QuickCraft structure assets are missing")
for structure in structure_files:
	if structure.stat().st_size == 0:
		fail(f"Empty structure asset: {structure.relative_to(ROOT)}")

bp_icon = BP / "pack_icon.png"
rp_icon = RP / "pack_icon.png"
shared_icon_ok = bp_icon.is_file() and rp_icon.is_file() and bp_icon.read_bytes() == rp_icon.read_bytes()
if not shared_icon_ok:
	fail("Behavior and resource pack icons are missing or not identical")
localized_pack_title_files = []
for language_file in sorted((RP / "texts").glob("*.lang")):
	names = [line.split("=", 1)[1] for line in language_file.read_text(encoding="utf-8-sig").splitlines() if line.startswith("pack.name=")]
	if names != ["SpiderQuick"]:
		fail(f"Localized pack name is not SpiderQuick exactly once in {language_file.name}")
	else:
		localized_pack_title_files.append(language_file.name)

def parse_lang(path: Path, check_duplicates: bool = True):
	entries = {}
	duplicates = []
	orphan_lines = []
	for line_number, raw in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
		line = raw.strip()
		if not line or line.startswith("#"):
			continue
		if "=" not in raw:
			orphan_lines.append((line_number, line))
			continue
		key, value = raw.split("=", 1)
		key = key.strip()
		if key in entries:
			duplicates.append(key)
		entries[key] = value
	if duplicates and check_duplicates:
		fail(f"Duplicate localization keys in {path.name}: {', '.join(sorted(set(duplicates)))}")
	return entries, orphan_lines

texts_dir = RP / "texts"
en_path = texts_dir / "en_US.lang"
cs_path = texts_dir / "cs_CZ.lang"
locale_report = {"englishKeys": 0, "czechKeys": 0, "missingCzechKeys": [], "unchangedValues": 0, "placeholdersChecked": 0}
if en_path.is_file() and cs_path.is_file():
	en_entries, en_orphans = parse_lang(en_path, check_duplicates=False)
	cs_entries, cs_orphans = parse_lang(cs_path)
	missing = sorted(set(en_entries) - set(cs_entries))
	extra = sorted(set(cs_entries) - set(en_entries))
	if missing or extra:
		fail(f"English/Czech locale key sets differ: missing in Czech={len(missing)}, extra in Czech={len(extra)}")
	placeholder_re = re.compile(r"%(?:[0-9]+[$])?[A-Za-z]+|%[0-9]+")
	color_re = re.compile(r"§[0-9a-fk-or]", re.IGNORECASE)
	placeholder_checks = 0
	for key in set(en_entries) & set(cs_entries):
		if placeholder_re.findall(en_entries[key]) != placeholder_re.findall(cs_entries[key]):
			fail(f"Locale placeholder mismatch for {key}")
		if color_re.findall(en_entries[key]) != color_re.findall(cs_entries[key]):
			fail(f"Locale formatting-code mismatch for {key}")
		placeholder_checks += 1
	unchanged = sum(en_entries[key].strip() == cs_entries[key].strip() for key in set(en_entries) & set(cs_entries))
	if en_orphans != [(88, "§fUpgrade cost: §a%3 experience levels")]:
		fail("Unexpected English locale line without a key")
	if cs_orphans != [(88, "§fCena vylepšení: §a%3 úrovní zkušeností")]:
		fail("The unkeyed Czech upgrade-cost text is missing or changed")
	locale_report = {"englishKeys": len(en_entries), "czechKeys": len(cs_entries), "missingCzechKeys": missing, "unchangedValues": unchanged, "placeholdersChecked": placeholder_checks}
else:
	fail("Expected en_US.lang and cs_CZ.lang locale files")

notice_text = "Obsah je volně šiřitelný."
for notice_path in (ROOT / "DISTRIBUTION_NOTICE.txt", BP / "DISTRIBUTION_NOTICE.txt", RP / "DISTRIBUTION_NOTICE.txt"):
	if not notice_path.is_file() or notice_text not in notice_path.read_text(encoding="utf-8"):
		fail(f"Missing free-redistribution notice: {notice_path.relative_to(ROOT)}")

result = {
	"project": ROOT.name,
	"jsoncFiles": len(json_files),
	"uniquePackAndModuleUuids": len(seen_uuids),
	"dependencyDirection": "mutual behavior pack <-> resource pack (configured, not runtime-tested)",
	"sharedPackIconIdentical": shared_icon_ok,
	"localizedSpiderQuickPackTitles": len(localized_pack_title_files),
	"localization": locale_report,
	"author": "PhateValleyman <Jonas.Ned@outlook.com>",
	"packVersion": "1.0.2",
	"scriptTarget": {"minecraftServer": "2.0.0", "minecraftServerUi": "2.0.0", "minEngine": "1.21.80"},
	"quickCraftStructures": len(structure_files),
	"itemIconReferences": item_icon_refs,
	"textureAtlases": atlas_report,
	"errors": ERRORS,
	"warnings": WARNINGS,
}
print(json.dumps(result, indent=2, ensure_ascii=False))
if ERRORS:
	sys.exit(1)
