import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import ProtectedRoute from '../components/ProtectedRoute';
import { UserRole } from '../types';
import SecretaryPage from '../pages/SecretaryPage';
import PastorPage from '../pages/PastorPage';
import AdminPage from '../pages/AdminPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute role={UserRole.ADMIN} />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route element={<ProtectedRoute role={UserRole.SECRETARY} />}>
          <Route path="/secretary" element={<SecretaryPage />} />
        </Route>
        <Route element={<ProtectedRoute role={UserRole.PASTOR} />}>
          <Route path="/pastor" element={<PastorPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
