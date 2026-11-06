import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './context/ToastContext';
import Dashboard from './pages/Dashboard';
import NewProject from './pages/NewProject';
import BuildDetail from './pages/BuildDetail';
import Downloads from './pages/Downloads';
import Projects from './pages/Projects';
import Signing from './pages/Signing';
import Help from './pages/Help';
import Faq from './pages/Faq';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import About from './pages/About';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewProject />} />
            <Route path="/build/:jobId" element={<BuildDetail />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/signing" element={<Signing />} />
            <Route path="/help" element={<Help />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
