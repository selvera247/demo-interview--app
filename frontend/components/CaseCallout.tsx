import type { ReactNode } from "react";

/** Scannable callout used inside case studies (architecture, eval, governance). */
export default function CaseCallout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="case-callout">
      <div className="case-callout-title">{title}</div>
      <div className="case-callout-body">{children}</div>
    </aside>
  );
}
