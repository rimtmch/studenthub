import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { supabase, getErrorMessage } from '../services/supabaseClient';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
  logoUrl?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, logoUrl }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Forgot Password States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(window.location.hash === '#/reset-password');
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resetOtp, setResetOtp] = useState('');
  
  // Force Password Change States
  const [requirePasswordChangeProfile, setRequirePasswordChangeProfile] = useState<UserProfile | null>(null);
  const [forceNewPassword, setForceNewPassword] = useState('');
  
  // Registration States
  const [regName, setRegName] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // CONFIGURATION
  const ALLOW_REGISTRATION = true;

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
        setError("Please enter username and password");
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
            password: password
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
            pin: profile.password || profile.pin,
            avatar: profile.avatar_data || profile.avatar_url,
            username_last_changed: profile.username_last_changed
        };

        const weakPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!weakPasswordRegex.test(password)) {
            setRequirePasswordChangeProfile(userProfile);
            return;
        }

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
      if(!regName || !regUser || !regPassword || !regEmail || !regPhone) {
          setError("All fields are required");
          return;
      }
      
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(regPassword)) {
          setError("Password must be at least 8 characters, include uppercase, lowercase, number and special character");
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
              password: regPassword 
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
                      password: regPassword,
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
                  pin: regPassword
              };
              onLogin(newUser);
          }
      } catch (e: any) {
          setError(e.message || "Registration failed");
      } finally {
          setIsLoading(false);
      }
  };

  const handleUpdatePassword = async () => {
      setError('');
      setResetMessage('');
      
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(newPassword)) {
          setError("Password must be at least 8 characters, include uppercase, lowercase, number and special character");
          return;
      }

      setIsLoading(true);
      try {
          const { error } = await supabase.auth.updateUser({
              password: newPassword
          });
          
          if (error) {
              setError(error.message);
          } else {
              const { data: { user } } = await supabase.auth.getUser();
              if (user && user.email) {
                  await supabase.from('profiles').update({ pin: newPassword }).eq('email', user.email);
              }
              setResetMessage("Password reset successfully! You can now login.");
              setIsResettingPassword(false);
              setNewPassword('');
              await supabase.auth.signOut();
          }
      } catch (e: any) {
          setError("An unexpected error occurred");
      } finally {
          setIsLoading(false);
      }
  };

  const handleForcePasswordChange = async () => {
      setError('');
      
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(forceNewPassword)) {
          setError("Password must be at least 8 characters, include uppercase, lowercase, number and special character");
          return;
      }

      setIsLoading(true);
      try {
          const { error: updateError } = await supabase.auth.updateUser({
              password: forceNewPassword
          });
          
          if (updateError) {
              setError(updateError.message);
              setIsLoading(false);
              return;
          }

          if (requirePasswordChangeProfile) {
              // Keeping DB backwards compatible by updating the profile pin field 
              await supabase.from('profiles').update({ pin: forceNewPassword }).eq('username', requirePasswordChangeProfile.username);
              
              onLogin({
                  ...requirePasswordChangeProfile,
                  pin: forceNewPassword,
                  password: forceNewPassword
              });
          }
      } catch (e: any) {
          setError("An unexpected error occurred");
      } finally {
          setIsLoading(false);
      }
  };

  const handleForgotPassword = async () => {
      setError('');
      setResetMessage('');
      if (!resetEmail) {
          setError("Please enter your email address");
          return;
      }
      setIsLoading(true);
      try {
          const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);
          if (error) {
              setError(error.message);
          } else {
              setResetMessage("OTP sent to your email!");
              setIsForgotPassword(false);
              setIsVerifyingOtp(true);
          }
      } catch (e: any) {
          setError("An unexpected error occurred");
      } finally {
          setIsLoading(false);
      }
  };

  const handleVerifyOtp = async () => {
      setError('');
      setResetMessage('');
      if (!resetOtp) {
          setError("Please enter the 6-digit OTP");
          return;
      }
      setIsLoading(true);
      try {
          const { error } = await supabase.auth.verifyOtp({
              email: resetEmail,
              token: resetOtp,
              type: 'recovery'
          });
          if (error) {
              setError(error.message);
          } else {
              setResetMessage("OTP Verified! Please set your new password.");
              setIsVerifyingOtp(false);
              setIsResettingPassword(true);
          }
      } catch (e: any) {
          setError("An unexpected error occurred");
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
                    <input type="password" placeholder="Password (8+ chars, 1 uppercase, 1 num, 1 special)" className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                 </div>
                 
                 <button onClick={handleRegister} disabled={isLoading} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-4 rounded-2xl font-bold transition flex justify-center items-center gap-2 shadow-lg shadow-green-500/20 active:scale-95 border border-white/10">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Sign Up'}
                 </button>
                 <button onClick={() => { setIsRegistering(false); setError(''); }} className="w-full text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition py-2">Cancel</button>
             </div>
          ) : requirePasswordChangeProfile ? (
             <div className="space-y-4 animate-fade-in">
                 <h3 className="text-center text-xl font-bold text-slate-900 dark:text-white mb-4">Action Required:<br/>Update Password</h3>
                 <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-4">Your current password doesn't meet our new security requirements. Please update it to continue.</p>
                 
                 {error && <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{error}</div>}
                 
                 <div className="space-y-3">
                    <input 
                        type="password" 
                        placeholder="New Password (8+ chars, 1 uppercase, 1 num, 1 special)" 
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" 
                        value={forceNewPassword} 
                        onChange={e => setForceNewPassword(e.target.value)} 
                    />
                 </div>
                 
                 <button onClick={handleForcePasswordChange} disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl font-bold transition flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 border border-white/10">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Update Password & Login'}
                 </button>
                 <button onClick={() => { 
                    setRequirePasswordChangeProfile(null); 
                    setError(''); 
                    supabase.auth.signOut();
                 }} className="w-full text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition py-2">Sign Out</button>
             </div>
          ) : isResettingPassword ? (
             <div className="space-y-4 animate-fade-in">
                 <h3 className="text-center text-xl font-bold text-slate-900 dark:text-white mb-4">Set New Password</h3>
                 <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-4">Please enter your new secure password.</p>
                 
                 {error && <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{error}</div>}
                 {resetMessage && <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{resetMessage}</div>}
                 
                 <div className="space-y-3">
                    <input 
                        type="password" 
                        placeholder="New Password" 
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" 
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                    />
                 </div>
                 
                 <button onClick={handleUpdatePassword} disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl font-bold transition flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 border border-white/10">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Update Password'}
                 </button>
                 <button onClick={() => { setIsResettingPassword(false); setError(''); setResetMessage(''); window.location.hash = '/'; }} className="w-full text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition py-2">Back to Login</button>
             </div>
          ) : isVerifyingOtp ? (
             <div className="space-y-4 animate-fade-in">
                 <h3 className="text-center text-xl font-bold text-slate-900 dark:text-white mb-4">Enter OTP</h3>
                 <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-4">We've sent a 6-digit code to your email.</p>
                 
                 {error && <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{error}</div>}
                 {resetMessage && <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{resetMessage}</div>}
                 
                 <div className="space-y-3">
                    <input 
                        type="text" 
                        placeholder="6-digit OTP" 
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm text-center tracking-[0.5em] font-bold"
                        maxLength={6}
                        value={resetOtp} 
                        onChange={e => setResetOtp(e.target.value)} 
                    />
                 </div>
                 
                 <button onClick={handleVerifyOtp} disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl font-bold transition flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 border border-white/10">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Verify OTP'}
                 </button>
                 <button onClick={() => { setIsVerifyingOtp(false); setIsForgotPassword(true); setError(''); setResetMessage(''); }} className="w-full text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition py-2">Use a different email</button>
             </div>
          ) : isForgotPassword ? (
             <div className="space-y-4 animate-fade-in">
                 <h3 className="text-center text-xl font-bold text-slate-900 dark:text-white mb-4">Reset Password</h3>
                 <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-4">Enter your email address to receive an OTP for password reset.</p>
                 
                 {error && <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{error}</div>}
                 {resetMessage && <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{resetMessage}</div>}
                 
                 <div className="space-y-3">
                    <input 
                        type="email" 
                        placeholder="Email address" 
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" 
                        value={resetEmail} 
                        onChange={e => setResetEmail(e.target.value)} 
                    />
                 </div>
                 
                 <button onClick={handleForgotPassword} disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl font-bold transition flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 border border-white/10">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Send OTP'}
                 </button>
                 <button onClick={() => { setIsForgotPassword(false); setError(''); setResetMessage(''); }} className="w-full text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition py-2">Back to Login</button>
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
                    <div className="flex justify-between items-center ml-2 mr-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest opacity-80">Password</label>
                        <button onClick={() => { setIsForgotPassword(true); setError(''); }} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium transition cursor-pointer">Forgot?</button>
                    </div>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition tracking-[0.2em] text-center font-bold text-xl placeholder-slate-400 dark:placeholder-slate-600 backdrop-blur-sm"
                        placeholder="••••••••"
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