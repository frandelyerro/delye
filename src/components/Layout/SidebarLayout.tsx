import { PropsWithChildren } from 'react';
import { Link, useLocation } from 'react-router-dom';

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/targeting', label: 'AI Targeting' },
  { to: '/map', label: 'Map' },
  { to: '/advisor', label: 'Advisor' },
  { to: '/upload', label: 'Upload' },
];

export function SidebarLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <aside className="w-72 border-r border-slate-800 p-5">
        <h1 className="text-xl font-semibold">PetroTarget AI</h1>
        <p className="text-xs text-slate-400 mt-1">Decision intelligence for petroleum exploration</p>
        <nav className="mt-6 space-y-2">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={`block rounded-md px-3 py-2 text-sm ${pathname === item.to ? 'bg-slate-800' : 'hover:bg-slate-900'}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
