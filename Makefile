PACKAGE_MAKEFILE := packaging/SpiderQuick/Makefile
DIST_DIR ?= $(CURDIR)/dist

.PHONY: all check test prepare build package install source-archive clean rebuild help

all: package

check test prepare build package install source-archive clean rebuild:
	$(MAKE) -C packaging/SpiderQuick $@ DIST_DIR="$(DIST_DIR)"

help:
	$(MAKE) -f $(PACKAGE_MAKEFILE) help
