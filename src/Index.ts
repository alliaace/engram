import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

// ─── Config ───────────────────────────────────────────────────────────────────

const MEMORIES_DIR = path.join(__dirname, "../memories");

// Ensure memories folder exists on startup
if (!fs.existsSync(MEMORIES_DIR)) {
    fs.mkdirSync(MEMORIES_DIR, { recursive: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFilePath(title: string): string {
    // Sanitize title → filename: lowercase, spaces to dashes, no special chars
    const filename = title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .concat(".md");
    return path.join(MEMORIES_DIR, filename);
}

function formatMemoryFile(title: string, content: string, tags: string[]): string {
    const date = new Date().toISOString().split("T")[0];
    const tagLine = tags.length > 0 ? tags.map((t) => `#${t}`).join(" ") : "";
    return `# ${title}\nDate: ${date}\nTags: ${tagLine}\n\n${content}\n`;
}

function parseMemoryFile(raw: string): { title: string; date: string; tags: string[]; content: string } {
    const lines = raw.split("\n");
    const title = lines[0]?.replace(/^#\s*/, "") ?? "Untitled";
    const date = lines[1]?.replace("Date: ", "") ?? "";
    const tags = (lines[2]?.replace("Tags: ", "") ?? "")
        .split(" ")
        .filter(Boolean)
        .map((t) => t.replace("#", ""));
    const content = lines.slice(4).join("\n").trim();
    return { title, date, tags, content };
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
    { name: "engram", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "save_memory",
                description:
                    "Save something important to long-term memory. Use this when the user shares facts about themselves, ongoing projects, preferences, or anything worth remembering in future conversations.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "Short title for this memory (e.g. 'RAG Project', 'Work Context')",
                        },
                        content: {
                            type: "string",
                            description: "The actual memory content in plain text or markdown",
                        },
                        tags: {
                            type: "array",
                            items: { type: "string" },
                            description: "Optional tags to categorize this memory (e.g. ['work', 'project'])",
                        },
                    },
                    required: ["title", "content"],
                },
            },
            {
                name: "read_memory",
                description: "Read a specific memory by its title.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "The title of the memory to read",
                        },
                    },
                    required: ["title"],
                },
            },
            {
                name: "list_memories",
                description:
                    "List all saved memories with their titles, dates, and tags. Use this at the start of every conversation to load context.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "search_memories",
                description:
                    "Search across all memories for a keyword or phrase. Use when the user asks about something from the past.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The keyword or phrase to search for",
                        },
                    },
                    required: ["query"],
                },
            },
            {
                name: "update_memory",
                description:
                    "Update an existing memory by title. Use this when new information extends or corrects something already saved.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "The title of the memory to update",
                        },
                        content: {
                            type: "string",
                            description: "The new content to replace the existing memory",
                        },
                        tags: {
                            type: "array",
                            items: { type: "string" },
                            description: "Updated tags (optional)",
                        },
                    },
                    required: ["title", "content"],
                },
            },
            {
                name: "delete_memory",
                description: "Delete a memory by title.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "The title of the memory to delete",
                        },
                    },
                    required: ["title"],
                },
            },
        ],
    };
});

// ─── Tool Handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        // ── save_memory ──────────────────────────────────────────────────────────
        if (name === "save_memory") {
            const { title, content, tags = [] } = args as {
                title: string;
                content: string;
                tags?: string[];
            };

            const filePath = getFilePath(title);

            if (fs.existsSync(filePath)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `⚠️ A memory titled "${title}" already exists. Use update_memory to modify it.`,
                        },
                    ],
                };
            }

            const fileContent = formatMemoryFile(title, content, tags);
            fs.writeFileSync(filePath, fileContent, "utf-8");

            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Memory saved: "${title}"`,
                    },
                ],
            };
        }

        // ── read_memory ──────────────────────────────────────────────────────────
        if (name === "read_memory") {
            const { title } = args as { title: string };
            const filePath = getFilePath(title);

            if (!fs.existsSync(filePath)) {
                return {
                    content: [{ type: "text", text: `❌ No memory found with title: "${title}"` }],
                };
            }

            const raw = fs.readFileSync(filePath, "utf-8");
            return {
                content: [{ type: "text", text: raw }],
            };
        }

        // ── list_memories ────────────────────────────────────────────────────────
        if (name === "list_memories") {
            const files = fs.readdirSync(MEMORIES_DIR).filter((f) => f.endsWith(".md"));

            if (files.length === 0) {
                return {
                    content: [{ type: "text", text: "No memories saved yet." }],
                };
            }

            const summaries = files.map((file) => {
                const raw = fs.readFileSync(path.join(MEMORIES_DIR, file), "utf-8");
                const { title, date, tags } = parseMemoryFile(raw);
                return `• ${title} (${date}) ${tags.length > 0 ? `[${tags.join(", ")}]` : ""}`;
            });

            return {
                content: [
                    {
                        type: "text",
                        text: `📚 Saved memories (${files.length}):\n\n${summaries.join("\n")}`,
                    },
                ],
            };
        }

        // ── search_memories ──────────────────────────────────────────────────────
        if (name === "search_memories") {
            const { query } = args as { query: string };
            const files = fs.readdirSync(MEMORIES_DIR).filter((f) => f.endsWith(".md"));
            const results: string[] = [];

            for (const file of files) {
                const raw = fs.readFileSync(path.join(MEMORIES_DIR, file), "utf-8");
                if (raw.toLowerCase().includes(query.toLowerCase())) {
                    const { title, date, content } = parseMemoryFile(raw);
                    // Return a short snippet around the match
                    const idx = content.toLowerCase().indexOf(query.toLowerCase());
                    const snippet = content.substring(Math.max(0, idx - 60), idx + 120).trim();
                    results.push(`📄 **${title}** (${date})\n...${snippet}...`);
                }
            }

            if (results.length === 0) {
                return {
                    content: [{ type: "text", text: `No memories found matching: "${query}"` }],
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `🔍 Found ${results.length} result(s) for "${query}":\n\n${results.join("\n\n")}`,
                    },
                ],
            };
        }

        // ── update_memory ────────────────────────────────────────────────────────
        if (name === "update_memory") {
            const { title, content, tags = [] } = args as {
                title: string;
                content: string;
                tags?: string[];
            };

            const filePath = getFilePath(title);

            if (!fs.existsSync(filePath)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `❌ No memory found with title: "${title}". Use save_memory to create it.`,
                        },
                    ],
                };
            }

            // Preserve original tags if none provided
            const raw = fs.readFileSync(filePath, "utf-8");
            const existing = parseMemoryFile(raw);
            const finalTags = tags.length > 0 ? tags : existing.tags;

            const fileContent = formatMemoryFile(title, content, finalTags);
            fs.writeFileSync(filePath, fileContent, "utf-8");

            return {
                content: [{ type: "text", text: `✅ Memory updated: "${title}"` }],
            };
        }

        // ── delete_memory ────────────────────────────────────────────────────────
        if (name === "delete_memory") {
            const { title } = args as { title: string };
            const filePath = getFilePath(title);

            if (!fs.existsSync(filePath)) {
                return {
                    content: [{ type: "text", text: `❌ No memory found with title: "${title}"` }],
                };
            }

            fs.unlinkSync(filePath);
            return {
                content: [{ type: "text", text: `🗑️ Memory deleted: "${title}"` }],
            };
        }

        return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🧠 Engram MCP server running...");
}

main().catch(console.error);