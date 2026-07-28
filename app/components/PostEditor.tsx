"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Faq = { q: string; a: string };
export type EditablePost = {
  id?: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  tags: string[];
  faq: Faq[];
  seoTitle: string;
  seoDescription: string;
  status: "DRAFT" | "PUBLISHED";
};

function faqToText(faq: Faq[]) {
  return faq.map((f) => `${f.q} :: ${f.a}`).join("\n");
}
function textToFaq(t: string): Faq[] {
  return t
    .split("\n")
    .map((l) => l.split("::"))
    .filter((p) => p.length >= 2 && p[0].trim())
    .map((p) => ({ q: p[0].trim(), a: p.slice(1).join("::").trim() }));
}

export default function PostEditor({ post }: { post: EditablePost }) {
  const router = useRouter();
  const [f, setF] = useState({ ...post, tagsText: post.tags.join(", "), faqText: faqToText(post.faq) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save(status: "DRAFT" | "PUBLISHED") {
    setBusy(true);
    setErr(null);
    const payload = {
      title: f.title,
      excerpt: f.excerpt,
      body: f.body,
      coverImage: f.coverImage,
      tags: f.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      faq: textToFaq(f.faqText),
      seoTitle: f.seoTitle,
      seoDescription: f.seoDescription,
      status,
    };
    const res = post.id
      ? await fetch(`/api/admin/posts/${post.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch(`/api/admin/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error || "Could not save."); setBusy(false); return; }
    router.push("/admin/journal");
    router.refresh();
  }

  async function remove() {
    if (!post.id || !confirm("Delete this post?")) return;
    setBusy(true);
    await fetch(`/api/admin/posts/${post.id}`, { method: "DELETE" });
    router.push("/admin/journal");
    router.refresh();
  }

  return (
    <div className="editor">
      <div><label>Title</label><input value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
      <div><label>Cover image URL (use our own photos or a free-to-use image)</label><input value={f.coverImage} onChange={(e) => set("coverImage", e.target.value)} placeholder="/assets/img/castelaria/castelaria-17-1400.webp or https://…" /></div>
      <div><label>Tags (comma separated, first is the category)</label><input value={f.tagsText} onChange={(e) => set("tagsText", e.target.value)} placeholder="Bran, Transylvania, Guide" /></div>
      <div><label>Excerpt (shown in listings and as the intro)</label><textarea value={f.excerpt} onChange={(e) => set("excerpt", e.target.value)} /></div>
      <div><label>Body (Markdown)</label><textarea className="body" value={f.body} onChange={(e) => set("body", e.target.value)} placeholder="## Heading&#10;&#10;Write in Markdown…" /></div>
      <div><label>FAQ (one per line, format: Question :: Answer)</label><textarea value={f.faqText} onChange={(e) => set("faqText", e.target.value)} placeholder="When is the best time to visit Bran? :: Late spring and autumn…" /></div>
      <div><label>SEO title (optional)</label><input value={f.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} /></div>
      <div><label>SEO description (optional)</label><textarea value={f.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} /></div>

      {err && <p style={{ color: "#a3412e", fontSize: "0.9rem", margin: 0 }}>{err}</p>}
      <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn--ghost" disabled={busy} onClick={() => save("DRAFT")}>Save draft</button>
        <button className="btn btn--brass" disabled={busy} onClick={() => save("PUBLISHED")}>{post.status === "PUBLISHED" ? "Update & keep live" : "Publish"}</button>
        {post.id && post.status === "PUBLISHED" && (
          <button className="btn btn--ghost" disabled={busy} onClick={() => save("DRAFT")}>Unpublish</button>
        )}
        {post.id && <button className="textlink" style={{ marginLeft: "auto", color: "#a3412e" }} disabled={busy} onClick={remove}>Delete</button>}
      </div>
    </div>
  );
}
