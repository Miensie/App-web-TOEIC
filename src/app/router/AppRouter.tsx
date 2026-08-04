import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { RegisterPage } from '@/features/auth/components/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/components/ForgotPasswordPage';
import { DashboardPage } from '@/features/dashboard/components/DashboardPage';
import { TestsListPage } from '@/features/exam/components/TestsListPage';
import { ExamPage } from '@/features/exam/components/ExamPage';
import { ResultPage } from '@/features/results/components/ResultPage';
import { HistoryPage } from '@/features/history/components/HistoryPage';
import { AdminPage } from '@/features/admin/components/AdminPage';
import { AppLayout } from '@/shared/components/layout/AppLayout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  return profile?.role === 'ADMIN' ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export function AppRouter() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tests" element={<TestsListPage />} />
        <Route path="tests/:testId/exam" element={<ExamPage />} />
        <Route path="results/:resultId" element={<ResultPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}