import { redirect } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import PostEditor from "../../../components/PostEditor";
import { auth } from "@/auth";

export default async function NewPost() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/journal/new");
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

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="sec-head"><p className="overline eyebrow-line">Admin · Journal</p><h2>Write a post</h2></div>
          <PostEditor post={{ title: "", excerpt: "", body: "", coverImage: "", tags: [], faq: [], seoTitle: "", seoDescription: "", status: "DRAFT" }} />
        </div>
      </main>
    </>
  );
}
