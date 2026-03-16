import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ titleId: string }>;
};

export default async function WatchPage({ params }: PageProps) {
  const { titleId } = await params;
  redirect(`/lesson/${titleId}`);
}
