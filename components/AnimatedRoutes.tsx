import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { UserProfile, Subject } from '../types';

import LostAndFound from '../pages/LostAndFound';

// Robust lazy loader that automatically refreshes once if a new deployment changed asset chunk hashes
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return React.lazy(async () => {
    try {
      const component = await factory();
      sessionStorage.removeItem('rmch_chunk_reload');
      return component;
    } catch (error) {
      const hasReloaded = sessionStorage.getItem('rmch_chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('rmch_chunk_reload', 'true');
        window.location.reload();
      }
      throw error;
    }
  });
}

// Lazy loaded pages for performance optimization
const Home = lazyWithRetry(() => import('../pages/Home'));
const Attendance = lazyWithRetry(() => import('../pages/Attendance'));
const Library = lazyWithRetry(() => import('../pages/Library'));
const Social = lazyWithRetry(() => import('../pages/Social'));
const Profile = lazyWithRetry(() => import('../pages/Profile'));
const BookRenting = lazyWithRetry(() => import('../pages/BookRenting'));
const AdminPanel = lazyWithRetry(() => import('../pages/AdminPanel'));

interface AnimatedRoutesProps {
  user: UserProfile;
  subjects: Subject[];
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  handleUpdateUser: (updatedProfile: UserProfile) => void;
  handleLogout: () => void;
}

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20 w-full h-full items-center">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    }>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </Suspense>
  );
};

const AnimatedRoutes: React.FC<AnimatedRoutesProps> = ({ user, subjects, setSubjects, handleUpdateUser, handleLogout }) => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Home user={user} /></PageWrapper>} />
        <Route path="/attendance" element={<PageWrapper><Attendance subjects={subjects} setSubjects={setSubjects} username={user.username} /></PageWrapper>} />
        <Route path="/library" element={<PageWrapper><Library username={user.username} /></PageWrapper>} />
        <Route path="/book-renting" element={<PageWrapper><BookRenting user={user} onUpdateUser={handleUpdateUser} /></PageWrapper>} />
        <Route path="/lost-found" element={<PageWrapper><LostAndFound user={user} /></PageWrapper>} />
        <Route path="/social" element={<PageWrapper><Social user={user.username} userAvatar={user.avatar} /></PageWrapper>} />
        <Route path="/profile" element={
          <PageWrapper>
            <Profile user={user} onUpdateUser={handleUpdateUser} onLogout={handleLogout} />
          </PageWrapper>
        } />
        <Route path="/admin" element={
          user.username.toLowerCase() === 'adminrmch' || user.role === 'admin' ? (
            <PageWrapper>
              <AdminPanel user={user} onLogout={handleLogout} />
            </PageWrapper>
          ) : (
            <Navigate to="/" replace />
          )
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

export default AnimatedRoutes;
