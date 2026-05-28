import { PropsWithChildren } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isSupabaseConfigured } from '../../services/supabaseClient';

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
      <aside className="w-72 shrink-0 border-r border-slate-800 p-5 flex flex-col">
        <h1 className="text-xl font-semibold">PetroTarget AI</h1>
        <p className="text-xs text-slate-400 mt-1">Decision intelligence for petroleum exploration</p>
        <nav className="mt-6 space-y-2 flex-1">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={`block rounded-md px-3 py-2 text-sm ${pathname === item.to ? 'bg-slate-800' : 'hover:bg-slate-900'}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-slate-800 pt-4">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            <span className="text-xs text-slate-500">
              Storage: {isSupabaseConfigured ? 'Supabase' : 'Local'}
            </span>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
