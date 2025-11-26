import React from 'react';
import { Home, ClipboardCheck, Book, Coffee, User, BrainCircuit, Sun, Moon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  user: any;
  logoUrl?: string;
  toggleTheme?: () => void;
  currentTheme?: 'light' | 'dark';
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout, user, logoUrl, toggleTheme, currentTheme }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const isActive = currentPath === to;
    return (
      <Link
        to={to}
        className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-500 ${
          isActive 
            ? 'text-blue-600 dark:text-blue-400 -translate-y-2' 
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <div className={`p-3 rounded-2xl transition-all duration-500 ${
            isActive 
                ? 'bg-blue-500/20 dark:bg-white/10 shadow-[0_0_20px_rgba(59,130,246,0.4)] backdrop-blur-xl border border-white/10' 
                : 'hover:bg-white/5'
        }`}>
             <Icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
        </div>
        <span className={`text-[10px] font-bold mt-1.5 transition-all duration-300 absolute -bottom-4 whitespace-nowrap ${
            isActive ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}>
            {label}
        </span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen font-sans selection:bg-blue-500/30 relative transition-colors duration-700">
      
      {/* Top Scroll Gradient Mask */}
      <div className="fixed top-0 left-0 right-0 h-32 mask-gradient-top z-30 pointer-events-none transition-all duration-500"></div>

      {/* Floating Header */}
      <div className="fixed top-0 left-0 right-0 z-40 p-4 sm:p-6 pointer-events-none">
        <header className="max-w-5xl mx-auto glass-heavy rounded-full px-2 pl-3 py-2 sm:px-6 sm:py-3 shadow-2xl pointer-events-auto flex justify-between items-center transition-all duration-500 border-white/20 dark:border-white/10">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img 
                    src={logoUrl || "/logo.png"} 
                    alt="Logo" 
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-white/30 shadow-lg group-hover:scale-110 transition duration-500"
                    onError={(e) => { e.currentTarget.src = "/logo.png" }}
                />
                <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-lg opacity-0 group-hover:opacity-100 transition duration-700"></div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors duration-300">
                  RMCH <span className="font-light opacity-60">Hub</span>
                </h1>
              </div>
            </Link>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1 bg-slate-100/50 dark:bg-white/5 rounded-full p-1.5 border border-white/10 shadow-inner">
              {[
                { to: '/', label: 'Home' },
                { to: '/attendance', label: 'Attendance' },
                { to: '/ai-tutor', label: 'Tutor' },
                { to: '/library', label: 'Library' },
                { to: '/social', label: 'Chill' }
              ].map(link => (
                <Link 
                    key={link.to}
                    to={link.to} 
                    className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-500 ${
                        currentPath === link.to 
                        ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-lg shadow-black/5' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/30 dark:hover:bg-white/5'
                    }`}
                >
                    {link.label}
                </Link>
              ))}
            </div>

            {/* Profile & Theme Toggle */}
            <div className="flex items-center gap-2 sm:gap-3 pr-1">
                {toggleTheme && (
                    <button 
                        onClick={toggleTheme}
                        className="w-10 h-10 rounded-full bg-slate-100/50 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/20 transition-all duration-300 border border-white/10 hover:shadow-lg hover:scale-110 active:scale-95"
                    >
                        {currentTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                )}
                
                <Link to="/profile" className="flex items-center gap-2 group">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-lg border-2 border-white/20 overflow-hidden group-hover:ring-4 ring-blue-500/20 transition-all duration-500 group-hover:scale-105">
                        {user.avatar ? (
                            <img src={user.avatar} className="w-full h-full object-cover" alt="User" />
                        ) : (
                            <span className="font-bold text-sm text-white">{user.fullname.charAt(0)}</span>
                        )}
                    </div>
                </Link>
            </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-40 min-h-screen text-slate-900 dark:text-slate-200">
        {children}
      </main>

      {/* Bottom Scroll Gradient Mask (Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-32 mask-gradient-bottom z-30 pointer-events-none transition-all duration-500"></div>

      {/* Mobile Floating Dock Navigation */}
      <div className="fixed bottom-8 left-0 right-0 z-50 px-4 md:hidden pointer-events-none">
        <nav className="glass-heavy mx-auto max-w-sm rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 pointer-events-auto overflow-hidden">
            <div className="flex justify-between items-center px-4 py-4 overflow-x-auto no-scrollbar gap-1">
                <NavItem to="/" icon={Home} label="Home" />
                <NavItem to="/attendance" icon={ClipboardCheck} label="Attd." />
                <NavItem to="/ai-tutor" icon={BrainCircuit} label="Tutor" />
                <NavItem to="/library" icon={Book} label="Library" />
                <NavItem to="/social" icon={Coffee} label="Chill" />
                <NavItem to="/profile" icon={User} label="Me" />
            </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;