import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SidebarLayout } from './components/Layout/SidebarLayout';
import { AgentEvolutionPage } from './pages/AgentEvolutionPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProspectDetailPage } from './pages/ProspectDetailPage';
import { ProspectFormPage } from './pages/ProspectFormPage';

const AdvisorPage = lazy(() => import('./pages/AdvisorPage').then((m) => ({ default: m.AdvisorPage })));
const ComparisonPage = lazy(() => import('./pages/ComparisonPage').then((m) => ({ default: m.ComparisonPage })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const MLLabPage = lazy(() => import('./pages/MLLabPage').then((m) => ({ default: m.MLLabPage })));
const TargetingPage = lazy(() => import('./pages/TargetingPage').then((m) => ({ default: m.TargetingPage })));
const UploadPage = lazy(() => import('./pages/UploadPage').then((m) => ({ default: m.UploadPage })));

const PageFallback = () => (
  <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading…</div>
);

export function App() {
  return (
    <SidebarLayout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/targeting" element={<TargetingPage />} />
          <Route path="/advisor" element={<AdvisorPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/ml-lab" element={<MLLabPage />} />
          <Route path="/comparison" element={<ComparisonPage />} />
          <Route path="/agents" element={<AgentEvolutionPage />} />
          <Route path="/prospects/new" element={<ProspectFormPage />} />
          <Route path="/prospects/:id/edit" element={<ProspectFormPage />} />
          <Route path="/prospects/:id" element={<ProspectDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SidebarLayout>
  );
}
