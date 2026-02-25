import React, { Suspense } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthProvider } from './components/AuthProvider';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/ui/Toast';

// Lazy load pages for better performance
const AuthPage = React.lazy(() => import('./pages/AuthPage').then(module => ({ default: module.AuthPage })));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage').then(module => ({ default: module.ResetPasswordPage })));
const EnhancedDashboardPage = React.lazy(() => import('./pages/EnhancedDashboardPage').then(module => ({ default: module.EnhancedDashboardPage })));
const SharedSessionViewer = React.lazy(() => import('./components/chat/SharedSessionViewer').then(module => ({ default: module.SharedSessionViewer })));

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-primary flex items-center justify-center transition-colors duration-200">
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        <span className="text-gray-600 dark:text-dark-secondary">Loading...</span>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();

  // Check for shared session route
  if (window.location.pathname.startsWith('/share/') || window.location.pathname.startsWith('/shared/')) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <SharedSessionViewer />
      </Suspense>
    );
  }

  // Check for reset password route
  if (window.location.pathname === '/reset-password') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <ResetPasswordPage />
      </Suspense>
    );
  }

  console.log('🎯 AppContent: Render state:', {
    loading,
    hasUser: !!user,
    hasProfile: !!profile,
    userId: user?.id,
    profileName: profile?.name
  });

  if (loading) {
    console.log('⏳ AppContent: Showing loading screen');
    return <LoadingScreen />;
  }

  if (!user || !profile) {
    console.log('🔐 AppContent: No user/profile, showing auth page');
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AuthPage />
      </Suspense>
    );
  }

  console.log('✅ AppContent: User authenticated, showing dashboard');
  return (
    <Suspense fallback={<LoadingScreen />}>
      <EnhancedDashboardPage />
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;