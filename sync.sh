#!/usr/bin/env bash
# Copies the minigame from the Motivation Atlas branch so this page runs the identical code.
set -e
ATLAS="${ATLAS:-../motivation-atlas-work/motivation-atlas}"
rm -rf src/minigames/any-given-morning
cp -r "$ATLAS/src/minigames/any-given-morning" src/minigames/any-given-morning
cp "$ATLAS/src/lib/dom.ts" src/lib/dom.ts
cp "$ATLAS/src/minigames/types.ts" src/minigames/types.ts
