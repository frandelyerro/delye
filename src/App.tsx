import { Navigate, Route, Routes } from 'react-router-dom';
import { SidebarLayout } from './components/Layout/SidebarLayout';
import { AdvisorPage } from './pages/AdvisorPage';
import { DashboardPage } from './pages/DashboardPage';
import { MapPage } from './pages/MapPage';
import { ProspectDetailPage } from './pages/ProspectDetailPage';

export function App() {
  return <SidebarLayout><Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/map" element={<MapPage />} />
    <Route path="/advisor" element={<AdvisorPage />} />
    <Route path="/prospects/:id" element={<ProspectDetailPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></SidebarLayout>;
}
