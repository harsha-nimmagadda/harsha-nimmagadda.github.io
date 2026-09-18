// Static-export shim: client body in ./page-client (reads real params via
// useUrlSegment). One placeholder param lets `output: export` emit a shell;
// the SPA fallback serves it for every real id.
import PageClient from "./page-client";
import { staticExportClient, type StaticExportPageProps } from "@/lib/static-export-page-props";
const Client = staticExportClient(PageClient);

export function generateStaticParams(): Array<Record<string, string>> {
  return [{ id: "_", examId: "_" }];
}

export default async function Page({ params }: StaticExportPageProps) {
  return <Client params={params} />;
}
