#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { openDb } from "./db.js";
import { capture, recall, consolidate, crystallize, forget } from "./tools.js";

const db = openDb();

const ScopeSchema = z.string().min(1).max(128);

const tools = {
  capture: {
    description: "Record an episode (raw, dated text) in a scope.",
    inputSchema: z.object({ scope: ScopeSchema, content: z.string().min(1) }),
    handler: (args: { scope: string; content: string }) => capture(db, args)
  },
  recall: {
    description: "Search memories (and list traits) by full-text query, optionally scoped.",
    inputSchema: z.object({ scope: ScopeSchema.optional(), query: z.string().min(1), limit: z.coerce.number().int().positive().max(100).optional() }),
    handler: (args: { scope?: string; query: string; limit?: number }) => recall(db, args)
  },
  consolidate: {
    description: "Summarize all un-consolidated episodes in a scope into one memory.",
    inputSchema: z.object({ scope: ScopeSchema }),
    handler: async (args: { scope: string }) => consolidate(db, args)
  },
  crystallize: {
    description: "Set or update a permanent trait (identity, fixed preference, hard rule) for a scope.",
    inputSchema: z.object({ scope: ScopeSchema, name: z.string().min(1), value: z.string().min(1), evidence: z.string().optional() }),
    handler: (args: { scope: string; name: string; value: string; evidence?: string }) => crystallize(db, args)
  },
  forget: {
    description: "Delete a memory by id, or all memories in a scope below a salience threshold.",
    inputSchema: z.object({ id: z.string().optional(), scope: ScopeSchema.optional(), belowSalience: z.coerce.number().min(0).max(1).optional() }),
    handler: (args: { id?: string; scope?: string; belowSalience?: number }) => forget(db, args)
  }
} as const;

const server = new Server({ name: "mnemo", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(tools).map(([name, def]) => ({
    name,
    description: def.description,
    inputSchema: zodToJsonSchemaLoose(def.inputSchema)
  }))
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const def = tools[request.params.name as keyof typeof tools];
  if (!def) throw new Error(`Unknown tool: ${request.params.name}`);
  const args = def.inputSchema.parse(request.params.arguments ?? {});
  const result = await def.handler(args as never);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

/** Minimal, dependency-free zod -> JSON Schema for the simple object shapes used above. */
function zodToJsonSchemaLoose(schema: z.ZodTypeAny): Record<string, unknown> {
  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    properties[key] = { type: jsonTypeOf(value) };
    if (!value.isOptional()) required.push(key);
  }
  return { type: "object", properties, required };
}

/** Advertise the real type so MCP clients send numbers as numbers (previously everything was "string"). */
function jsonTypeOf(schema: z.ZodTypeAny): "string" | "number" | "boolean" {
  let inner: z.ZodTypeAny = schema;
  while (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable || inner instanceof z.ZodDefault) {
    inner = inner._def.innerType;
  }
  if (inner instanceof z.ZodNumber) return "number";
  if (inner instanceof z.ZodBoolean) return "boolean";
  return "string";
}

const transport = new StdioServerTransport();
await server.connect(transport);
