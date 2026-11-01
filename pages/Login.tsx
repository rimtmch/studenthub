import React, { useState, useEffect } from 'react';
import { Fingerprint, KeyRound, ChevronRight, Trash2, X } from 'lucide-react';
import { UserProfile } from '../types';
import { supabase, getErrorMessage } from '../services/supabaseClient';
import {
  isPasskeySupported,
  getAllPasskeyAccounts,
  removePasskeyAccount,
  authenticateWithPasskey,
  PasskeyAccount,
} from '../services/biometrics';

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
  const [regCourse, setRegCourse] = useState<'MBBS' | 'BDS'>('MBBS');
  const [regBatchYear, setRegBatchYear] = useState('2024');
  const [regPassword, setRegPassword] = useState('');

  // CONFIGURATION
  const ALLOW_REGISTRATION = true;

  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyAccounts, setPasskeyAccounts] = useState<PasskeyAccount[]>([]);
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);

  useEffect(() => {
    isPasskeySupported().then((supported) => {
      setPasskeySupported(supported);
      if (supported) {
        setPasskeyAccounts(getAllPasskeyAccounts());
      }
    });
  }, []);

  const handlePasskeyClick = () => {
    const accounts = getAllPasskeyAccounts();
    setPasskeyAccounts(accounts);
    if (accounts.length > 1) {
      // Multiple accounts with passkeys on this device - let user choose or use any device passkey
      setShowPasskeyModal(true);
    } else {
      // 0 or 1 account - trigger native passkey picker directly
      performPasskeyLogin(accounts[0]?.username);
    }
  };

  const performPasskeyLogin = async (targetUsername?: string) => {
    setError('');
    setIsLoading(true);
    setShowPasskeyModal(false);
    try {
      const verifiedUsername = await authenticateWithPasskey(targetUsername);
      const { data: pData, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', verifiedUsername)
        .maybeSingle();

      if (fetchError || !pData) {
        setError(`No profile found matching passkey username (@${verifiedUsername})`);
        setIsLoading(false);
        return;
      }

      const userProfile: UserProfile = {
        username: pData.username,
        fullname: pData.fullname,
        email: pData.email,
        phone: pData.phone,
        dob: pData.dob,
        course: pData.course || 'MBBS',
        batch_year: pData.batch_year ? String(pData.batch_year) : undefined,
        pin: pData.password || pData.pin,
        avatar: (!pData.avatar_data && !pData.avatar_url && !pData.avatar) || (pData.avatar_data?.startsWith('blob:') || pData.avatar_url?.startsWith('blob:') || pData.avatar?.startsWith('blob:')) ? '' : (pData.avatar || pData.avatar_data || pData.avatar_url),
        username_last_changed: pData.username_last_changed,
        role: pData.role || (pData.username?.toLowerCase() === 'adminrmch' ? 'admin' : 'student'),
      };

      onLogin(userProfile);
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        setError(err?.message || "Passkey authentication failed or was cancelled");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePasskey = (e: React.MouseEvent, usernameToDelete: string) => {
    e.stopPropagation();
    removePasskeyAccount(usernameToDelete);
    const updated = getAllPasskeyAccounts();
    setPasskeyAccounts(updated);
    if (updated.length === 0) {
      setShowPasskeyModal(false);
    }
  };

  useEffect(() => {
    // Check and prefill from Keychain / Password Manager if available
    if (typeof window !== 'undefined' && navigator.credentials?.get) {
      navigator.credentials
        .get({
          password: true,
          mediation: 'optional',
        } as any)
        .then((cred: any) => {
          if (cred && cred.id && cred.password) {
            setUsername(cred.id);
            setPassword(cred.password);
          }
        })
        .catch(() => {});
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
        setError("Please enter username and password");
        return;
    }
    setError('');
    setIsLoading(true);

    // 0. Super Secret Master Admin Account Check
    if (cleanUsername.toLowerCase() === 'adminrmch') {
      if (password === 'Adminrmch@1234#') {
        const adminProfile: UserProfile = {
          username: 'adminrmch',
          fullname: 'RMCH System Administrator',
          email: 'admin@rmch.internal',
          dob: '2024-01-01',
          phone: '9999999999',
          course: 'MBBS',
          batch_year: '2024',
          pin: 'Adminrmch@1234#',
          role: 'admin',
          avatar: '',
        };

        onLogin(adminProfile);
        window.location.hash = '/admin';
        setIsLoading(false);
        return;
      } else {
        setError("Incorrect credentials");
        setIsLoading(false);
        return;
      }
    }

    try {
        let emailToLogin = '';
        if (cleanUsername.includes('@')) {
            emailToLogin = cleanUsername.toLowerCase();
        } else {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('email')
                .ilike('username', cleanUsername)
                .maybeSingle();
            
            if (profileError || !profileData?.email) {
                setError("User not found");
                setIsLoading(false);
                return;
            }
            emailToLogin = profileData.email;
        }

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: emailToLogin,
            password: password
        });

        if (authError) {
             setError("Incorrect credentials");
             setIsLoading(false);
             return;
        }

        let profile: any = null;
        if (authData?.user?.id) {
            const { data: pData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .maybeSingle();
            profile = pData;
        }

        if (!profile) {
            const { data: pData, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .ilike('email', emailToLogin)
                .maybeSingle();
                
            if (fetchError || !pData) {
                 setError("Profile could not be loaded");
                 setIsLoading(false);
                 return;
            }
            profile = pData;
        }

        const userProfile: UserProfile = {
            username: profile.username,
            fullname: profile.fullname,
            email: profile.email,
            phone: profile.phone,
            dob: profile.dob,
            course: profile.course || 'MBBS',
            batch_year: profile.batch_year ? String(profile.batch_year) : undefined,
            pin: profile.password || profile.pin,
            avatar: (() => {
              const raw = profile.avatar || profile.avatar_data || profile.avatar_url;
              return raw && !raw.startsWith('blob:') ? raw : '';
            })(),
            username_last_changed: profile.username_last_changed,
            role: profile.role || (profile.username?.toLowerCase() === 'adminrmch' ? 'admin' : 'student')
        };

        const weakPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d\s]).{8,}$/;
        if (!weakPasswordRegex.test(password)) {
            setRequirePasswordChangeProfile(userProfile);
            return;
        }

        // Save credential in Browser Keychain / Google Password Manager
        if (typeof window !== 'undefined' && 'PasswordCredential' in window && navigator.credentials?.store) {
          try {
            const cred = new (window as any).PasswordCredential({
              id: profile.username || cleanUsername,
              password: password,
              name: profile.fullname || cleanUsername,
              iconURL: profile.avatar || undefined,
            });
            await navigator.credentials.store(cred);
          } catch (credErr) {
            console.debug('Keychain credential store note:', credErr);
          }
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
      const cleanName = regName.trim();
      const cleanUser = regUser.trim().toLowerCase();
      const cleanEmail = regEmail.trim().toLowerCase();
      const cleanPhone = regPhone.trim().replace(/\D/g, '');
      const cleanDob = regDob.trim();
      const cleanCourse = regCourse;
      const cleanBatchYear = regBatchYear.trim();

      if (!cleanName) {
          setError("Full name is required");
          return;
      }

      if (!cleanUser) {
          setError("Username is required");
          return;
      }

      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUser)) {
          setError("Username must be 3-20 characters and contain only letters, numbers, and underscores");
          return;
      }

      if (!cleanEmail) {
          setError("Email address is required");
          return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
          setError("Please enter a valid email address");
          return;
      }

      if (!cleanPhone) {
          setError("Phone number is required");
          return;
      }

      if (cleanPhone.length < 10 || cleanPhone.length > 13) {
          setError("Please enter a valid 10-digit mobile number");
          return;
      }

      if (!cleanDob) {
          setError("Date of Birth is required");
          return;
      }

      const dobDate = new Date(cleanDob);
      const now = new Date();
      const minAgeDate = new Date(now.getFullYear() - 16, now.getMonth(), now.getDate());
      const maxAgeDate = new Date(now.getFullYear() - 60, now.getMonth(), now.getDate());

      if (isNaN(dobDate.getTime()) || dobDate > minAgeDate || dobDate < maxAgeDate) {
          setError("Please enter a valid Date of Birth (must be at least 16 years of age)");
          return;
      }

      if (!cleanCourse || (cleanCourse !== 'MBBS' && cleanCourse !== 'BDS')) {
          setError("Please select your Course (MBBS or BDS)");
          return;
      }

      if (!cleanBatchYear) {
          setError("Please select your Batch Start Year");
          return;
      }
      
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d\s]).{8,}$/;
      if (!passwordRegex.test(regPassword)) {
          setError("Password must be at least 8 characters, include uppercase, lowercase, number and special character");
          return;
      }

      setIsLoading(true);

      try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
              email: cleanEmail,
              password: regPassword 
          });

          if (authError) {
              if (authError.message.includes("registered")) {
                  setError("Email is already registered");
              } else {
                  setError(authError.message);
              }
              setIsLoading(false);
              return;
          }

          if (authData.user) {
              let { error: profileError } = await supabase
                  .from('profiles')
                  .insert([{
                      id: authData.user.id,
                      username: cleanUser,
                      email: cleanEmail,
                      password: regPassword,
                      fullname: cleanName,
                      dob: cleanDob,
                      phone: cleanPhone,
                      course: cleanCourse,
                      batch_year: cleanBatchYear,
                      attendance_data: []
                  }]);

              if (profileError && (
                  profileError.message?.includes('batch_year') ||
                  profileError.message?.includes('course') ||
                  profileError.message?.includes('schema cache')
              )) {
                  console.warn('batch_year/course column missing in database, retrying core insert:', profileError.message);
                  const retry = await supabase
                      .from('profiles')
                      .insert([{
                          id: authData.user.id,
                          username: cleanUser,
                          email: cleanEmail,
                          password: regPassword,
                          fullname: cleanName,
                          dob: cleanDob,
                          phone: cleanPhone,
                          attendance_data: []
                      }]);
                  profileError = retry.error;
              }

              if (profileError) {
                  if (profileError.code === '23505') { 
                      setError("Username is already taken");
                  } else {
                      setError(getErrorMessage(profileError));
                  }
                  setIsLoading(false);
                  return;
              }

              const newUser: UserProfile = {
                  username: cleanUser,
                  fullname: cleanName,
                  email: cleanEmail,
                  phone: cleanPhone,
                  dob: cleanDob,
                  course: cleanCourse,
                  batch_year: cleanBatchYear,
                  pin: regPassword
              };

              // Save credential in Browser Keychain upon signup
              if (typeof window !== 'undefined' && 'PasswordCredential' in window && navigator.credentials?.store) {
                try {
                  const cred = new (window as any).PasswordCredential({
                    id: cleanUser,
                    password: regPassword,
                    name: cleanName,
                  });
                  await navigator.credentials.store(cred);
                } catch (credErr) {
                  console.debug('Registration credential store note:', credErr);
                }
              }

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
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-500 blur-2xl opacity-40 group-hover:opacity-60 transition duration-500 rounded-full"></div>
                <img 
                    src={logoUrl || "logo.png"} 
                    alt="Logo" 
                    className="w-32 h-32 rounded-[2.5rem] mx-auto mb-6 object-cover border-4 border-white/10 shadow-2xl relative z-10 transform group-hover:scale-105 transition duration-500"
                    onError={(e) => { e.currentTarget.src = "logo.png" }}
                />
            </div>
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-sm">Welcome Back</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Sign in to Student Hub</p>
        </div>

        <div className="glass rounded-[3rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] space-y-6 relative overflow-hidden border border-white/20">
          {/* Shine effect */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50"></div>
          
          {isRegistering ? (
             <form 
               id="register-form" 
               onSubmit={(e) => { e.preventDefault(); handleRegister(); }} 
               autoComplete="on" 
               className="space-y-4 animate-fade-in"
             >
                 <h3 className="text-center text-xl font-bold text-slate-900 dark:text-white mb-4">New Account</h3>
                 {error && <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{error}</div>}
                 
                 <div className="space-y-3">
                    <div>
                      <input 
                        type="text" 
                        id="reg-name"
                        name="name"
                        autoComplete="name"
                        placeholder="Full Name *" 
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" 
                        value={regName} 
                        onChange={e => setRegName(e.target.value)} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <input 
                        type="text" 
                        id="reg-user"
                        name="username"
                        autoComplete="username"
                        placeholder="Username *" 
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" 
                        value={regUser} 
                        onChange={e => setRegUser(e.target.value)} 
                      />
                      <input 
                        type="tel" 
                        id="reg-phone"
                        name="tel"
                        autoComplete="tel"
                        placeholder="Phone (10 digits) *" 
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" 
                        value={regPhone} 
                        onChange={e => setRegPhone(e.target.value)} 
                      />
                    </div>

                    <div>
                      <input 
                        type="email" 
                        id="reg-email"
                        name="email"
                        autoComplete="email"
                        placeholder="Email address *" 
                        autoCapitalize="none"
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-sm backdrop-blur-sm" 
                        value={regEmail} 
                        onChange={e => setRegEmail(e.target.value)} 
                      />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="reg-dob" className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider ml-1">
                          Date of Birth (DOB) *
                        </label>
                        <input 
                          type="date" 
                          id="reg-dob"
                          name="bday"
                          autoComplete="bday"
                          aria-label="Date of birth"
                          max={new Date().toISOString().split('T')[0]} 
                          className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-3 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition text-sm backdrop-blur-sm" 
                          value={regDob} 
                          onChange={e => setRegDob(e.target.value)} 
                        />
                    </div>

                    {/* Course & Batch Start Year */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider ml-1 mb-1 block">
                          Course *
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 bg-white/50 dark:bg-black/20 p-1 rounded-2xl border border-white/20 dark:border-white/10">
                          <button
                            type="button"
                            onClick={() => setRegCourse('MBBS')}
                            className={`py-2 rounded-xl font-bold text-xs transition ${
                              regCourse === 'MBBS'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            MBBS
                          </button>
                          <button
                            type="button"
                            onClick={() => setRegCourse('BDS')}
                            className={`py-2 rounded-xl font-bold text-xs transition ${
                              regCourse === 'BDS'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            BDS
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider ml-1 mb-1 block">
                          Batch Year *
                        </label>
                        <select
                          value={regBatchYear}
                          onChange={e => setRegBatchYear(e.target.value)}
                          aria-label="Batch start year"
                          className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-2.5 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition text-xs sm:text-sm backdrop-blur-sm cursor-pointer"
                        >
                          {['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018'].map(y => (
                            <option key={y} value={y} className="text-slate-900 dark:text-white dark:bg-slate-900">
                              Batch {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <input 
                        type="password" 
                        id="reg-password"
                        name="new-password"
                        autoComplete="new-password"
                        placeholder="Password (8+ chars, 1 upper, 1 num, 1 special) *" 
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm backdrop-blur-sm" 
                        value={regPassword} 
                        onChange={e => setRegPassword(e.target.value)} 
                      />
                    </div>
                 </div>
                 
                 <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-4 rounded-2xl font-bold transition flex justify-center items-center gap-2 shadow-lg shadow-green-500/20 active:scale-95 border border-white/10">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Sign Up'}
                 </button>
                 <button type="button" onClick={() => { setIsRegistering(false); setError(''); }} className="w-full text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition py-2">Cancel</button>
             </form>
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
             <form 
               id="login-form" 
               onSubmit={(e) => { e.preventDefault(); handleLogin(); }} 
               autoComplete="on" 
               className="space-y-6 animate-fade-in"
             >
                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs p-3 rounded-2xl text-center backdrop-blur-md font-medium">{error}</div>}
                
                <div className="space-y-2">
                    <label htmlFor="login-username" className="text-xs text-slate-500 dark:text-slate-400 ml-2 font-bold uppercase tracking-widest opacity-80">Username</label>
                    <input 
                        type="text" 
                        id="login-username"
                        name="username"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition backdrop-blur-sm placeholder-slate-400 dark:placeholder-slate-600 font-medium"
                        placeholder="Enter username"
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center ml-2 mr-2">
                        <label htmlFor="login-password" className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest opacity-80">Password</label>
                        <button type="button" onClick={() => { setIsForgotPassword(true); setError(''); }} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium transition cursor-pointer">Forgot?</button>
                    </div>
                    <input 
                        type="password" 
                        id="login-password"
                        name="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30 transition tracking-[0.2em] text-center font-bold text-xl placeholder-slate-400 dark:placeholder-slate-600 backdrop-blur-sm"
                        placeholder="••••••••"
                    />
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl font-bold transition shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2 active:scale-95 transform duration-200 border border-white/10">
                    {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Login'}
                </button>
                
                {passkeySupported && (
                  <button
                    type="button"
                    onClick={handlePasskeyClick}
                    disabled={isLoading}
                    className="w-full bg-slate-900/5 hover:bg-slate-900/10 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-slate-100 py-3.5 rounded-2xl font-semibold transition border border-slate-300/60 dark:border-white/10 flex items-center justify-center gap-2 active:scale-95 shadow-sm text-sm cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-blue-500" />
                    <span>Login with Passkey</span>
                    {passkeyAccounts.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/20">
                        {passkeyAccounts.length} on device
                      </span>
                    )}
                  </button>
                )}
                
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
             </form>
          )}
        </div>
      </div>

      {/* Multi-Account Passkey Picker Modal */}
      {showPasskeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Login with Passkey
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Passkeys saved on this device
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasskeyModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              {passkeyAccounts.map((acc) => (
                <div
                  key={acc.username}
                  onClick={() => performPasskeyLogin(acc.username)}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                      {acc.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        @{acc.username}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                        <Fingerprint className="w-3 h-3 text-blue-500" /> Passkey ready
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleDeletePasskey(e, acc.username)}
                      title="Remove passkey from this device"
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => performPasskeyLogin()}
              className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold text-xs transition border border-slate-200 dark:border-white/10 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Fingerprint className="w-4 h-4 text-blue-500" />
              <span>Use device / iCloud / Google passkey</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;