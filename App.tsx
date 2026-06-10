
import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    // 1. Initial Data Load
    const savedUser = localStorage.getItem('rimt_user_obj');
    if (savedUser) {
        setUser(JSON.parse(savedUser));
    }

    // 2. Load Theme
    const savedTheme = localStorage.getItem('rimt_theme') as 'dark' | 'light';
    if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (savedTheme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    // Fetch Logo
    const fetchLogo = async () => {
        try {
            const { data } = await supabase.from('settings').select('value').eq('key', 'logo_url').single();
            if (data?.value) setLogoUrl(data.value);
        } catch (e) {
            console.error("Error fetching logo", e);
        }
    };
    fetchLogo();

    // 3. Setup Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            handleLogout();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            // session active
        }
    });

    return () => {
        subscription.unsubscribe();
    };
  }, []);

  const toggleTheme = () => {
      const newTheme = theme === 'dark' ? 'light' : 'dark';
      
      const updateDom = () => {
          setTheme(newTheme);
          localStorage.setItem('rimt_theme', newTheme);
          document.documentElement.setAttribute('data-theme', newTheme);
          if (newTheme === 'dark') document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
      };

      // Check for View Transitions API support
      if (!(document as any).startViewTransition) {
          updateDom();
          return;
      }

      (document as any).startViewTransition(() => {
          updateDom();
      });
  };

  const handleLogin = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('rimt_user_obj', JSON.stringify(profile));
    window.location.hash = '/';
  };

  const handleUpdateUser = (updatedProfile: UserProfile) => {
    setUser(updatedProfile);
    localStorage.setItem('rimt_user_obj', JSON.stringify(updatedProfile));
  };

  const handleLogout = async () => {
    setUser(null);
    setSubjects([]); 
    localStorage.removeItem('rimt_user_obj');
    await supabase.auth.signOut();
    window.location.hash = '/';
  };

  if (!user) {
    return <Login onLogin={handleLogin} logoUrl={logoUrl} />;
  }

  return (
    <Router>
      <Layout onLogout={handleLogout} user={user} logoUrl={logoUrl} currentTheme={theme} toggleTheme={toggleTheme}>
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
