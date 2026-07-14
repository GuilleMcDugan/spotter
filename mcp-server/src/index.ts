#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'

import { analyzeVideo } from './tools/analyze.js'
import { exportStems } from './tools/export.js'
import { getProvider, listProviders } from './providers/registry.js'
import { loadConfig, setKey, saveConfig } from './config.js'
import path from 'path'
import fs from 'fs'

const server = new Server(
  { name: 'spotter', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

// ─── Tool definitions ────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'analyze_video',
      description: 'Analyze a video file for sound design. Extracts frames, runs AI analysis, returns a complete cue sheet with sound descriptions and timecodes.',
      inputSchema: {
        type: 'object',
        properties: {
          video_path:  { type: 'string', description: 'Absolute path to the video file (.mp4, .mov)' },
          project_dir: { type: 'string', description: 'Optional: directory to store project files. Defaults to ~/Documents/Proyectos SPOTTER/<timestamp>_<name>' },
          criterio:    { type: 'string', description: "Optional: director's intent / sonic references (free text, passed to the AI)" },
        },
        required: ['video_path']
      }
    },
    {
      name: 'generate_sfx',
      description: 'Generate a sound effect audio file from a text prompt using ElevenLabs or a configured provider.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt:           { type: 'string', description: 'Sound description in English (e.g. "heavy rain on metal roof, distant thunder rumble")' },
          duration_seconds: { type: 'number', description: 'Duration in seconds (0.5–22). Default: 5', default: 5 },
          output_dir:       { type: 'string', description: 'Directory to save the generated audio file' },
          provider:         { type: 'string', description: 'Provider name (elevenlabs, or any configured custom provider). Default: first enabled provider' },
        },
        required: ['prompt', 'output_dir']
      }
    },
    {
      name: 'search_sfx',
      description: 'Search for sound effects on Freesound or a configured search provider.',
      inputSchema: {
        type: 'object',
        properties: {
          query:       { type: 'string', description: 'Search query in English' },
          max_results: { type: 'number', description: 'Maximum results to return (1–20). Default: 10', default: 10 },
          provider:    { type: 'string', description: 'Search provider. Default: freesound' },
        },
        required: ['query']
      }
    },
    {
      name: 'export_stems',
      description: 'Export DAW-synchronized WAV stems + CSV cue sheet from a SPOTTER project. Each WAV starts at the correct timecode position for direct import into any DAW.',
      inputSchema: {
        type: 'object',
        properties: {
          project_dir:    { type: 'string', description: 'Path to the SPOTTER project directory (must contain analysis.json and media/ folder)' },
          video_duration: { type: 'number', description: 'Video duration in seconds (used to pad WAV files to full length)' },
          cues:           { type: 'string', description: 'Optional: JSON array of cue objects with updated positions. If omitted, reads from project analysis.json' },
        },
        required: ['project_dir', 'video_duration']
      }
    },
    {
      name: 'list_providers',
      description: 'List all configured SFX providers and their status.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'configure_provider',
      description: 'Add or update an SFX provider API key or endpoint. Stored in ~/.spotter/config.json.',
      inputSchema: {
        type: 'object',
        properties: {
          provider:  { type: 'string', description: 'Provider name (e.g. elevenlabs, freesound, or a custom name)' },
          api_key:   { type: 'string', description: 'API key for the provider' },
          endpoint:  { type: 'string', description: 'Optional: custom REST endpoint for generate (POST with {prompt, duration_seconds} body)' },
          enabled:   { type: 'boolean', description: 'Enable or disable this provider', default: true },
        },
        required: ['provider']
      }
    },
  ]
}))

// ─── Tool handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  if (!args) throw new McpError(ErrorCode.InvalidParams, 'Missing arguments')

  try {
    switch (name) {

      case 'analyze_video': {
        const result = await analyzeVideo({
          videoPath: args.video_path as string,
          projectDir: args.project_dir as string | undefined,
          criterio: args.criterio as string | undefined,
        })
        const analysis = result.analysis as { cues?: unknown[]; narrative?: object }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              projectDir: result.projectDir,
              analysisPath: result.analysisPath,
              cueCount: (analysis.cues ?? []).length,
              narrative: analysis.narrative,
              cues: analysis.cues,
            }, null, 2)
          }]
        }
      }

      case 'generate_sfx': {
        const provider = getProvider(args.provider as string | undefined)
        if (!provider.canGenerate || !provider.generate) {
          throw new McpError(ErrorCode.InvalidParams, `Provider "${provider.name}" does not support generation`)
        }
        const result = await provider.generate(
          args.prompt as string,
          (args.duration_seconds as number) ?? 5,
          args.output_dir as string
        )
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'search_sfx': {
        const provider = getProvider((args.provider as string) ?? 'freesound')
        if (!provider.canSearch || !provider.search) {
          throw new McpError(ErrorCode.InvalidParams, `Provider "${provider.name}" does not support search`)
        }
        const results = await provider.search(args.query as string, (args.max_results as number) ?? 10)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }]
        }
      }

      case 'export_stems': {
        const projectDir = args.project_dir as string
        const videoDuration = args.video_duration as number

        let cues
        if (args.cues) {
          cues = JSON.parse(args.cues as string)
        } else {
          const analysisPath = path.join(projectDir, 'analysis.json')
          if (!fs.existsSync(analysisPath)) {
            throw new McpError(ErrorCode.InvalidParams, `No analysis.json found in ${projectDir}`)
          }
          const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'))
          cues = analysis.cues ?? []
        }

        const result = await exportStems(projectDir, cues, videoDuration)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'list_providers': {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(listProviders(), null, 2)
          }]
        }
      }

      case 'configure_provider': {
        const providerName = args.provider as string
        const cfg = loadConfig()
        cfg.providers[providerName] = {
          ...(cfg.providers[providerName] ?? {}),
          enabled: (args.enabled as boolean) ?? true,
          ...(args.api_key ? { apiKey: args.api_key as string } : {}),
          ...(args.endpoint ? { endpoint: args.endpoint as string, type: 'sfx-generate' as const } : {}),
        }
        saveConfig(cfg)
        // Also mirror to setKey for convenience
        if (args.api_key) setKey(providerName, args.api_key as string)
        return {
          content: [{
            type: 'text',
            text: `Provider "${providerName}" configured. Config saved to ~/.spotter/config.json`
          }]
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
    }
  } catch (e) {
    if (e instanceof McpError) throw e
    throw new McpError(ErrorCode.InternalError, e instanceof Error ? e.message : String(e))
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // stderr is safe for logging (doesn't pollute MCP stdio)
  process.stderr.write('SPOTTER MCP server running\n')
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`)
  process.exit(1)
})
