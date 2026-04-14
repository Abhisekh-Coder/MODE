import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewPlaybook from './pages/NewPlaybook';
import Pipeline from './pages/Pipeline';
import SettingsPrompts from './pages/SettingsPrompts';
import SettingsModels from './pages/SettingsModels';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const authed = sessionStorage.getItem('mode_auth') === 'true';
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/landing" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<NewPlaybook />} />
        <Route path="/pipeline/:runId" element={<Pipeline />} />
        <Route path="/settings/prompts" element={<SettingsPrompts />} />
        <Route path="/settings/models" element={<SettingsModels />} />
      </Route>
      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  );
}
