#!/bin/sh
# Install opencode-neo-bear: the neo theme + the neo-bear and model-button TUI plugins.
#   curl -fsSL https://raw.githubusercontent.com/GbaGuy/opencode-neo-bear/main/install.sh | sh
# or, from a clone:  ./install.sh
# Needs OpenCode 2.x, python3 (to edit cli.json safely), and curl + tar when run through the pipe.
set -eu

REPO="https://codeload.github.com/GbaGuy/opencode-neo-bear/tar.gz/main"
CONF="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"

say() { printf '\033[38;2;91;140;255m›\033[0m %s\n' "$*"; }
die() { printf '\033[38;2;248;113;113m✗\033[0m %s\n' "$*" >&2; exit 1; }

command -v python3 >/dev/null || die "python3 is needed to update cli.json"
if command -v opencode >/dev/null; then
    v=$(opencode --version 2>/dev/null | sed 's/[^0-9.]//g')
    case "$v" in 2.*|"") ;; *) die "OpenCode $v found; this needs OpenCode 2.x" ;; esac
else
    say "opencode not found on PATH; installing the files anyway"
fi

# use the files next to this script (a clone), otherwise download the repo
SRC=""
case "$0" in */*) d=$(cd "$(dirname "$0")" && pwd); [ -f "$d/themes/neo.json" ] && SRC="$d" ;; esac
if [ -z "$SRC" ]; then
    command -v curl >/dev/null && command -v tar >/dev/null || die "curl and tar are needed"
    TMP=$(mktemp -d)
    trap 'rm -r "$TMP"' EXIT
    say "downloading opencode-neo-bear"
    curl -fsSL "$REPO" | tar -xz -C "$TMP"
    SRC="$TMP/opencode-neo-bear-main"
fi

# copy one file, keeping a .bak of a different file that was already there
put() {
    mkdir -p "$(dirname "$2")"
    if [ -f "$2" ] && ! cmp -s "$1" "$2"; then
        cp "$2" "$2.bak"
        say "kept your old $(basename "$2") as $(basename "$2").bak"
    fi
    cp "$1" "$2"
}
put "$SRC/themes/neo.json" "$CONF/themes/neo.json"
put "$SRC/plugins/neo-bear/tui.tsx" "$CONF/tui-plugins/neo-bear/tui.tsx"
put "$SRC/plugins/model-button/tui.tsx" "$CONF/tui-plugins/model-button/tui.tsx"

# cli.json: set the theme, append the two plugin folders, keep everything else
python3 - "$CONF" <<'PY'
import json, os, sys
conf = sys.argv[1]
path = os.path.join(conf, "cli.json")
cfg = {"$schema": "https://opencode.ai/v2/cli.json"}
if os.path.exists(path):
    with open(path) as f:
        cfg = json.load(f)
theme = cfg.get("theme") if isinstance(cfg.get("theme"), dict) else {}
cfg["theme"] = {**theme, "name": "neo"}
plugins = cfg.get("plugins") or []
for name in ("model-button", "neo-bear"):
    p = os.path.join(conf, "tui-plugins", name)
    if p not in plugins:
        plugins.append(p)
cfg["plugins"] = plugins
tmp = path + ".tmp"
with open(tmp, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
os.replace(tmp, path)
PY

say "installed into $CONF"
say "quit and reopen OpenCode to see it (switch themes any time with /theme)"
