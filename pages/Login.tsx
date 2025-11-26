import React, { useState } from 'react';
import { UserProfile } from '../types';
import { supabase, getErrorMessage } from '../services/supabaseClient';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
  logoUrl?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, logoUrl }) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Registration States
  const [regName, setRegName] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regPin, setRegPin] = useState('');

  // CONFIGURATION
  const ALLOW_REGISTRATION = true;

  const handleLogin = async () => {
    if (!username || !pin) {
        setError("Please enter username and PIN");
        return;
    }
    setError('');
    setIsLoading(true);

    try {
        let emailToLogin = '';
        if (username.includes('@')) {
            emailToLogin = username;
        } else {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .eq('username', username)
                .single();
            
            if (profileError || !profileData) {
                setError("User not found");
                setIsLoading(false);
                return;
            }
            emailToLogin = profileData.email;
        }

        const { error: authError } = await supabase.auth.signInWithPassword({
            email: emailToLogin,
            password: pin
        });

        if (authError) {
             setError("Incorrect credentials");
             setIsLoading(false);
             return;
        }

        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', emailToLogin)
            .single();
            
        if (fetchError || !profile) {
             setError("Profile could not be loaded");
             setIsLoading(false);
             return;
        }

        const userProfile: UserProfile = {
            username: profile.username,
            fullname: profile.fullname,
            email: profile.email,
            phone: profile.phone,
            dob: profile.dob,
            pin: profile.pin,
            avatar: profile.avatar_data || profile.avatar_url,
            username_last_changed: profile.username_last_changed
        };
        onLogin(userProfile);

    } catch (e) {
        setError("An unexpected error occurred");
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegister = async () => {
      setError('');
      if(!regName || !regUser || !regPin || !regEmail || !regPhone) {
          setError("All fields are required");
          return;
      }
      if(regPin.length < 4) {
          setError("PIN must be at least 4 digits");
          return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(regUser)) {
          setError("Username can only contain letters, numbers, and underscores");
          return;
      }

      setIsLoading(true);

      try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
              email: regEmail,
              password: regPin 
          });

          if (authError) {
              if (authError.message.includes("registered")) {
                  setError("Email already registered");
              } else {
                  setError(authError.message);
              }
              setIsLoading(false);
              return;
          }

          if (authData.user) {
              const { error: profileError } = await supabase
                  .from('profiles')
                  .insert([{
                      id: authData.user.id,
                      username: regUser,
                      email: regEmail,
                      pin: regPin,
                      fullname: regName,
                      dob: regDob,
                      phone: regPhone,
                      attendance_data: []
                  }]);

              if (profileError) {
                  if (profileError.code === '23505') { 
                      setError("Username already taken");
                  } else {
                      setError(getErrorMessage(profileError));
                  }
                  setIsLoading(false);
                  return;
              }

              const newUser: UserProfile = {
                  username: regUser,
                  fullname: regName,
                  email: regEmail,
                  phone: regPhone,
                  dob: regDob,
                  pin: regPin
              };
              onLogin(newUser);
          }
      } catch (e: any) {
          setError(e.message || "Registration failed");
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        <div className="text-center mb-10">
            <div className="relative inline-block group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-500 blur-2xl opacity-40 group-hover:opacity-60 transition duration-700 rounded-full animate-pulse-slow"></div>
                <img 
                    src={logoUrl || "/logo.png"} 
                    alt="Logo" 
                    className="w-32 h-32 rounded-[2.5rem] mx-auto mb-6 object-cover border-4 border-white/10 shadow-2xl relative z-10 transform group-hover:scale-105 transition duration-500"
                    onError={(e) => { e.currentTarget.src = "/logo.png" }}
                />
            </div>
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-sm">Welcome Back</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Sign in to Student Hub</p>
        </div>

        <div className="glass rounded-[3rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] space-y-6 relative overflow-hidden border border-white/20">
          {/* Shine effect */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50"></div>
          
          {isRegistering ? (
             <div className="space-y-4 animate-fade-in">
                 <h3 className="text-center text-xl font-bold text-slate-900 dark:text-white mb-4">New Account</h3>
                 {error && <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{error}</div>}
                 
                 <div className="space-y-3">
                    <input type="text" placeholder="Full Name" className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" value={regName} onChange={e => setRegName(e.target.value)} />
                    <input type="text" placeholder="Username" className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" value={regUser} onChange={e => setRegUser(e.target.value)} />
                    <input type="email" placeholder="Email" className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                        <input type="date" className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition text-sm backdrop-blur-sm" value={regDob} onChange={e => setRegDob(e.target.value)} />
                        <input type="tel" placeholder="Phone" className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                    </div>
                    <input type="password" placeholder="PIN (4+ digits)" className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" value={regPin} onChange={e => setRegPin(e.target.value)} />
                 </div>
                 
                 <button onClick={handleRegister} disabled={isLoading} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-4 rounded-2xl font-bold transition flex justify-center items-center gap-2 shadow-lg shadow-green-500/20 active:scale-95 border border-white/10">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Sign Up'}
                 </button>
                 <button onClick={() => setIsRegistering(false)} className="w-full text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition py-2">Cancel</button>
             </div>
          ) : (
             <div className="space-y-6 animate-fade-in">
                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{error}</div>}
                
                <div className="space-y-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400 ml-2 font-bold uppercase tracking-widest opacity-80">Username</label>
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition backdrop-blur-sm placeholder-slate-400 dark:placeholder-slate-600 font-medium"
                        placeholder="Enter username"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400 ml-2 font-bold uppercase tracking-widest opacity-80">PIN</label>
                    <input 
                        type="password" 
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition tracking-[0.5em] text-center font-bold text-xl placeholder-slate-400 dark:placeholder-slate-600 backdrop-blur-sm"
                        placeholder="••••"
                    />
                </div>
                <button onClick={handleLogin} disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl font-bold transition shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2 active:scale-95 transform duration-200 border border-white/10">
                    {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Login'}
                </button>
                
                <div className="pt-2 text-center">
                    {ALLOW_REGISTRATION ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            New student? <button onClick={() => { setIsRegistering(true); setError(''); }} className="text-blue-600 dark:text-blue-300 hover:text-blue-500 dark:hover:text-blue-200 transition font-bold ml-1">Create Account</button>
                        </p>
                    ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium opacity-70">
                            Registration closed • Contact Admin
                        </p>
                    )}
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;