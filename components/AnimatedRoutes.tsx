import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { UserProfile, Subject } from '../types';

// Lazy loaded pages for performance optimization
const Home = React.lazy(() => import('../pages/Home'));
const Attendance = React.lazy(() => import('../pages/Attendance'));
const Library = React.lazy(() => import('../pages/Library'));
const Social = React.lazy(() => import('../pages/Social'));
const Profile = React.lazy(() => import('../pages/Profile'));
const BookRenting = React.lazy(() => import('../pages/BookRenting'));

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
        <Route path="/social" element={<PageWrapper><Social user={user.username} userAvatar={user.avatar} /></PageWrapper>} />
        <Route path="/profile" element={
          <PageWrapper>
            <Profile user={user} onUpdateUser={handleUpdateUser} onLogout={handleLogout} />
          </PageWrapper>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

export default AnimatedRoutes;
