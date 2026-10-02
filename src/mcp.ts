/**
 * Streamable HTTP MCP (JSON responses, stateless) at /mcp.
 * Compatible with Cursor remote MCP handshake ~2025-11-25.
 * OAuth/DCR deferred — Bearer secret only for this pass.
 */

import type { Context } from "hono";
import { authorizeMcp, wwwAuthenticateBearer, type McpAuthEnv } from "./mcp-auth";
import {
  callMcpTool,
  MCP_HANDSHAKE_VERSION,
  MCP_INSTRUCTIONS,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_TOOLS,
  type McpToolContext,
} from "./mcp-tools";
import type { ChapterPack } from "./usj";

export type McpEnv = McpAuthEnv & {
  DB: D1Database;
  ASSETS: Fetcher;
};

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
  };
}

function jsonResponse(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(),
      ...Object.fromEntries(new Headers(extra).entries()),
    },
  });
}

function unauthorized(c: Context<{ Bindings: McpEnv; Variables: any }>): Response {
  const meta = new URL("/.well-known/oauth-protected-resource", c.req.url).toString();
  return jsonResponse(
    {
      error: "invalid_token",
      error_description: "Provide Authorization: Bearer with a valid MCP token.",
    },
    401,
    { "WWW-Authenticate": wwwAuthenticateBearer(meta) },
  );
}

export async function handleMcpOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function handleMcpGet(c: Context<{ Bindings: McpEnv; Variables: any }>): Promise<Response> {
  const auth = authorizeMcp(c.env, c.req.header("Authorization"));
  if (!auth.ok) return unauthorized(c);
  // Stateless JSON transport: no SSE stream. Clients should POST.
  return jsonResponse(
    {
      error: "method_not_allowed",
      error_description: "Use POST /mcp for JSON-RPC. This server is stateless (no SSE session).",
    },
    405,
    { Allow: "POST, DELETE, OPTIONS" },
  );
}

export async function handleMcpDelete(c: Context<{ Bindings: McpEnv; Variables: any }>): Promise<Response> {
  const auth = authorizeMcp(c.env, c.req.header("Authorization"));
  if (!auth.ok) return unauthorized(c);
  // Stateless — nothing to tear down.
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function handleMcpPost(c: Context<{ Bindings: McpEnv; Variables: any }>): Promise<Response> {
  const auth = authorizeMcp(c.env, c.req.header("Authorization"));
  if (!auth.ok) return unauthorized(c);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }, 400);
  }

  const ctx: McpToolContext = {
    db: c.env.DB,
    libraryId: auth.libraryId,
    loadChapter: (book, chapter) => loadChapterPack(c.env.ASSETS, book, chapter),
  };

  if (Array.isArray(body)) {
    const results = [];
    for (const item of body) {
      const handled = await dispatchOne(item as JsonRpcRequest, ctx);
      if (handled !== null) results.push(handled);
    }
    return jsonResponse(results);
  }

  const handled = await dispatchOne(body as JsonRpcRequest, ctx);
  if (handled === null) {
    // Notification — accepted, no body.
    return new Response(null, { status: 202, headers: corsHeaders() });
  }
  return jsonResponse(handled);
}

async function dispatchOne(
  msg: JsonRpcRequest,
  ctx: McpToolContext,
): Promise<Record<string, unknown> | null> {
  const id = msg.id ?? null;
  const isNotification = msg.id === undefined;
  const method = typeof msg.method === "string" ? msg.method : "";

  if (msg.jsonrpc != null && msg.jsonrpc !== "2.0") {
    if (isNotification) return null;
    return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } };
  }

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiateProtocol(msg.params),
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION, title: "margin.bible notes" },
          instructions: MCP_INSTRUCTIONS,
        },
      };
    case "notifications/initialized":
    case "initialized":
      return null;
    case "ping":
      if (isNotification) return null;
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      if (isNotification) return null;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: MCP_TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
          })),
        },
      };
    case "tools/call": {
      if (isNotification) return null;
      const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      const name = typeof params.name === "string" ? params.name : "";
      if (!name) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: "tools/call requires name" } };
      }
      const result = await callMcpTool(name, params.arguments, ctx);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: result.content,
          ...(result.structuredContent !== undefined
            ? { structuredContent: result.structuredContent }
            : {}),
          ...(result.isError ? { isError: true } : {}),
        },
      };
    }
    case "server/discover":
      if (isNotification) return null;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          resultType: "complete",
          supportedVersions: [MCP_HANDSHAKE_VERSION],
          capabilities: { tools: {} },
          serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        },
      };
    default:
      if (isNotification) return null;
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

function negotiateProtocol(params: unknown): string {
  const requested =
    params && typeof params === "object" && typeof (params as { protocolVersion?: unknown }).protocolVersion === "string"
      ? (params as { protocolVersion: string }).protocolVersion
      : "";
  // Cursor / Rails handshake stays on 2025-11-25 for this pass.
  if (requested === MCP_HANDSHAKE_VERSION || requested.startsWith("2025-")) return MCP_HANDSHAKE_VERSION;
  if (requested === "2024-11-05") return "2024-11-05";
  return MCP_HANDSHAKE_VERSION;
}

async function loadChapterPack(
  assets: Fetcher,
  book: string,
  chapter: number,
): Promise<ChapterPack | null> {
  const key = `${book.toLowerCase()}.${chapter}`;
  const response = await assets.fetch(new URL(`/bsb/${key}.json`, "https://assets.local"));
  if (!response.ok) return null;
  const pack = (await response.json()) as ChapterPack;
  if (!pack || !Array.isArray(pack.verses)) return null;
  return pack;
}

export { authorizeMcp, MCP_TOOLS, MCP_HANDSHAKE_VERSION };
