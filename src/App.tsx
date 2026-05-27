import { Navigate, Route, Routes } from 'react-router-dom';
import { SidebarLayout } from './components/Layout/SidebarLayout';
import { AdvisorPage } from './pages/AdvisorPage';
import { DashboardPage } from './pages/DashboardPage';
import { MapPage } from './pages/MapPage';
import { ProspectDetailPage } from './pages/ProspectDetailPage';
import { ProspectFormPage } from './pages/ProspectFormPage';
import { TargetingPage } from './pages/TargetingPage';
import { UploadPage } from './pages/UploadPage';

export function App() {
  return (
    <SidebarLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/targeting" element={<TargetingPage />} />
        <Route path="/advisor" element={<AdvisorPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/prospects/new" element={<ProspectFormPage />} />
        <Route path="/prospects/:id/edit" element={<ProspectFormPage />} />
        <Route path="/prospects/:id" element={<ProspectDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SidebarLayout>
  );
}
