# 🧠 Engram
> A local memory MCP server for Claude. Saves and retrieves memories as plain `.md` files — you own everything.

---

## How it works

```
You chat with Claude
       ↓
Claude calls Engram tools (save_memory, search_memories...)
       ↓
Engram reads/writes .md files in the memories/ folder
       ↓
Next conversation → Claude loads memories → remembers everything
```

---

## Setup

### 1. Install dependencies & build

```bash
cd engram
npm install
npm run build
```

### 2. Add to Claude Desktop config

Open your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add this (replace the path with your actual path):

```json
{
  "mcpServers": {
    "engram": {
      "command": "node",
      "args": ["/absolute/path/to/engram/dist/index.js"]
    }
  }
}
```

### 3. Restart Claude Desktop

That's it. Claude now has access to all Engram tools.

---

## Available Tools

| Tool | What it does |
|---|---|
| `save_memory` | Save a new memory with title, content, tags |
| `read_memory` | Read a specific memory by title |
| `list_memories` | List all saved memories (use at start of chats) |
| `search_memories` | Search memories by keyword |
| `update_memory` | Update an existing memory |
| `delete_memory` | Delete a memory |

---

## System Prompt (add this to Claude Desktop)

For best results, add this as a custom system prompt in Claude Desktop settings:

```
At the start of every conversation, call list_memories to load context.
During conversation:
- If the user shares something important (projects, preferences, facts about themselves) → call save_memory
- If a memory needs updating → call update_memory
- If the user asks about past context → call search_memories
Be transparent: tell the user when you save or retrieve a memory.
```

---

## Memory file format

Each memory is a plain `.md` file you can open and edit anytime:

```markdown
# RAG Project
Date: 2026-07-04
Tags: #project #backend

Building a RAG system using NestJS, pgvector, and Gemini.
Next step: enable pgvector and write the ingestion script.
```

---

## Project structure

```
engram/
  src/
    index.ts        ← MCP server source
  dist/
    index.js        ← compiled output (run this)
  memories/         ← your .md memory files live here
  package.json
  tsconfig.json
  README.md
```# engram
