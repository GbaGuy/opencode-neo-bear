# Install opencode-neo-bear

## For humans: let OpenCode do it

Open OpenCode (v2) and send it this message:

```text
Install opencode-neo-bear for me by following https://raw.githubusercontent.com/GbaGuy/opencode-neo-bear/main/INSTALL.md
```

It follows the steps below, then asks you to quit and reopen OpenCode. Prefer doing it by hand?
See the manual install in the [README](README.md#manual-install).

---

## For the AI agent: steps to follow

You are an AI coding agent (for example OpenCode) installing **opencode-neo-bear** for the user.
The quickest correct way is to run the repo's installer, which does steps 3–5 below:
`curl -fsSL https://raw.githubusercontent.com/GbaGuy/opencode-neo-bear/main/install.sh | sh`.
If you cannot run it (no python3, curl or tar), follow the steps by hand.
Follow these steps exactly, using shell commands. Do not modify anything outside the OpenCode
config directory, and do not remove or reorder anything the user already has.

## 1. Check the OpenCode version

Run `opencode --version`. This needs OpenCode **2.x**. If it is 1.x, stop and tell the user to
upgrade OpenCode first (these plugins use the v2 TUI plugin API and `cli.json`).

## 2. Find the config directory

Use `$XDG_CONFIG_HOME/opencode` if `XDG_CONFIG_HOME` is set, otherwise `~/.config/opencode`.
Call it `CONF` below. Create it if missing.

## 3. Get the files

```sh
tmp=$(mktemp -d)
git clone --depth 1 https://github.com/GbaGuy/opencode-neo-bear "$tmp/neo-bear"
mkdir -p "$CONF/themes" "$CONF/tui-plugins"
```

Copy, but never overwrite a file that already exists and differs without asking the user first:

- `$tmp/neo-bear/themes/neo.json` → `$CONF/themes/neo.json`
- `$tmp/neo-bear/plugins/neo-bear/` → `$CONF/tui-plugins/neo-bear/`
- `$tmp/neo-bear/plugins/model-button/` → `$CONF/tui-plugins/model-button/`

Each plugin folder must contain `tui.tsx` (OpenCode loads the folder and compiles `tui.tsx` itself).

## 4. Register the theme and plugins in `$CONF/cli.json`

`cli.json` is plain JSON. Edit it with a JSON-aware tool (for example a short Python or `jq`
script), never by hand-splicing text:

- If the file does not exist, create `{"$schema": "https://opencode.ai/v2/cli.json"}`.
- Set `theme.name` to `"neo"`, keeping any other keys inside `theme` (such as `mode`).
- Append the **absolute** paths `"$CONF/tui-plugins/model-button"` and
  `"$CONF/tui-plugins/neo-bear"` to the `plugins` array if they are not already there.
  Keep every existing entry and its order.
- Leave all other keys untouched.

Do not put these entries in `opencode.json` / `opencode.jsonc`: those list *server* plugins, and a
TUI plugin listed there fails to load.

## 5. Verify

- `python3 -m json.tool "$CONF/cli.json"` (or `jq . "$CONF/cli.json"`) parses without errors.
- `$CONF/themes/neo.json`, `$CONF/tui-plugins/neo-bear/tui.tsx` and
  `$CONF/tui-plugins/model-button/tui.tsx` exist.

## 6. Finish

Remove the temporary clone, then tell the user:

> Installed. Quit and reopen OpenCode to see the neo theme, the bear welcome screen and the ⇄
> model button. Switch themes any time with `/theme`. To undo, remove the two plugin paths from
> `cli.json`, set another theme, and delete `tui-plugins/neo-bear`, `tui-plugins/model-button`
> and `themes/neo.json`.

Do not restart or kill the user's running OpenCode yourself.
