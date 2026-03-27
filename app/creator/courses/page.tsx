import { ClientAuthGate } from "@/app/_components/client-auth";
import CreatorCoursesClient from "@/app/creator/courses/creator-courses-client";
import { SectionSubnav } from "@/app/_components/section-subnav";
import StickyNavbar from "@/app/_components/sticky-navbar";

export default function CreatorCoursesPage() {
  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 md:px-10 md:py-12">
        <ClientAuthGate
          allowedRoles={["creator", "admin"]}
          deniedTitle="Creator access required"
          deniedCopy="This wallet does not currently have creator publishing access."
        >
          <>
            <SectionSubnav
              items={[
                { href: "/creator/uploads", label: "Studio" },
                { href: "/creator/courses", label: "My Courses", match: "exact" },
                { href: "/creator/analytics", label: "Analytics" },
              ]}
            />
            <CreatorCoursesClient />
          </>
        </ClientAuthGate>
      </main>
    </div>
  );
}
