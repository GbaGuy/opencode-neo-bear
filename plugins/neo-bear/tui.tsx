/** @jsxImportSource @opentui/solid */
// neo-bear: a Claude Code–style home screen for OpenCode v2 (TUI plugin):
//  - home screen: the big logo hidden, a welcome box with "Pip" (a small original mascot) at the
//    top and the prompt at the bottom, Claude Code style
//  - prompt footer: "✻ Noodling… (12s · esc to interrupt)" while the model works
//  - sidebar: Pip bobs and blinks while working, dozes when idle
// Loaded from cli.json "plugins" as this folder; OpenCode takes the TUI entry from ./tui.tsx.
import { createSignal, onCleanup, Show } from "solid-js"

// Colours come from the active OpenCode theme (follows /theme): the theme's accent (markdown
// heading colour), its text, muted text and comment grey. The hex values are fallbacks only.
let host: any // the plugin context; host.theme is a live getter, so /theme changes apply
const pick = (get: () => any, fallback: string) => {
  try {
    return get() ?? fallback
  } catch {
    return fallback
  }
}
const ACCENT = () => pick(() => host.theme.markdown.heading, "#D77757")
const SOFT = () => pick(() => host.theme.markdown.link, "#B1B9F9")
const TEXT = () => pick(() => host.theme.text.base, "#FFFFFF")
const MUTED = () => pick(() => host.theme.text.muted, "#999999")
const DIM = () => pick(() => host.theme.syntax.comment, "#666666")

const TIPS = [
  "tip: @ mentions a file or agent",
  "tip: ctrl+p opens the command palette",
  "tip: esc interrupts the model",
  "tip: /theme: switch colours",
  "tip: /models lists every model",
  "tip: Tab switches agents",
]
const STARS = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"]
const VERBS = [
  "Noodling", "Pondering", "Percolating", "Tinkering", "Conjuring", "Brewing", "Musing",
  "Simmering", "Wrangling", "Doodling", "Scheming", "Puzzling", "Whirring", "Cogitating",
]

// Pip: a small, original geometric bear head in half-block pixel art (2 pixels per character
// cell, so this 15x12 sprite is 15 columns x 6 rows). Flat, modern colours.
// Pixels: B fur, S fur shade, T muzzle / inner ear, N nose, E eye, W eye glint, . empty.
type Mood = "happy" | "work" | "sleep"
const SPRITE = [
  ".BBB.......BBB.",
  "BBTTB.....BTTBB",
  "BBTBBBBBBBBBTBB",
  "BBBBBBBBBBBBBBB",
  "BBBWEBBBBBWEBBB",
  "BBBEEBBBBBEEBBB",
  "BBBBBBBBBBBBBBB",
  "SBBBBTTTTTBBBBS",
  ".SBBTTNNNTTBBS.",
  "..SBTTTNTTTBS..",
  "...SSTTTTTSS...",
  ".....SSSSS.....",
]
const PIP: Record<string, string> = { B: "#A0673F", S: "#7A4B2C", T: "#E8C39E", N: "#2A1E18", E: "#1A1412", W: "#FFFFFF" }
const GLOW = ["#2DD4BF", "#3FB8E0", "#4F9DFB", "#5B8CFF", "#4F9DFB", "#3FB8E0"] // teal <-> blue
const EYES = [3, 4, 10, 11] // 2x2 eyes on rows 4-5

function pipPixels(frame: number, mood: Mood): string[] {
  const rows = SPRITE.map((r) => r.split(""))
  const closed = () => {
    for (const x of EYES) {
      rows[4][x] = "B"
      rows[5][x] = "E" // a calm closed line
    }
  }
  if (mood === "sleep") closed()
  else if (mood === "work") {
    // glances around (the glint moves) and the ears bob
    if (Math.floor(frame / 6) % 2) for (const [l, r] of [[3, 4], [10, 11]]) [rows[4][l], rows[4][r]] = ["E", "W"]
    if (frame % 8 < 2) rows[0] = "...............".split("")
  } else if (frame % 45 === 0) closed() // blink
  return rows.map((r) => r.join(""))
}

let glowFrame = 0
const pixelColor = (c: string) => (c === "G" ? GLOW[glowFrame % GLOW.length] : PIP[c])

// two pixel rows -> one text row of half blocks ("▀": fg = top pixel, bg = bottom pixel)
function PipArt(props: { frame: number; mood: Mood }) {
  const lines = () => {
    glowFrame = Math.floor(props.frame / (props.mood === "work" ? 1 : 4))
    const px = pipPixels(props.frame, props.mood)
    const out: { ch: string; fg?: any; bg?: any }[][] = []
    for (let y = 0; y < px.length; y += 2) {
      const row: { ch: string; fg?: any; bg?: any }[] = []
      for (let x = 0; x < px[y].length; x++) {
        const top = pixelColor(px[y][x])
        const bot = pixelColor(px[y + 1]?.[x] ?? ".")
        if (!top && !bot) row.push({ ch: " " })
        else if (top && bot) row.push({ ch: "▀", fg: top, bg: bot })
        else if (top) row.push({ ch: "▀", fg: top })
        else row.push({ ch: "▄", fg: bot })
      }
      out.push(row)
    }
    return out
  }
  return (
    <box flexDirection="column">
      {lines().map((row) => (
        <text>
          {row.map((c) => (
            <span style={{ fg: c.fg, bg: c.bg }}>{c.ch}</span>
          ))}
        </text>
      ))}
    </box>
  )
}

// one shared clock, so every piece animates in step and stops on unload
const [tick, setTick] = createSignal(0)
let clock: ReturnType<typeof setInterval> | undefined

function useStatus(ctx: any, sessionID?: string) {
  return () => {
    tick()
    if (!sessionID) return "idle"
    try {
      return ctx.data.session.status(sessionID) === "running" ? "running" : "idle"
    } catch {
      return "idle"
    }
  }
}

function Welcome(props: { ctx: any }) {
  // drawn in the home footer, then lifted to the top row of the screen (absolute + negative top)
  let ref: any
  const [top, setTop] = createSignal(0)
  // measure the natural row once (while top is still 0), then pin there: some hosts do not move
  // ref.y after an absolute offset, so re-measuring would run away
  const lift = () => {
    tick()
    if (top() === 0 && ref && typeof ref.y === "number" && ref.y > 0 && ref.y < 500) {
      // stay below the session tab bar when OpenCode shows one
      const bar = (() => {
        try {
          return props.ctx.ui.tabs.enabled() ? 1 : 0
        } catch {
          return 0
        }
      })()
      const y = ref.y - bar
      queueMicrotask(() => setTop(-y))
    }
    return top()
  }
  const dir = () => {
    const loc = props.ctx.data?.location?.default?.()
    const p = String(loc?.directory ?? loc?.path ?? process.cwd())
    return p.replace(process.env.HOME ?? "", "~")
  }
  return (
    <box ref={ref} position="absolute" top={lift()} left={0} border borderStyle="rounded" borderColor={ACCENT()} paddingLeft={1} paddingRight={1} flexDirection="row" gap={1}>
      <PipArt frame={Math.floor(tick() / 2)} mood="happy" />
      <box flexDirection="column" justifyContent="center">
        <text>
          <span style={{ fg: ACCENT() }}>✻ </span>
          <span style={{ fg: TEXT() }}>Welcome to </span>
          <span style={{ fg: ACCENT() }}>OpenCode</span>
          <span style={{ fg: TEXT() }}>!</span>
        </text>
        <text fg={MUTED()}>/help · ctrl+p commands</text>
        <text fg={DIM()}>cwd: {dir()}</text>
        <text>
          <span style={{ fg: ACCENT() }}>› </span>
          <span style={{ fg: MUTED() }}>{TIPS[Math.floor(tick() / 70) % TIPS.length].replace(/^tip: /, "")}</span>
        </text>
      </box>
    </box>
  )
}

function Thinking(props: { ctx: any; sessionID?: string }) {
  const status = useStatus(props.ctx, props.sessionID)
  const [since, setSince] = createSignal(0)
  const [verb, setVerb] = createSignal(VERBS[0])
  let was = "idle"
  const view = () => {
    const s = status()
    if (s === "running" && was !== "running") {
      setSince(Date.now())
      setVerb(VERBS[Math.floor(Math.random() * VERBS.length)])
    }
    was = s
    return s
  }
  return (
    <Show when={view() === "running"}>
      <text>
        <span style={{ fg: ACCENT() }}>{STARS[tick() % STARS.length]} </span>
        <span style={{ fg: ACCENT() }}>{verb()}… </span>
        <span style={{ fg: MUTED() }}>({Math.max(0, Math.round((Date.now() - since()) / 1000))}s · esc to interrupt)</span>
      </text>
    </Show>
  )
}

function SidebarPip(props: { ctx: any; sessionID: string }) {
  const status = useStatus(props.ctx, props.sessionID)
  const working = () => status() === "running"
  return (
    <box flexDirection="column" paddingTop={1}>
      {/* a little hop while working */}
      <box paddingTop={working() && Math.floor(tick() / 3) % 2 ? 0 : 1}>
        <PipArt frame={Math.floor(tick() / 2)} mood={working() ? "work" : "sleep"} />
      </box>
      <text fg={status() === "running" ? SOFT() : DIM()}>
        {status() === "running" ? "  ● working" : "  ○ idle"}
      </text>
    </box>
  )
}

// Home screen layout (Claude Code style): hide the big logo and move the prompt to the bottom.
// The host layout is a column [spacer, spacer, logo, gap, prompt, spacer]; it is found from the
// logo's block characters, so nothing depends on internal ids. Re-applied whenever home is rebuilt.
const LOGO_CHARS = new Set(["█", "▀", "▄"])
let patched: any
function findLogo(n: any): any {
  for (const c of n?.getChildren?.() ?? []) {
    if (LOGO_CHARS.has(String(c.plainText ?? ""))) {
      let box = c
      // climb from one logo character to the whole logo block (>= 3 rows), sitting in the home column
      while (box.parent && !((box.height ?? 0) >= 3 && (box.parent.getChildren?.()?.length ?? 0) >= 4)) box = box.parent
      return box
    }
    const hit = findLogo(c)
    if (hit) return hit
  }
}
function layoutHome(ctx: any) {
  try {
    if (ctx.ui.router.current()?.type !== "home") return
    const logo = findLogo(ctx.renderer.root)
    const col = logo?.parent
    if (!col || col === patched) return
    const kids = col.getChildren()
    const at = kids.indexOf(logo)
    // the prompt is the block after the logo with the most content in it (spacers are empty)
    const size = (n: any): number => (n.getChildren?.() ?? []).reduce((t: number, c: any) => t + 1 + size(c), 0)
    let prompt = kids[at + 1]
    for (const k of kids.slice(at + 1)) if (size(k) > size(prompt)) prompt = k
    if (!prompt || size(prompt) < 5) return // not built yet; try again on the next tick
    const p = kids.indexOf(prompt)
    kids.forEach((k: any, i: number) => {
      if (i === 0) k.flexGrow = 1 // the top spacer takes all free space: prompt sinks to the bottom
      else if (i !== p) k.visible = false
    })
    // the prompt spans the whole width, like Claude Code's input box
    try {
      prompt.alignSelf = "stretch"
      prompt.width = "100%"
      prompt.maxWidth = "100%"
      prompt.paddingLeft = 1
      prompt.paddingRight = 1
    } catch {}
    patched = col
  } catch {
    // host layout changed: leave the stock home screen alone
  }
}

export default {
  id: "neo-bear",
  setup(ctx: any) {
    host = ctx
    if (!clock)
      clock = setInterval(() => {
        layoutHome(ctx)
        try {
          setTick((n) => n + 1)
        } catch {}
      }, 120)
    ctx.ui.slot({ prepend: "home.footer", render: () => <Welcome ctx={ctx} /> })
    ctx.ui.slot({ prepend: "prompt.footer.status", render: (input: any) => <Thinking ctx={ctx} sessionID={input?.sessionID} /> })
    ctx.ui.slot({ append: "sidebar.content", render: (input: any) => <SidebarPip ctx={ctx} sessionID={input.sessionID} /> })
    return () => {
      if (clock) clearInterval(clock)
      clock = undefined
    }
  },
}
