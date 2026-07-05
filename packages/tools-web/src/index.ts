import type { RegisteredTool } from "@desktop-agent/tool-registry";
import { z } from "zod";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type WebToolContext = {
  fetch?: FetchLike;
  getEnv?: (key: string) => string | undefined;
};

const searchSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(20).optional(),
  provider: z.enum(["auto", "brave", "tavily", "jina"]).optional(),
  apiKey: z.string().optional(),
});

const extractSchema = z.object({
  url: z.string().url(),
  maxCharacters: z.number().int().min(500).max(20000).optional(),
  apiKey: z.string().optional(),
  provider: z.enum(["local", "firecrawl", "jina"]).optional(),
});

const crawlSchema = z.object({
  url: z.string().url(),
  maxPages: z.number().int().min(1).max(10).optional(),
  maxCharactersPerPage: z.number().int().min(500).max(12000).optional(),
});

function getFetch(ctx?: WebToolContext): FetchLike {
  return ctx?.fetch ?? fetch;
}

function getEnv(ctx: WebToolContext | undefined, key: string) {
  if (ctx?.getEnv) return ctx.getEnv(key);
  return process.env[key];
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function htmlToText(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return {
    title: normalizeWhitespace(title),
    text: normalizeWhitespace(body),
  };
}

function authHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {};
}

function extractLinks(baseUrl: string, html: string) {
  const base = new URL(baseUrl);
  const links = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const raw = match[1];
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) continue;
    try {
      const url = new URL(raw, base);
      if (url.origin === base.origin && (url.protocol === "http:" || url.protocol === "https:")) {
        links.add(url.toString());
      }
    } catch {}
  }
  return Array.from(links);
}

async function localExtract(ctx: WebToolContext | undefined, url: string, maxCharacters: number) {
  const fetcher = getFetch(ctx);
  const res = await fetcher(url, {
    headers: {
      "user-agent": "DesktopAgent/0.1 (+local extraction)",
    },
  });

  if (!res.ok) {
    throw new Error(`Falha ao acessar ${url}: HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  const parsed = contentType.includes("html")
    ? htmlToText(raw)
    : { title: "", text: normalizeWhitespace(raw) };

  return {
    url,
    title: parsed.title,
    content: parsed.text.slice(0, maxCharacters),
    truncated: parsed.text.length > maxCharacters,
    provider: "local",
  };
}

async function firecrawlExtract(
  ctx: WebToolContext | undefined,
  url: string,
  apiKey: string,
  maxCharacters: number,
) {
  const fetcher = getFetch(ctx);
  const res = await fetcher("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
    }),
  });

  if (!res.ok) {
    throw new Error(`Firecrawl retornou HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    data?: { markdown?: string; metadata?: { title?: string } };
  };
  const content = data.data?.markdown ?? "";
  return {
    url,
    title: data.data?.metadata?.title ?? "",
    content: content.slice(0, maxCharacters),
    truncated: content.length > maxCharacters,
    provider: "firecrawl",
  };
}

async function jinaExtract(
  ctx: WebToolContext | undefined,
  url: string,
  apiKey: string | undefined,
  maxCharacters: number,
) {
  const fetcher = getFetch(ctx);
  const res = await fetcher(`https://r.jina.ai/${url}`, {
    headers: {
      accept: "text/plain",
      ...authHeaders(apiKey),
    },
  });

  if (!res.ok) {
    throw new Error(`Jina Reader retornou HTTP ${res.status}`);
  }

  const content = await res.text();
  const normalized = normalizeWhitespace(content);
  return {
    url,
    title:
      normalized
        .split("\n")
        .find((line) => line.startsWith("Title:"))
        ?.replace("Title:", "")
        .trim() ?? "",
    content: normalized.slice(0, maxCharacters),
    truncated: normalized.length > maxCharacters,
    provider: "jina",
  };
}

async function braveSearch(
  ctx: WebToolContext | undefined,
  query: string,
  apiKey: string,
  maxResults: number,
) {
  const fetcher = getFetch(ctx);
  const res = await fetcher(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
    {
      headers: {
        accept: "application/json",
        "x-subscription-token": apiKey,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Brave Search retornou HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    web?: {
      results?: Array<{ title?: string; url?: string; description?: string }>;
    };
  };

  return {
    provider: "brave",
    results: (data.web?.results ?? []).slice(0, maxResults).map((item) => ({
      title: item.title ?? "",
      url: item.url ?? "",
      snippet: item.description ?? "",
    })),
  };
}

async function tavilySearch(
  ctx: WebToolContext | undefined,
  query: string,
  apiKey: string,
  maxResults: number,
) {
  const fetcher = getFetch(ctx);
  const res = await fetcher("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily retornou HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return {
    provider: "tavily",
    results: (data.results ?? []).slice(0, maxResults).map((item) => ({
      title: item.title ?? "",
      url: item.url ?? "",
      snippet: item.content ?? "",
    })),
  };
}

async function jinaSearch(
  ctx: WebToolContext | undefined,
  query: string,
  apiKey: string | undefined,
  maxResults: number,
) {
  const fetcher = getFetch(ctx);
  const searchUrl = `https://s.jina.ai/${encodeURIComponent(query)}`;
  const res = await fetcher(searchUrl, {
    headers: {
      accept: "text/plain",
      ...authHeaders(apiKey),
    },
  });

  if (!res.ok) {
    throw new Error(`Jina Search retornou HTTP ${res.status}`);
  }

  const content = await res.text();
  return {
    provider: "jina",
    results: [
      {
        title: `Busca Jina: ${query}`,
        url: searchUrl,
        snippet: content.slice(0, 4000),
      },
    ].slice(0, maxResults),
    content,
  };
}

export function createWebSearchTool(ctx?: WebToolContext): RegisteredTool {
  return {
    name: "web.search",
    description: "Busca na web usando Brave/Tavily quando houver chave e Jina Search como fallback",
    category: "web",
    permissionLevel: "network",
    inputSchema: searchSchema,
    async handler(input) {
      const parsed = searchSchema.parse(input);
      const maxResults = parsed.maxResults ?? 5;
      const braveKey =
        parsed.provider !== "tavily" && parsed.provider !== "jina"
          ? parsed.apiKey || getEnv(ctx, "BRAVE_API_KEY")
          : "";
      const tavilyKey =
        parsed.provider !== "brave" && parsed.provider !== "jina"
          ? parsed.apiKey || getEnv(ctx, "TAVILY_API_KEY")
          : "";
      const jinaKey =
        parsed.provider !== "brave" && parsed.provider !== "tavily"
          ? parsed.apiKey || getEnv(ctx, "JINA_API_KEY")
          : "";

      if (braveKey) {
        return braveSearch(ctx, parsed.query, braveKey, maxResults);
      }
      if (tavilyKey) {
        return tavilySearch(ctx, parsed.query, tavilyKey, maxResults);
      }

      return jinaSearch(ctx, parsed.query, jinaKey, maxResults);
    },
  };
}

export function createWebExtractTool(ctx?: WebToolContext): RegisteredTool {
  return {
    name: "web.extract",
    description: "Extrai texto limpo de uma página web localmente, via Jina Reader ou Firecrawl opcional",
    category: "web",
    permissionLevel: "network",
    inputSchema: extractSchema,
    async handler(input) {
      const parsed = extractSchema.parse(input);
      const maxCharacters = parsed.maxCharacters ?? 6000;
      const firecrawlKey =
        parsed.provider === "firecrawl" ? parsed.apiKey || getEnv(ctx, "FIRECRAWL_API_KEY") : "";
      const jinaKey = parsed.provider === "jina" ? parsed.apiKey || getEnv(ctx, "JINA_API_KEY") : "";

      if (parsed.provider === "firecrawl" && firecrawlKey) {
        return firecrawlExtract(ctx, parsed.url, firecrawlKey, maxCharacters);
      }
      if (parsed.provider === "jina") {
        return jinaExtract(ctx, parsed.url, jinaKey, maxCharacters);
      }

      return localExtract(ctx, parsed.url, maxCharacters);
    },
  };
}

export function createWebCrawlTool(ctx?: WebToolContext): RegisteredTool {
  return {
    name: "web.crawl",
    description: "Coleta poucas páginas do mesmo domínio para contexto rápido",
    category: "web",
    permissionLevel: "network",
    inputSchema: crawlSchema,
    async handler(input) {
      const parsed = crawlSchema.parse(input);
      const maxPages = parsed.maxPages ?? 3;
      const pages: Array<{ url: string; title: string; content: string; truncated: boolean }> = [];
      const visited = new Set<string>();
      const queue = [parsed.url];

      while (queue.length > 0 && pages.length < maxPages) {
        const url = queue.shift() as string;
        if (visited.has(url)) continue;
        visited.add(url);

        const fetcher = getFetch(ctx);
        const res = await fetcher(url, {
          headers: { "user-agent": "DesktopAgent/0.1 (+local crawl)" },
        });
        if (!res.ok) continue;

        const html = await res.text();
        const parsedPage = htmlToText(html);
        const maxCharacters = parsed.maxCharactersPerPage ?? 4000;
        pages.push({
          url,
          title: parsedPage.title,
          content: parsedPage.text.slice(0, maxCharacters),
          truncated: parsedPage.text.length > maxCharacters,
        });

        for (const link of extractLinks(url, html)) {
          if (!visited.has(link) && queue.length < maxPages * 4) {
            queue.push(link);
          }
        }
      }

      return { pages, provider: "local", maxPages };
    },
  };
}
