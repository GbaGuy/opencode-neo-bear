/** @jsxImportSource @opentui/solid */
// Model button (OpenCode v2 TUI plugin): a clickable "⇄ <model>" in the footer under the prompt.
// Clicking it opens OpenCode's own model list. Loaded from cli.json "plugins"
// as this folder; OpenCode takes the TUI entry from ./tui.tsx.
import { createSignal, onCleanup } from "solid-js"

const label = (ctx: any) => {
  const m = ctx.ui.model.current()
  if (!m) return "switch model" // no model reported yet (e.g. the home screen)
  const id = String(m.modelID).replace(/[-_.]exl3.*$/i, "").replace(/\.i1-.*$/, "")
  return m.variant ? `${id} · ${m.variant}` : id
}

const colors = (ctx: any) => {
  const t = ctx.theme?.text ?? {}
  const base = t.base ?? t.default ?? t.muted
  const accent = t.interactive?.base ?? t.accent?.base ?? t.feedback?.info?.base ?? base
  return { base, accent }
}

function ModelButton(props: { ctx: any }) {
  const open = () => props.ctx.keymap.dispatch("model.list")
  // the selected model is not always reactive in this slot; re-read it every second
  const [tick, setTick] = createSignal(0)
  const timer = setInterval(() => setTick((n) => n + 1), 1000)
  onCleanup(() => clearInterval(timer))
  return (
    <text onMouseUp={open}>
      <span style={{ fg: colors(props.ctx).accent }}>⇄ </span>
      <span style={{ fg: colors(props.ctx).base }}>{(tick(), label(props.ctx))}</span>
    </text>
  )
}

export default {
  id: "model-button",
  setup(ctx: any) {
    ctx.ui.slot({ prepend: "prompt.footer.status", render: () => <ModelButton ctx={ctx} /> })
  },
}
