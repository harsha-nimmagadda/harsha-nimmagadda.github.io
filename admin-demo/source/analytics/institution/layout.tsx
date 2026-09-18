// ISR hint for institution analytics pages.
// Child pages are client components (data fetched via apiClient), so page-level
// ISR is not applicable directly. This layout's `revalidate` export tells
// Next.js to cache the page shell at the edge and revalidate every 60 seconds,
// reducing cold-load latency for infrequently-changing institution analytics.
//
// TODO: When cohorts/page.tsx and faculty-impact/page.tsx are converted to
// server components, move `export const revalidate = 60` into each page file
// directly so per-page granularity is preserved.
export const revalidate = 60; // seconds

export default function InstitutionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
