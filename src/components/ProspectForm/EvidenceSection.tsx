import type { ReactNode } from 'react';

// Shared wrapper for the six petroleum-system evidence blocks on the prospect
// form (Source / Migration / Reservoir / Seal / Trap / Timing). Each block has
// an identical section card + accent-colored heading + responsive field grid;
// only the title, accent class, and field contents differ.
type EvidenceSectionProps = {
  title: string;
  accentClass: string;
  children: ReactNode;
};

export function EvidenceSection({ title, accentClass, children }: EvidenceSectionProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className={`text-base font-semibold ${accentClass}`}>{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
