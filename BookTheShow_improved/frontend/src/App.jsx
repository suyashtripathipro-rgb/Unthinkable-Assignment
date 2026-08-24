import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ShowDetail from './pages/ShowDetail.jsx';
import BookingHistory from './pages/BookingHistory.jsx';
import OrganiserDashboard from './pages/OrganiserDashboard.jsx';
import AdminVenues from './pages/AdminVenues.jsx';
import { useAuth } from './api/AuthContext.jsx';

function Protected({ roles, children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen bg-stage bg-spotlight text-paper">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/shows/:showId" element={<ShowDetail />} />
        <Route
          path="/my-bookings"
          element={
            <Protected roles={['customer']}>
              <BookingHistory />
            </Protected>
          }
        />
        <Route
          path="/organiser"
          element={
            <Protected roles={['organiser', 'admin']}>
              <OrganiserDashboard />
            </Protected>
          }
        />
        <Route
          path="/admin/venues"
          element={
            <Protected roles={['admin']}>
              <AdminVenues />
            </Protected>
          }
        />
      </Routes>
    </div>
  );
}
