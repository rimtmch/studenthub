import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Home, ClipboardCheck, Book, Coffee, User, Sun, Moon, Store, Bell, AlertTriangle, BookOpen, X, Tag, ShieldAlert } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { UserProfile, Subject } from '../types';
import { supabase } from '../services/supabaseClient';
import {
  InAppNotification,
  getReadNotificationIds,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  requestWebPushPermission,
} from '../services/notifications';
import { getDirectImageUrl, handleImageError } from '../services/imageStorage';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile;
  logoUrl?: string;
  toggleTheme?: () => void;
  currentTheme?: 'light' | 'dark';
}

const Layout: React.FC<LayoutProps> = ({ children, user, logoUrl, toggleTheme, currentTheme }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');
  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission);
    }
  }, []);

  const fetchInAppNotifications = useCallback(async () => {
    if (!user.username) return;
    const readIds = getReadNotificationIds();
    const items: InAppNotification[] = [];

    try {
      // 1. Check attendance alerts
      const { data: profileData } = await supabase
        .from('profiles')
        .select('attendance_data')
        .ilike('username', user.username)
        .maybeSingle();

      if (profileData?.attendance_data && Array.isArray(profileData.attendance_data)) {
        profileData.attendance_data.forEach((sub: Subject) => {
          const theoryPct = sub.theory?.total > 0 ? (sub.theory.attended / sub.theory.total) * 100 : 100;
          if (theoryPct < 75 && sub.theory?.total >= 3) {
            const notifId = `att_${sub.name}_${Math.round(theoryPct)}`;
            items.push({
              id: notifId,
              title: `Attendance Alert: ${sub.name}`,
              message: `Your theory attendance is at ${Math.round(theoryPct)}%. Keep it above 75% to stay eligible for exams.`,
              type: 'attendance',
              link: '/attendance',
              createdAt: new Date().toISOString(),
              isRead: readIds.has(notifId),
            });
          }
        });
      }

      // 2. Check pending requests for user's books
      const { data: bookRequests } = await supabase
        .from('book_requests')
        .select('id, requester_username, status, created_at, listing:book_listings!book_requests_listing_id_fkey!inner(title, lister_username)')
        .eq('listing.lister_username', user.username)
        .eq('status', 'pending');

      if (bookRequests) {
        bookRequests.forEach((req: any) => {
          const notifId = `rental_req_${req.id}`;
          items.push({
            id: notifId,
            title: 'Book Rental Request',
            message: `@${req.requester_username} sent a request to rent "${req.listing?.title}".`,
            type: 'rental',
            link: '/book-renting',
            createdAt: req.created_at || new Date().toISOString(),
            isRead: readIds.has(notifId),
          });
        });
      }

      // 3. Check accepted requests for user
      const { data: acceptedRequests } = await supabase
        .from('book_requests')
        .select('id, requester_username, status, created_at, listing:book_listings!book_requests_listing_id_fkey!inner(title, lister_username)')
        .ilike('requester_username', user.username)
        .eq('status', 'accepted');

      if (acceptedRequests) {
        acceptedRequests.forEach((req: any) => {
          const notifId = `rental_acc_${req.id}`;
          items.push({
            id: notifId,
            title: 'Rental Accepted!',
            message: `Your request for "${req.listing?.title}" was accepted! Tap to chat on WhatsApp.`,
            type: 'rental',
            link: '/book-renting',
            createdAt: req.created_at || new Date().toISOString(),
            isRead: readIds.has(notifId),
          });
        });
      }
    } catch (err) {
      console.warn('Failed to fetch in-app notifications gracefully:', err);
    }

    setNotifications((prev) => {
      const prevIds = prev.map((n) => `${n.id}:${n.isRead}`).join('|');
      const nextIds = items.map((n) => `${n.id}:${n.isRead}`).join('|');
      if (prevIds === nextIds) {
        return prev;
      }
      return items;
    });
  }, [user.username]);

  useEffect(() => {
    fetchInAppNotifications();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchInAppNotifications();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchInAppNotifications]);

  // Close notifications dropdown when clicked outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
    };
    if (showNotifMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showNotifMenu]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleEnablePush = async () => {
    const permission = await requestWebPushPermission();
    setPushStatus(permission);
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(notifications.map((n) => n.id));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleNotificationClick = (item: InAppNotification) => {
    markNotificationAsRead(item.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );
    setShowNotifMenu(false);
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) => {
    const isActive = currentPath === to;
    return (
      <Link
        to={to}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        className={`relative flex flex-col items-center justify-center flex-1 min-w-0 py-1 transition-all duration-300 ${
          isActive
            ? 'text-blue-600 dark:text-blue-400 -translate-y-0.5'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <div
          className={`p-1.5 sm:p-2 rounded-2xl transition-all duration-300 ${
            isActive
              ? 'bg-blue-500/20 dark:bg-white/10 shadow-[0_0_15px_rgba(59,130,246,0.35)] backdrop-blur-xl border border-blue-500/30 dark:border-white/15'
              : 'hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Icon
            className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}
            strokeWidth={isActive ? 2.5 : 2}
          />
        </div>
        <span
          className={`text-[9px] sm:text-[10px] font-bold mt-0.5 truncate max-w-full px-0.5 transition-all duration-200 ${
            isActive ? 'opacity-100 font-extrabold' : 'opacity-70'
          }`}
        >
          {label}
        </span>
      </Link>
    );
  };

  const userInitial = (user.fullname || user.username || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen font-sans selection:bg-blue-500/30 relative transition-colors duration-500">
      {/* Top Scroll Gradient Mask */}
      <div className="fixed top-0 left-0 right-0 h-32 mask-gradient-top z-30 pointer-events-none transition-all duration-500" />

      {/* Floating Header */}
      <div className="fixed top-0 left-0 right-0 z-40 p-3 sm:p-6 pointer-events-none safe-top-padding">
        <header className="max-w-5xl mx-auto glass-heavy rounded-full px-3 py-2 sm:px-6 sm:py-3 shadow-2xl pointer-events-auto flex justify-between items-center transition-all duration-300 border-white/20 dark:border-white/10">
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group" aria-label="RMCH Hub Home">
            <div className="relative">
              <img
                src={logoUrl || 'logo.png'}
                alt="RMCH Logo"
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-white/30 shadow-md group-hover:scale-105 transition duration-300"
                onError={(e) => {
                  e.currentTarget.src = 'logo.png';
                }}
              />
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md opacity-0 group-hover:opacity-100 transition duration-500" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors duration-300">
                RMCH <span className="font-light opacity-60">Hub</span>
              </h1>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1 bg-slate-100/70 dark:bg-white/5 rounded-full p-1.5 border border-slate-200/50 dark:border-white/10 shadow-inner">
            {[
              { to: '/', label: 'Home' },
              { to: '/attendance', label: 'Attendance' },
              { to: '/library', label: 'Library' },
              { to: '/book-renting', label: 'Rent' },
              { to: '/lost-found', label: 'Lost & Found' },
              { to: '/social', label: 'Chill' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 lg:px-5 py-2 rounded-full text-xs lg:text-sm font-semibold transition-all duration-300 ${
                  currentPath === link.to
                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-md shadow-black/5'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Profile & Theme Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 pr-1">
            {toggleTheme && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={currentTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100/70 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-white/20 transition-all duration-300 border border-slate-200/50 dark:border-white/10 hover:shadow-md hover:scale-105 active:scale-95"
              >
                {currentTheme === 'dark' ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />}
              </button>
            )}

            {/* Notifications Bell */}
            <div className="relative" ref={notifMenuRef}>
              <button
                type="button"
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100/70 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-white/20 transition-all duration-300 border border-slate-200/50 dark:border-white/10 hover:shadow-md hover:scale-105 active:scale-95 relative"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-slate-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Popover */}
              {showNotifMenu && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 glass-heavy rounded-3xl p-4 shadow-2xl border border-white/20 z-50 animate-fade-in text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-500" />
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h4>
                      {unreadCount > 0 && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/20">
                          {unreadCount} new
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowNotifMenu(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                        aria-label="Close notifications"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Web Push Prompt */}
                  {pushStatus !== 'granted' && (
                    <div className="my-3 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Turn on Push Notifications</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Get instant attendance & book alerts
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleEnablePush}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm whitespace-nowrap active:scale-95"
                      >
                        Enable
                      </button>
                    </div>
                  )}

                  {/* Notification List */}
                  <div className="max-h-72 overflow-y-auto space-y-2 mt-2 pr-1">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">All caught up!</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">No new alerts at this time.</p>
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <Link
                          key={item.id}
                          to={item.link}
                          onClick={() => handleNotificationClick(item)}
                          className={`block p-3 rounded-2xl transition border ${
                            item.isRead
                              ? 'bg-slate-50/50 dark:bg-white/5 border-slate-200/40 dark:border-white/5 opacity-70 hover:opacity-100'
                              : 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-500/20 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="p-1.5 rounded-xl bg-white dark:bg-white/10 text-blue-500 flex-shrink-0 mt-0.5">
                              {item.type === 'attendance' ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                              ) : item.type === 'rental' ? (
                                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                              ) : (
                                <Bell className="w-3.5 h-3.5 text-purple-500" />
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {item.title}
                              </h5>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                                {item.message}
                              </p>
                            </div>
                            {!item.isRead && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
                            )}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Center Button (Superuser only) */}
            {(user.username.toLowerCase() === 'adminrmch' || user.role === 'admin') && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-black shadow-lg shadow-red-900/40 hover:scale-105 active:scale-95 transition border border-red-400/30 animate-pulse"
                title="RMCH Admin Center"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            <Link to="/profile" className="flex items-center gap-2 group" aria-label="My Profile">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-md border-2 border-white/20 overflow-hidden group-hover:ring-4 ring-blue-500/20 transition-all duration-300 group-hover:scale-105">
                {user.avatar ? (
                  <img
                    src={getDirectImageUrl(user.avatar)}
                    referrerPolicy="no-referrer"
                    onError={handleImageError}
                    className="w-full h-full object-cover"
                    alt={user.fullname || user.username}
                  />
                ) : (
                  <span className="font-bold text-xs sm:text-sm text-white">{userInitial}</span>
                )}
              </div>
            </Link>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-36 min-h-screen text-slate-900 dark:text-slate-200">
        {children}
      </main>

      {/* Bottom Scroll Gradient Mask (Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-28 mask-gradient-bottom z-30 pointer-events-none transition-all duration-500" />

      {/* Mobile Floating Dock Navigation */}
      <div className="fixed bottom-4 sm:bottom-6 left-0 right-0 z-50 px-2 sm:px-3 md:hidden pointer-events-none safe-bottom-dock">
        <nav
          aria-label="Mobile Navigation"
          className="glass-heavy mx-auto max-w-md rounded-[2rem] shadow-[0_16px_40px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 pointer-events-auto overflow-hidden py-1 px-1.5"
        >
          <div className="flex justify-between items-center px-0.5 py-1">
            <NavItem to="/" icon={Home} label="Home" />
            <NavItem to="/attendance" icon={ClipboardCheck} label="Attd." />
            <NavItem to="/library" icon={Book} label="Library" />
            <NavItem to="/book-renting" icon={Store} label="Rent" />
            <NavItem to="/lost-found" icon={Tag} label="L&F" />
            <NavItem to="/social" icon={Coffee} label="Chill" />
            <NavItem to="/profile" icon={User} label="Me" />
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
