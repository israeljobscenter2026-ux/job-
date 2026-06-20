import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LeadsPage from './pages/LeadsPage.jsx';
import LeadDetailsPage from './pages/LeadDetailsPage.jsx';
import RemindersPage from './pages/RemindersPage.jsx';
import AreasPage from './pages/AreasPage.jsx';
import AdsPage from './pages/AdsPage.jsx';
import PublisherGroupsPage from './pages/PublisherGroupsPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './contexts/AuthContext.jsx';

export default function App() {
  const { ready } = useAuth();
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        טוען...
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/leads" element={<LeadsPage />} />
          <Route path="/admin/leads/:id" element={<LeadDetailsPage />} />
          <Route path="/admin/reminders" element={<RemindersPage />} />
          <Route path="/admin/areas" element={<AreasPage />} />
          <Route path="/admin/ads" element={<AdsPage />} />
          <Route path="/admin/publisher-groups" element={<PublisherGroupsPage />} />
          <Route path="/admin/templates" element={<TemplatesPage />} />
          <Route path="/admin/account" element={<AccountPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
