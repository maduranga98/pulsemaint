import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import AppRouter from './router/AppRouter';

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </BrowserRouter>
  );
}
