import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Register from './pages/Register';
import Display from './pages/Display';
import Staff from './pages/Staff';
import Records from './pages/Records';
import Feedback from './pages/Feedback';

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/register" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/display" element={<Display />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/records" element={<Records />} />
          <Route path="/feedback/:lang" element={<Feedback />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}