import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import AppRouter from './router/AppRouter';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ToastProvider>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
