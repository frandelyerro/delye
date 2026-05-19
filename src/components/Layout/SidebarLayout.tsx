import { Link, useLocation } from 'react-router-dom';
import { PropsWithChildren } from 'react';

const nav = [
  ['/', 'Dashboard'],
  ['/map', 'Map'],
  ['/advisor', 'AI Advisor']
];

export function SidebarLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  return <div className="min-h-screen bg-slate-950 text-slate-100 flex">
    <aside className="w-64 border-r border-slate-800 p-4">
      <h1 className="text-xl font-bold mb-1">PetroTarget AI</h1>
      <p className="text-xs text-slate-400 mb-6">Decision intelligence for petroleum exploration</p>
      <nav className="space-y-2">{nav.map(([to,label]) => <Link key={to} to={to} className={`block rounded px-3 py-2 ${pathname===to?'bg-slate-800':'hover:bg-slate-900'}`}>{label}</Link>)}</nav>
    </aside>
    <main className="flex-1 p-6">{children}</main>
  </div>;
}
