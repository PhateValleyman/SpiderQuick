PACKAGE_NAME := SpiderQuick-CZ
PACKAGE_VERSION := 1.0.2
ROOT := $(abspath ../..)
DIST_DIR ?= $(ROOT)/dist
OUTPUT := $(DIST_DIR)/$(PACKAGE_NAME)-$(PACKAGE_VERSION).mcaddon
SOURCE_ARCHIVE := $(DIST_DIR)/$(PACKAGE_NAME)-$(PACKAGE_VERSION)-source.tar.gz
PYTHON ?= python3
NODE ?= node

.PHONY: all check test prepare build package install source-archive clean rebuild help

all: package

check:
	$(PYTHON) $(ROOT)/tools/validate_merge.py
	$(PYTHON) $(ROOT)/tools/check_scripts.py --node "$(NODE)"
	$(NODE) $(ROOT)/tools/test_optional_handlers.cjs
	$(NODE) $(ROOT)/tools/test_command_compat.cjs
	$(NODE) $(ROOT)/tools/test_structure_safety.cjs

# The pack sources are committed directly; no configure or compile step is needed.
prepare: check
	test -f "$(ROOT)/behavior_pack/manifest.json"
	test -f "$(ROOT)/resource_pack/manifest.json"

build: prepare
	mkdir -p "$(DIST_DIR)"
	$(PYTHON) $(ROOT)/tools/package_addon.py --output "$(OUTPUT)" --force

package: build

install: package
	install -D -m 0644 "$(OUTPUT)" "$(DESTDIR)/usr/share/minecraft/bedrock/addons/$(PACKAGE_NAME)-$(PACKAGE_VERSION).mcaddon"

source-archive: check
	mkdir -p "$(DIST_DIR)"
	$(PYTHON) $(ROOT)/tools/make_source_archive.py --output "$(SOURCE_ARCHIVE)" --force

clean:
	if test -d "$(DIST_DIR)"; then find "$(DIST_DIR)" -maxdepth 1 -type f \( -name '$(PACKAGE_NAME)-$(PACKAGE_VERSION).mcaddon' -o -name '$(PACKAGE_NAME)-$(PACKAGE_VERSION)-source.tar.gz' \) -delete; fi

rebuild: clean package

help:
	@printf '%s\n' 'SpiderQuick-CZ 1.0.2 build targets:' \
		'  all, package    validate and build the .mcaddon' \
		'  check, test     validate packs and JavaScript' \
		'  prepare         run checks and verify pack manifests' \
		'  build           create the installable .mcaddon' \
		'  install         install under DESTDIR/usr/share/minecraft/bedrock/addons' \
		'  source-archive  create a reproducible source bundle' \
		'  clean           remove only this version’s generated artifacts' \
		'  rebuild         clean and rebuild the .mcaddon'
