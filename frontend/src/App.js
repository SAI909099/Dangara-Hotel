import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Login from '@/pages/Login';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Rooms from '@/pages/Rooms';
import Guests from '@/pages/Guests';
import GuestCreate from '@/pages/GuestCreate';
import GuestDetail from '@/pages/GuestDetail';
import GuestHistory from '@/pages/GuestHistory';
import GuestsArchive from '@/pages/GuestsArchive';
import Bookings from '@/pages/Bookings';
import Reports from '@/pages/Reports';
import Users from '@/pages/Users';
import RoomCalendar from '@/pages/RoomCalendar';
import '@/App.css';

const ProtectedRoute = ({ children, adminOnly = false, requiredPermission = null }) => {
  const { user, loading, hasPermission, firstAllowedPath } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to={firstAllowedPath()} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to={firstAllowedPath()} replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute requiredPermission="dashboard">
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/rooms" element={
        <ProtectedRoute requiredPermission="rooms">
          <Layout>
            <Rooms />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/guests" element={
        <ProtectedRoute requiredPermission="guests">
          <Layout>
            <Guests />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/guests/archive" element={
        <ProtectedRoute requiredPermission="guests">
          <Layout>
            <GuestsArchive />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Yangi mehmon qo'shish sahifasi */}
      <Route path="/guests/new" element={
        <ProtectedRoute requiredPermission="guests">
          <Layout>
            <GuestCreate />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Mehmon tafsilotlari */}
      <Route path="/guests/:guestId" element={
        <ProtectedRoute requiredPermission="guests">
          <Layout>
            <GuestDetail />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Mehmon tarixi */}
      <Route path="/guests/:guestId/history" element={
        <ProtectedRoute requiredPermission="guests">
          <Layout>
            <GuestHistory />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/bookings" element={
        <ProtectedRoute requiredPermission="bookings">
          <Layout>
            <Bookings />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/calendar" element={
        <ProtectedRoute requiredPermission="calendar">
          <Layout>
            <RoomCalendar />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute requiredPermission="reports">
          <Layout>
            <Reports />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/users" element={
        <ProtectedRoute adminOnly requiredPermission="users">
          <Layout>
            <Users />
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
