import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Home from '../pages/Home';
import Attendance from '../pages/Attendance';
import Library from '../pages/Library';
import Social from '../pages/Social';
import Profile from '../pages/Profile';
import BookRenting from '../pages/BookRenting';
import { UserProfile, Subject } from '../types';

interface AnimatedRoutesProps {
  user: UserProfile;
  subjects: Subject[];
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  handleUpdateUser: (updatedProfile: UserProfile) => void;
  handleLogout: () => void;
}

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
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
