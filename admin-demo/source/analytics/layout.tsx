import { AnalyticsCommandPalette } from "./_components/command-palette-provider";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnalyticsCommandPalette />
      {children}
    </>
  );
}
