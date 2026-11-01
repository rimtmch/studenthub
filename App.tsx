import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import Layout from './components/Layout';
import AnimatedRoutes from './components/AnimatedRoutes';
import Login from './pages/Login';
import { UserProfile, Subject } from './types';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const isLoggingOutRef = useRef(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    // 1. Immediately clear local session state & redirect
    localStorage.removeItem('rimt_user_obj');
    setUser(null);
    setSubjects([]);
    window.location.hash = '/';

    // 2. Perform non-blocking Supabase local signout
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('Sign out error:', e);
    } finally {
      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 500);
    }
  }, []);

  useEffect(() => {
    // 1. Initial User Load with safe parse & blob url purge
    const savedUser = localStorage.getItem('rimt_user_obj');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.avatar && parsed.avatar.startsWith('blob:')) {
          parsed.avatar = '';
          localStorage.setItem('rimt_user_obj', JSON.stringify(parsed));
        }
        setUser(parsed);
      } catch (e) {
        console.error('Failed to parse saved user:', e);
        localStorage.removeItem('rimt_user_obj');
      }
    }

    // 2. Load Theme
    const savedTheme = localStorage.getItem('rimt_theme') as 'dark' | 'light' | null;
    const initialTheme = savedTheme === 'light' ? 'light' : 'dark';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 3. Fetch Logo
    const fetchLogo = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'logo_url')
          .single();
        if (data?.value) setLogoUrl(data.value);
      } catch (e) {
        console.warn('Error fetching logo', e);
      }
    };
    fetchLogo();

    // 4. Setup Auth Listener (without infinite recursion on SIGNED_OUT)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (!isLoggingOutRef.current) {
          localStorage.removeItem('rimt_user_obj');
          setUser(null);
          setSubjects([]);
          window.location.hash = '/';
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';

    const updateDom = () => {
      setTheme(newTheme);
      localStorage.setItem('rimt_theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    // Safe View Transitions API check with Safari fallback
    const doc = document as unknown as { startViewTransition?: (cb: () => void) => void };
    if (typeof doc.startViewTransition === 'function') {
      try {
        doc.startViewTransition(updateDom);
      } catch {
        updateDom();
      }
    } else {
      updateDom();
    }
  }, [theme]);

  const handleLogin = (profile: UserProfile) => {
    isLoggingOutRef.current = false;
    const sanitized: UserProfile = {
      ...profile,
      avatar: profile.avatar?.startsWith('blob:') ? '' : profile.avatar,
    };
    setUser(sanitized);
    localStorage.setItem('rimt_user_obj', JSON.stringify(sanitized));
    window.location.hash = '/';
  };

  const handleUpdateUser = (updatedProfile: UserProfile) => {
    const sanitized: UserProfile = {
      ...updatedProfile,
      avatar: updatedProfile.avatar?.startsWith('blob:') ? '' : updatedProfile.avatar,
    };
    setUser(sanitized);
    localStorage.setItem('rimt_user_obj', JSON.stringify(sanitized));
  };

  if (!user) {
    return <Login onLogin={handleLogin} logoUrl={logoUrl} />;
  }

  return (
    <Router>
      <Layout
        user={user}
        logoUrl={logoUrl}
        currentTheme={theme}
        toggleTheme={toggleTheme}
      >
        <AnimatedRoutes
          user={user}
          subjects={subjects}
          setSubjects={setSubjects}
          handleUpdateUser={handleUpdateUser}
          handleLogout={handleLogout}
        />
      </Layout>
    </Router>
  );
};

export default App;
