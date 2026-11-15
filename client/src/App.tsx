import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import AuthPage from './pages/Auth';
import Bookmarks from './pages/Bookmarks';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import NotFound from './pages/NotFound';
import Practice from './pages/Practice';
import Results from './pages/Results';
import TestPage from './pages/Test';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/results/:id" element={<Results />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
        </Route>
        <Route path="/test/:id" element={<TestPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
