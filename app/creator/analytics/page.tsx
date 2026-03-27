import { ClientAuthGate } from "@/app/_components/client-auth";
import CreatorAnalyticsClient from "@/app/creator/analytics/creator-analytics-client";
import { SectionSubnav } from "@/app/_components/section-subnav";
import StickyNavbar from "@/app/_components/sticky-navbar";
import { canViewCreatorAnalytics } from "@/lib/auth/capabilities";

export default function CreatorAnalyticsPage() {
  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 md:px-10 md:py-12">
        <ClientAuthGate
          allow={(profile) => canViewCreatorAnalytics(profile.role)}
          deniedTitle="Creator analytics access required"
          deniedCopy="This wallet does not currently have creator analytics permissions."
        >
          {() => (
            <>
              <SectionSubnav
                items={[
                  { href: "/creator/uploads", label: "Studio" },
                  { href: "/creator/courses", label: "My Courses" },
                  { href: "/creator/analytics", label: "Analytics", match: "exact" },
                ]}
              />
              <CreatorAnalyticsClient />
            </>
          )}
        </ClientAuthGate>
      </main>
    </div>
  );
}
