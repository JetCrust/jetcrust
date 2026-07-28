import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import GenerateButton from "../../components/GenerateButton";
import { auth } from "@/auth";
import { getAllPosts, parseJson } from "@/lib/posts";

function fmt(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default async function AdminJournal() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/journal");
  if (role !== "ADMIN") {
    return (
      <>
        <AppHeader />
        <main className="section section--cream" style={{ minHeight: "60vh" }}>
          <div className="wrap"><h2>Not authorized</h2><p className="lead">This area is for Jet Crust administrators.</p></div>
        </main>
      </>
    );
  }

  const posts = await getAllPosts();

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="overline eyebrow-line">Admin · Journal</p>
            <h2>The Journal</h2>
            <p className="lead">Write, edit and publish guides. Drafts stay hidden until you publish. Generate a draft to get an original, SEO-friendly starting point about our areas, then review before it goes live.</p>
          </div>

          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "center", marginBottom: "2rem" }}>
            <Link className="btn btn--brass" href="/admin/journal/new">Write a post</Link>
            <GenerateButton />
            <Link className="textlink" href="/admin" style={{ marginLeft: "auto" }}>&larr; Back to bookings</Link>
          </div>

          <div style={{ display: "grid", gap: "0.6rem" }}>
            {posts.length === 0 && <p style={{ color: "var(--stone)" }}>No posts yet. Write one or generate a draft.</p>}
            {posts.map((p) => {
              const tags = parseJson<string[]>(p.tags, []);
              const live = p.status === "PUBLISHED";
              return (
                <Link key={p.id} href={`/admin/journal/${p.id}`} className="post-row">
                  <span>
                    <strong style={{ color: "var(--ink)" }}>{p.title}</strong>
                    <span style={{ display: "block", fontSize: "0.8rem", color: "var(--stone)", marginTop: "0.2rem" }}>
                      {tags[0] || "Uncategorised"}
                      {p.source === "ai" ? " · AI draft" : ""}
                      {live && p.publishedAt ? ` · published ${fmt(p.publishedAt)}` : ` · updated ${fmt(p.updatedAt)}`}
                    </span>
                  </span>
                  <span className="tag" style={live ? undefined : { background: "transparent", border: "1px solid var(--line)", color: "var(--stone)" }}>
                    {live ? "Live" : "Draft"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
