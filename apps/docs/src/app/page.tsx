import { redirect } from "next/navigation";

// This is a developer tool, not a SaaS — there's no marketing landing. The docs
// are the site.
export default function Home() {
  redirect("/docs");
}
