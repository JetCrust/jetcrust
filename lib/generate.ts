import Anthropic from "@anthropic-ai/sdk";
import { slugify } from "./posts";
import { getProperties, imageUrl, type Property } from "./properties";

// Original, SEO-friendly Journal drafts about the areas we host in.
// Two steps keep content copyright-clean and valuable:
//   1) Claude researches with web search: what's notable and TRENDING right now,
//      what good guides cover, plus a couple of reputable sources for inspiration.
//   2) Claude writes an ORIGINAL article from that brief (nothing is copied),
//      with a short "Further reading" list of those sources for reader value.
//
// Topics and cover photos are derived from our LIVE properties, so as new homes
// (and new areas) are added, the Journal automatically starts covering them.

// Sonnet 5: near-Opus writing quality for review-first drafts, at lower cost.
const MODEL = "claude-sonnet-5";

// Generic fallback covers (our own photography) if no area photo is found.
const FALLBACK_COVERS = [
  "/assets/img/castelaria/castelaria-03-1400.webp",
  "/assets/img/castelaria-aerial-1400.webp",
  "/assets/img/marque-bedroom-1400.webp",
];

// Evergreen, cross-area topics that always apply to a Romania portfolio.
const EVERGREEN = [
  "Romanian food and wine: what to try and where",
  "Getting around Romania: airports, transfers and driving tips",
  "Quiet luxury in the Carpathians: how to plan a slow trip",
];

export type GeneratedPost = {
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  tags: string[];
  faq: { q: string; a: string }[];
  seoTitle: string;
  seoDescription: string;
  source: string;
};

const articleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    excerpt: { type: "string" },
    body: { type: "string", description: "Full article in Markdown. Use ## and ### headings, short paragraphs, and lists." },
    tags: { type: "array", items: { type: "string" } },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { q: { type: "string" }, a: { type: "string" } },
        required: ["q", "a"],
      },
    },
    seoTitle: { type: "string" },
    seoDescription: { type: "string" },
  },
  required: ["title", "excerpt", "body", "tags", "faq", "seoTitle", "seoDescription"],
} as const;

// ---- Areas & topics, derived from live properties ------------------------

// "Bran · Transylvania" -> ["Bran", "Transylvania"]; "Bucharest" -> ["Bucharest"].
export async function areasFromProperties(): Promise<string[]> {
  const seen = new Set<string>();
  const areas: string[] = [];
  for (const p of await getProperties()) {
    for (const part of String(p.location || "").split(/[·,/|]/)) {
      const a = part.trim();
      if (a && !seen.has(a.toLowerCase())) {
        seen.add(a.toLowerCase());
        areas.push(a);
      }
    }
  }
  return areas;
}

function topicsForArea(area: string): string[] {
  return [
    `A first-timer's guide to ${area}`,
    `The best things to do in and around ${area}`,
    `Where to eat and drink in ${area}`,
    `Day trips and nearby escapes from ${area}`,
    `The best time of year to visit ${area}`,
    `A quiet luxury weekend in ${area}`,
  ];
}

// The full rotating topic list: every area's topics, then the evergreen ones.
export async function getTopics(): Promise<string[]> {
  const areaTopics = (await areasFromProperties()).flatMap(topicsForArea);
  return [...areaTopics, ...EVERGREEN];
}

// Match a topic to the property whose area it mentions, so the cover photo is
// from a home in that place (our own, copyright-clean imagery).
async function coverForTopic(topic: string): Promise<string> {
  const t = topic.toLowerCase();
  const match: Property | undefined = (await getProperties()).find((p) =>
    String(p.location || "")
      .split(/[·,/|]/)
      .some((part) => part.trim() && t.includes(part.trim().toLowerCase())),
  );
  if (match?.card?.image) {
    return imageUrl(match.img_key, match.card.image, 1400);
  }
  let h = 0;
  for (const c of topic) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK_COVERS[h % FALLBACK_COVERS.length];
}

// ---- Generation ----------------------------------------------------------

// House writing rules: highest-quality human writing, and NEVER em/en dashes.
const STYLE = [
  "Write like a well-travelled human editor for a luxury rentals brand called Jet Crust.",
  "Warm, precise, confident. No fluff, no clichés, no 'nestled in'.",
  "NEVER use em dashes or en dashes (— or –). Use commas, full stops, or 'to' for ranges.",
  "Everything must be ORIGINAL: synthesise facts in your own words, never copy phrasing from sources.",
  "Give the reader real, usable value: specifics, practical tips, and honest guidance, not filler.",
  "Be accurate. If unsure of a detail, keep it general rather than inventing specifics.",
  "British English. Around 900 to 1300 words in the body.",
].join(" ");

type Source = { title: string; url: string };

function parseSources(text: string): Source[] {
  const out: Source[] = [];
  const seen = new Set<string>();
  // Lines like: "- Title | https://example.com"
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*[-*]?\s*(.+?)\s*\|\s*(https?:\/\/\S+)/);
    if (m) {
      const url = m[2].replace(/[.,)\]]+$/, "");
      if (!seen.has(url)) { seen.add(url); out.push({ title: m[1].trim(), url }); }
    }
  }
  // Fallback: bare URLs anywhere.
  if (out.length === 0) {
    for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) {
      const url = m[0].replace(/[.,)\]]+$/, "");
      if (!seen.has(url)) { seen.add(url); out.push({ title: new URL(url).hostname.replace(/^www\./, ""), url }); }
    }
  }
  return out.slice(0, 3);
}

export async function generatePost(topic: string): Promise<GeneratedPost> {
  const client = new Anthropic();

  // Step 1: research — current facts, what's TRENDING, and reputable sources.
  const research = await client.messages.create({
    model: MODEL,
    max_tokens: 5000,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    messages: [
      {
        role: "user",
        content:
          `Research this travel topic for a luxury-travel guide: "${topic}". ` +
          `Focus on Romania (Bran, Moeciu, Transylvania, Bucharest) where relevant.\n\n` +
          `Find and summarise, in your own words (do not copy any sentences):\n` +
          `- What is genuinely notable and worth a traveller's time here.\n` +
          `- What is TRENDING or newly popular right now, plus any seasonal or timely highlights.\n` +
          `- Practical specifics: distances, timings, opening notes, seasonality, insider tips.\n` +
          `- The angle that would give a discerning reader the most value.\n\n` +
          `Then end with a section headed exactly "SOURCES:" listing 2 to 3 reputable sources ` +
          `(official tourism boards or well-regarded guides) as lines in the form: "- Title | URL". ` +
          `Only include sources you actually consulted.`,
      },
    ],
  });
  const researchText = research.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const sources = parseSources(researchText);
  const brief = researchText.split(/SOURCES:/i)[0].trim();

  // Step 2: write the original article as structured JSON.
  const article = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: STYLE,
    output_config: { format: { type: "json_schema", schema: articleSchema } },
    messages: [
      {
        role: "user",
        content:
          `Write an original, SEO-friendly guide on: "${topic}".\n\n` +
          `Use this research brief for facts and for what's currently notable (do not copy its wording):\n` +
          `${brief || "(no brief available; rely on general knowledge and keep details general)"}\n\n` +
          `Requirements:\n` +
          `- Engaging title and a 1 to 2 sentence excerpt.\n` +
          `- Body in Markdown with ## sections and short paragraphs. Lead with what gives the reader the most value.\n` +
          `- Reflect what is currently popular or timely where it genuinely helps the reader.\n` +
          `- 3 to 5 tags; the FIRST tag is the category (e.g. Bran, Transylvania, Bucharest, Guide).\n` +
          `- 4 to 6 genuinely useful FAQ questions and answers.\n` +
          `- seoTitle under 60 characters, seoDescription under 155 characters.\n` +
          `- Naturally mention that Jet Crust offers luxury stays in these areas, without hard selling.\n` +
          `- Do NOT add a sources or further-reading section yourself; it is appended separately.`,
      },
    ],
  });

  const text = article.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text || "{}";
  const data = JSON.parse(text) as Omit<GeneratedPost, "coverImage" | "source">;

  let body = data.body || "";
  if (sources.length) {
    body += `\n\n## Further reading\n\n` + sources.map((s) => `- [${s.title}](${s.url})`).join("\n") + "\n";
  }

  return {
    title: data.title,
    excerpt: data.excerpt,
    body,
    tags: Array.isArray(data.tags) ? data.tags : [],
    faq: Array.isArray(data.faq) ? data.faq : [],
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    coverImage: await coverForTopic(topic),
    source: "ai",
  };
}

// Save a generated post as a DRAFT for admin review. Ensures a unique slug.
// `publish` = go live immediately (used by the scheduled job). The manual admin
// button leaves it as a draft for review.
export async function generateAndSaveDraft(topic: string, publish = false) {
  const { prisma } = await import("./prisma");
  const post = await generatePost(topic);

  const root = slugify(post.title) || "post";
  let slug = root;
  let n = 2;
  while (await prisma.post.findUnique({ where: { slug } })) slug = `${root}-${n++}`;

  return prisma.post.create({
    data: {
      slug,
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      coverImage: post.coverImage,
      tags: JSON.stringify(post.tags),
      faq: JSON.stringify(post.faq),
      seoTitle: post.seoTitle || null,
      seoDescription: post.seoDescription || null,
      status: publish ? "PUBLISHED" : "DRAFT",
      source: post.source,
      publishedAt: publish ? new Date() : null,
    },
  });
}

// Pick the next topic by rotating through the area-derived list as posts
// accumulate, so coverage spreads across every area (new homes included).
export async function pickNextTopic(): Promise<string> {
  const { prisma } = await import("./prisma");
  const topics = await getTopics();
  if (topics.length === 0) return "A quiet luxury weekend in Romania";
  const count = await prisma.post.count();
  return topics[count % topics.length];
}
