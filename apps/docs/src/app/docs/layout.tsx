import { DocsMobileNav, DocsSidebar } from "@/components/docs-sidebar";
import { SiteFooter } from "@/components/site-footer";
import { SiteNavbar } from "@/components/site-navbar";
import { getDocsNav } from "@/lib/docs-nav";

export default function Layout({ children }: LayoutProps<"/docs">) {
  const nav = getDocsNav();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNavbar variant="docs" />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 pt-24">
        <aside className="hidden w-64 shrink-0 pl-4 md:block">
          <DocsSidebar groups={nav} />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="px-6 pt-4 md:hidden">
            <DocsMobileNav groups={nav} />
          </div>
          {children}
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
