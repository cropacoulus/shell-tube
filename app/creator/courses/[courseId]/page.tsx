import { ClientAuthGate } from "@/app/_components/client-auth";
import CreatorCourseDetailClient from "@/app/creator/courses/[courseId]/creator-course-detail-client";
import { SectionSubnav } from "@/app/_components/section-subnav";
import StickyNavbar from "@/app/_components/sticky-navbar";
import { canPublishContent } from "@/lib/auth/capabilities";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CreatorCourseDetailPage({ params }: PageProps) {
  const { courseId } = await params;

  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 md:px-10 md:py-12">
        <ClientAuthGate
          allow={(profile) => canPublishContent(profile.role)}
          deniedTitle="Creator access required"
          deniedCopy="This wallet does not currently have creator publishing access."
        >
          {() => (
            <>
              <SectionSubnav
                items={[
                  { href: "/creator/uploads", label: "Studio" },
                  { href: "/creator/courses", label: "My Courses" },
                  { href: "/creator/analytics", label: "Analytics" },
                ]}
              />
              <CreatorCourseDetailClient courseId={courseId} />
            </>
          )}
        </ClientAuthGate>
      </main>
    </div>
  );
}
