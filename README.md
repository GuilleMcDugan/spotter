# SPOTTER

AI-assisted sound design spotting for macOS. Analyze any video → get a complete cue sheet with timecodes → generate or search SFX → export DAW-synchronized stems.

Built by [Lemö Labs](https://lemolabs.studio).

---

## What it is

Two things in one repo:

- **Electron app** — visual timeline for manual spotting, clip editing, gain, fades, and export
- **MCP server** — automated pipeline for use directly from Claude Code (no GUI needed)

Both share the same project format (`analysis.json` + `media/` + `export/`).

---

## Electron app (macOS)

### Requirements

- macOS (Apple Silicon)
- Node.js 18+

### Install & run

```bash
git clone https://github.com/GuilleMcDugan/spotter.git
cd spotter
npm install
npm run dev
```

### Build DMG

```bash
npm run dist
# → dist/SPOTTER-1.0.0-arm64.dmg
```

### Features

- AI video analysis (extracts frames → Claude → cue sheet)
- Multi-track timeline with drag, trim, vertical clip movement, split (S key)
- Per-clip gain and fade in/out (drag handles)
- ElevenLabs SFX generation + Freesound search, built in
- Export: WAV 16-bit / 24-bit / MP3 320k at 44.1kHz or 48kHz
- DAW-synchronized stems (each file padded to full video length)
- Auto-save timeline between sessions
- J/K/L transport + frame-accurate scrubbing

---

## MCP server (Claude Code integration)

See [`mcp-server/README.md`](mcp-server/README.md) for setup and tool reference.

Quick start:

```bash
cd mcp-server
npm install && npm run build
```

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "spotter": {
      "command": "node",
      "args": ["/absolute/path/to/spotter/mcp-server/dist/index.js"]
    }
  }
}
```

---

## Guía de instalación

Documentación completa en Notion (español):
**[SPOTTER — Guía de instalación](https://app.notion.com/p/SPOTTER-Gu-a-de-instalaci-n-39d2128ee2a781429afff6568677858d)**

---

## API keys

Keys are stored locally — never in the repo.

- **Electron app**: Settings panel (⚙) → paste keys → stored in system keychain via `electron-store`
- **MCP server**: `configure_provider({ provider: "elevenlabs", api_key: "..." })` → stored in `~/.spotter/config.json`

Required:
- [ElevenLabs](https://elevenlabs.io) — SFX generation
- [Freesound](https://freesound.org/apiv2/) — free SFX search

Claude API key: handled by the Claude CLI (`claude auth`), not by SPOTTER.

---

## License

MIT
