import { Routes, Route, Navigate } from 'react-router-dom';
import OrgOverview from './pages/OrgOverview.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<OrgOverview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
