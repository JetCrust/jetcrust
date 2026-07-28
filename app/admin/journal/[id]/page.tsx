import { redirect, notFound } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import PostEditor from "../../../components/PostEditor";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseJson, type Faq } from "@/lib/posts";

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/journal");
  if (role !== "ADMIN") {
    return (
      <>
        <AppHeader />
        <main className="section section--cream" style={{ minHeight: "60vh" }}>
          <div className="wrap"><h2>Not authorized</h2></div>
        </main>
      </>
    );
  }

  const { id } = await params;
  const p = await prisma.post.findUnique({ where: { id } });
  if (!p) notFound();

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="overline eyebrow-line">Admin · Journal</p>
            <h2>{p.status === "PUBLISHED" ? "Edit published post" : "Edit draft"}</h2>
            {p.source === "ai" && <p className="lead">This started as an AI draft. Review the facts, tidy the wording, then publish.</p>}
          </div>
          <PostEditor
            post={{
              id: p.id,
              title: p.title,
              excerpt: p.excerpt,
              body: p.body,
              coverImage: p.coverImage || "",
              tags: parseJson<string[]>(p.tags, []),
              faq: parseJson<Faq[]>(p.faq, []),
              seoTitle: p.seoTitle || "",
              seoDescription: p.seoDescription || "",
              status: p.status,
            }}
          />
        </div>
      </main>
    </>
  );
}
