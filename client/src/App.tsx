import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { Navbar } from './components/Navbar.js';
import { AuthScreen } from './pages/AuthScreen.js';
import { ProjectsScreen } from './pages/ProjectsScreen.js';
import { ProjectWorkspaceScreen } from './pages/ProjectWorkspaceScreen.js';
import { GenerateScreen } from './pages/GenerateScreen.js';
import { ReviewScreen } from './pages/ReviewScreen.js';
import { SourcesScreen } from './pages/SourcesScreen.js';
import { SharedHandoverScreen } from './pages/SharedHandoverScreen.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
            <Navbar />
            <main className="flex-1 w-full pb-12">
              <Routes>
                {/* Public Auth Screen */}
                <Route path="/signin" element={<AuthScreen />} />

                {/* Protected Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/projects" replace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute>
                      <ProjectsScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/:id"
                  element={
                    <ProtectedRoute>
                      <ProjectWorkspaceScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/generate"
                  element={
                    <ProtectedRoute>
                      <GenerateScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sources"
                  element={
                    <ProtectedRoute>
                      <SourcesScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/handovers/:id"
                  element={
                    <ProtectedRoute>
                      <ReviewScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/handovers/:id/shared"
                  element={
                    <ProtectedRoute>
                      <SharedHandoverScreen />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/projects" replace />} />
              </Routes>
            </main>
            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500">
              <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                <p>Prasaranam — Verifiable Project Knowledge Handover System</p>
                <p>Multi-tenant Row-Level Security & Verbatim Citations Active</p>
              </div>
            </footer>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
