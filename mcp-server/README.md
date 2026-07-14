# SPOTTER MCP Server

AI sound design spotting as an MCP tool for Claude Code.

Analyzes any video → generates a complete cue sheet → optionally generates or searches SFX audio → exports DAW-synchronized WAV stems.

## Install

```bash
git clone <repo>
cd spotter/mcp-server
npm install
npm run build
```

## Add to Claude Code

Edit `~/.claude/settings.json`:

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

Restart Claude Code. Verify with `/mcp` — you should see `spotter` listed.

## Configure providers

### ElevenLabs (SFX generation)

```
configure_provider({ provider: "elevenlabs", api_key: "YOUR_KEY" })
```

### Freesound (SFX search)

Get a free API key at freesound.org/apiv2:

```
configure_provider({ provider: "freesound", api_key: "YOUR_KEY" })
```

### Custom REST provider

Any API that accepts `POST { prompt, duration_seconds }` and returns audio:

```
configure_provider({
  provider: "my_sfx_api",
  api_key: "YOUR_KEY",
  endpoint: "https://api.example.com/v1/generate"
})
```

Config stored in `~/.spotter/config.json`.

## Tools

| Tool | Description |
|------|-------------|
| `analyze_video` | Extract frames → AI analysis → cue sheet (analysis.json) |
| `generate_sfx` | Generate audio from text prompt via ElevenLabs or custom provider |
| `search_sfx` | Search Freesound for existing recordings |
| `export_stems` | Export DAW-ready WAV stems + CSV cue sheet |
| `list_providers` | Show configured providers and their status |
| `configure_provider` | Add/update API keys and endpoints |

## Typical workflow

```
# 1. Analyze a video
analyze_video({ video_path: "/path/to/scene.mp4", criterio: "dark thriller, minimal music, emphasis on environment" })

# 2. Generate SFX for specific cues (returns audio files in project/media/)
generate_sfx({ prompt: "heavy rain on metal roof, distant thunder", duration_seconds: 8, output_dir: "/path/to/project/media" })

# 3. Export DAW stems (pads each clip to full video length with silence before/after)
export_stems({ project_dir: "/path/to/project", video_duration: 120.5 })
```

The exported WAVs drop directly into any DAW (Reaper, Logic, Pro Tools, etc.) at the correct timecode — no manual alignment needed.

## Project structure

```
~/Documents/Proyectos SPOTTER/<timestamp>_<name>/
├── analysis.json       # Full cue sheet (cues array + narrative)
├── criterio.txt        # Director's intent (if provided)
├── frames/             # Extracted JPGs used for analysis
├── media/              # Generated/downloaded audio files
└── export/
    ├── cue_sheet.csv   # Human-readable cue sheet
    └── AMB_cue_001_*.wav  # DAW-synchronized stems
```

## Use without the Electron app

SPOTTER MCP works standalone — you don't need the Electron app. The Electron app is for step-by-step manual control; the MCP server is for fully automated pipeline use from Claude Code.
