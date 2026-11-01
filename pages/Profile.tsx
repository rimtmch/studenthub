import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Mail, Phone, Calendar, Camera, Save, X, Edit2, Loader2, AlertCircle,
  Clock, AlertTriangle, LogOut, Fingerprint, ShieldCheck, GraduationCap, Trash2,
  Download, Smartphone, CheckCircle2, Share, PlusSquare, ShieldAlert
} from 'lucide-react';
import { UserProfile } from '../types';
import { supabase, getErrorMessage } from '../services/supabaseClient';
import { isBiometricsSupported, getAllPasskeyAccounts, registerBiometrics, removeBiometricAccount } from '../services/biometrics';
import { getDirectImageUrl, uploadImageFile, handleImageError } from '../services/imageStorage';
import { isStandalone, promptPWAInstall } from '../services/pwa';
import { AvatarCropperModal } from '../components/AvatarCropperModal';

interface ProfileProps {
  user: UserProfile;
  onUpdateUser: (updatedProfile: UserProfile) => void;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdateUser, onLogout }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avatar Crop / Rotate / Flip Modal States
  const [cropModalImage, setCropModalImage] = useState<string | null>(null);
  const [isCroppingProcessing, setIsCroppingProcessing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const pendingUploadRef = useRef<Promise<string> | null>(null);

  const sanitizeAvatar = (url?: string) => (!url || url.startsWith('blob:') ? '' : url);

  const [canChangeUsername, setCanChangeUsername] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // PWA Install State
  const [appInstalled, setAppInstalled] = useState(isStandalone());
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false);

  useEffect(() => {
    const handleInstallable = () => setAppInstalled(isStandalone());
    const handleInstalled = () => setAppInstalled(true);
    window.addEventListener('pwa-installable', handleInstallable);
    window.addEventListener('pwa-installed', handleInstalled);
    return () => {
      window.removeEventListener('pwa-installable', handleInstallable);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    const outcome = await promptPWAInstall();
    if (outcome === 'ios') {
      setShowIOSInstallModal(true);
    } else if (outcome === 'accepted') {
      setAppInstalled(true);
    }
  };

  useEffect(() => {
    isBiometricsSupported().then((supported) => {
      setBiometricSupported(supported);
      if (supported) {
        const accounts = getAllPasskeyAccounts();
        setBiometricEnabled(
          accounts.some((a) => a.username.toLowerCase() === user.username.toLowerCase())
        );
      }
    });
  }, [user.username]);

  const handleToggleBiometrics = async () => {
    setBiometricLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      if (biometricEnabled) {
        removeBiometricAccount(user.username);
        setBiometricEnabled(false);
        setSuccessMsg('Passkey authentication disabled on this device.');
      } else {
        await registerBiometrics(user.username);
        setBiometricEnabled(true);
        setSuccessMsg('Passkey registered! You can now use "Login with Passkey" with Face ID / Touch ID.');
      }
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        setError(err?.message || 'Passkey registration failed or was cancelled.');
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  useEffect(() => {
      if (user.username_last_changed) {
          const lastChanged = new Date(user.username_last_changed).getTime();
          const now = Date.now();
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          const diff = now - lastChanged;

          if (diff < sevenDays) {
              setCanChangeUsername(false);
              setDaysRemaining(Math.ceil((sevenDays - diff) / (24 * 60 * 60 * 1000)));
          } else {
              setCanChangeUsername(true);
          }
      } else {
          setCanChangeUsername(true);
      }
  }, [user.username_last_changed]);

  const [formData, setFormData] = useState({
    fullname: user.fullname,
    email: user.email,
    phone: user.phone || '',
    dob: user.dob || '',
    course: (user.course || 'MBBS') as 'MBBS' | 'BDS',
    batch_year: user.batch_year || '2024',
    avatar: sanitizeAvatar(user.avatar),
    username: user.username
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const validateForm = () => {
    if (!formData.fullname.trim()) return "Full name is required";
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) return "Valid email address is required";
    const cleanPhone = formData.phone.trim().replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 13) return "Valid 10-digit phone number is required";
    
    if (!formData.dob) return "Date of Birth is required";
    const dobDate = new Date(formData.dob);
    const now = new Date();
    const minAgeDate = new Date(now.getFullYear() - 16, now.getMonth(), now.getDate());
    const maxAgeDate = new Date(now.getFullYear() - 60, now.getMonth(), now.getDate());
    if (isNaN(dobDate.getTime()) || dobDate > minAgeDate || dobDate < maxAgeDate) {
      return "Please enter a valid Date of Birth (must be at least 16 years of age)";
    }

    if (!formData.course || (formData.course !== 'MBBS' && formData.course !== 'BDS')) {
      return "Please select your Course (MBBS or BDS)";
    }

    if (!formData.batch_year) return "Batch start year is required";
    
    if (formData.username !== user.username) {
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(formData.username)) return "Username must be 3-20 characters and contain only letters, numbers, and underscores";
    }
    
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) {
        setError('Image size exceeds 25MB limit');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCropModalImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsCroppingProcessing(true);
    setError('');
    setSuccessMsg('');

    // Instant local preview for zero-delay visual feedback
    const localPreviewUrl = URL.createObjectURL(croppedBlob);
    setAvatarPreview(localPreviewUrl);
    setCropModalImage(null);

    const croppedFile = new File([croppedBlob], `pfp_${user.username}.jpg`, {
      type: 'image/jpeg',
    });

    const uploadPromise = (async () => {
      try {
        const { url } = await uploadImageFile(croppedFile, `pfp_${user.username}`, 800, 0.90);
        return url;
      } catch (err) {
        console.warn('Google Drive upload error, falling back to persistent data URL:', err);
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(croppedBlob);
        });
      }
    })();

    pendingUploadRef.current = uploadPromise;

    try {
      const permanentUrl = await uploadPromise;
      setFormData((prev) => ({ ...prev, avatar: permanentUrl }));
      setSuccessMsg('Photo uploaded to Google Drive! Tap "Save Changes" to save profile.');
    } catch (err) {
      console.warn('Avatar upload fallback error:', err);
      setError('Could not process photo upload. Please try again.');
    } finally {
      setIsCroppingProcessing(false);
      pendingUploadRef.current = null;
    }
  };

  const handleSaveRequest = () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if username is being changed
    if (formData.username !== user.username) {
        setShowUsernameConfirm(true);
    } else {
        executeSave();
    }
  };

  const executeSave = async () => {
    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    setShowUsernameConfirm(false); // Ensure modal is closed

    try {
      // 1. If an avatar upload is currently in flight, wait for it before saving!
      let avatarToSave = formData.avatar;
      if (pendingUploadRef.current) {
        try {
          avatarToSave = await pendingUploadRef.current;
          setFormData((prev) => ({ ...prev, avatar: avatarToSave }));
        } catch (e) {
          console.warn('Pending upload await failed in save:', e);
        }
      }

      // 2. Strict safety check: Never save an ephemeral blob URL to database
      if (avatarToSave && avatarToSave.startsWith('blob:')) {
        console.warn('Sanitizing ephemeral blob URL before saving to Supabase');
        avatarToSave = sanitizeAvatar(user.avatar);
      }

      const isUsernameChanged = formData.username !== user.username;
      
      const updatePayload: any = {
          fullname: formData.fullname.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim().replace(/\D/g, ''),
          dob: formData.dob,
          course: formData.course,
          batch_year: formData.batch_year,
          avatar: avatarToSave,
          avatar_data: avatarToSave
      };

      if (isUsernameChanged) {
          if (!canChangeUsername) {
              throw new Error("You cannot change your username yet.");
          }
          updatePayload.username = formData.username;
          updatePayload.username_last_changed = new Date().toISOString();
      }

      let { error: dbError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .ilike('username', user.username);

      if (dbError && (
          dbError.message?.includes('batch_year') ||
          dbError.message?.includes('course') ||
          dbError.message?.includes('schema cache')
      )) {
          console.warn('batch_year or course column missing in Supabase, retrying core update:', dbError.message);
          const fallbackPayload = { ...updatePayload };
          delete fallbackPayload.batch_year;
          delete fallbackPayload.course;
          const retryRes = await supabase
            .from('profiles')
            .update(fallbackPayload)
            .ilike('username', user.username);
          dbError = retryRes.error;
      }

      if (dbError) {
          if (dbError.code === '23505') throw new Error("Username already taken");
          throw dbError;
      }

      const updatedUser: UserProfile = {
        ...user,
        fullname: formData.fullname.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim().replace(/\D/g, ''),
        dob: formData.dob,
        course: formData.course,
        batch_year: formData.batch_year,
        avatar: avatarToSave,
        username: formData.username,
        username_last_changed: isUsernameChanged ? updatePayload.username_last_changed : user.username_last_changed
      };
      
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        setAvatarPreview('');
      }

      onUpdateUser(updatedUser);
      setSuccessMsg(isUsernameChanged ? "Profile & Username updated!" : "Profile updated successfully!");
      setIsEditing(false);

    } catch (e: any) {
      console.error("Update failed", e);
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  };

  const cancelEdit = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview('');
    }
    setFormData({
      fullname: user.fullname,
      email: user.email,
      phone: user.phone || '',
      dob: user.dob || '',
      course: (user.course || 'MBBS') as 'MBBS' | 'BDS',
      batch_year: user.batch_year || '2024',
      avatar: sanitizeAvatar(user.avatar),
      username: user.username
    });
    setIsEditing(false);
    setError('');
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pb-20">
      <div className="glass rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
        
        {/* Header / Cover */}
        <div className="h-40 bg-gradient-to-r from-blue-900/40 to-purple-900/40 relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute top-6 right-6 bg-black/30 hover:bg-black/50 text-white p-2.5 rounded-full backdrop-blur-md transition border border-white/10 shadow-lg"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-8 pb-10">
          <div className="relative -mt-20 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="relative group self-center md:self-auto flex flex-col items-center">
              <div className="w-40 h-40 rounded-[2.5rem] p-1.5 glass-heavy shadow-2xl overflow-hidden flex items-center justify-center relative">
                {avatarPreview || formData.avatar ? (
                  <img 
                      src={avatarPreview || getDirectImageUrl(formData.avatar)}
                      alt="Profile"
                      referrerPolicy="no-referrer"
                      onError={handleImageError}
                      className="w-full h-full rounded-[2rem] object-cover bg-slate-800"
                  />
                ) : (
                  <div className="w-full h-full rounded-[2rem] bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white text-4xl font-extrabold shadow-inner">
                    {(formData.fullname || user.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Uploading to Drive Overlay Spinner */}
                {isCroppingProcessing && (
                  <div className="absolute inset-1.5 flex flex-col items-center justify-center rounded-[2rem] bg-black/75 backdrop-blur-sm z-20 text-white gap-2 p-3 text-center animate-fade-in border border-blue-500/30">
                    <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                    <span className="text-[11px] font-bold tracking-tight text-white">Uploading to Drive...</span>
                  </div>
                )}

                {isEditing && !isCroppingProcessing && (
                  <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-1.5 flex flex-col items-center justify-center rounded-[2rem] bg-black/60 opacity-0 group-hover:opacity-100 transition cursor-pointer border-2 border-white/20 backdrop-blur-sm z-10 text-white gap-1"
                      title="Click to choose a photo"
                  >
                    <Camera className="w-7 h-7" />
                    <span className="text-[11px] font-bold">Change Photo</span>
                  </div>
                )}
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />

              {/* PFP Source Options (Visible while editing) */}
              {isEditing && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || isCroppingProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
                    title="Change profile picture"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Change Photo</span>
                  </button>

                  {(avatarPreview || formData.avatar) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (avatarPreview) {
                          URL.revokeObjectURL(avatarPreview);
                          setAvatarPreview('');
                        }
                        setFormData(prev => ({ ...prev, avatar: '' }));
                      }}
                      disabled={isLoading || isCroppingProcessing}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-xs font-semibold transition disabled:opacity-50"
                      title="Remove profile picture"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {isEditing ? (
               <div className="flex gap-3 mb-2 self-center md:self-auto">
                 <button onClick={cancelEdit} disabled={isLoading || isCroppingProcessing} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 transition border border-white/5 disabled:opacity-50">
                    <X className="w-5 h-5" />
                 </button>
                 <button 
                    onClick={handleSaveRequest} 
                    disabled={isLoading || isCroppingProcessing} 
                    className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold flex items-center gap-2 transition shadow-lg shadow-blue-900/20"
                 >
                    {isLoading || isCroppingProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isCroppingProcessing ? 'Uploading to Drive...' : 'Saving...'}</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                 </button>
               </div>
            ) : (
              <div className="mb-4 hidden md:block">
                 <span className="bg-white/5 text-blue-600 dark:text-blue-200 text-sm px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-inner">
                    @{user.username}
                 </span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-500/30 text-red-100 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm backdrop-blur-md">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}
          {successMsg && (
             <div className="mb-6 bg-green-500/20 border border-green-500/30 text-green-100 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm backdrop-blur-md">
               <Save className="w-5 h-5" /> {successMsg}
             </div>
          )}

          {/* Admin Control Center Banner */}
          {(user.username.toLowerCase() === 'adminrmch' || user.role === 'admin') && (
            <div className="mb-6 p-4 rounded-3xl bg-gradient-to-r from-red-600/20 via-rose-600/15 to-amber-500/10 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Administrator Authority Enabled</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Moderate all confessions, manage student accounts & reset passwords</p>
                </div>
              </div>
              <Link
                to="/admin"
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-md shadow-red-900/30 flex items-center justify-center gap-1.5 flex-shrink-0"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Open Admin Center</span>
              </Link>
            </div>
          )}

          <div className="space-y-6">
             {!isEditing && (
               <div className="mb-8 text-center md:text-left">
                 <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{user.fullname}</h1>
                 <p className="text-slate-500 dark:text-slate-400 font-medium">
                   <span className="text-blue-600 dark:text-blue-400 font-bold">{user.course || 'MBBS'}</span> Student • Batch of <span className="font-semibold text-slate-700 dark:text-slate-200">{user.batch_year || '2024'}</span> • RMCH
                 </p>
                 <div className="md:hidden mt-4">
                    <span className="bg-white/5 text-blue-600 dark:text-blue-200 text-xs px-3 py-1.5 rounded-full border border-white/10">
                        @{user.username}
                    </span>
                 </div>
               </div>
             )}

            {isEditing && (
              <div className="grid gap-4 animate-slide-up">
                 <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-2 ml-1">Full Name</label>
                    <input 
                      name="fullname"
                      type="text"
                      value={formData.fullname}
                      onChange={handleChange}
                      className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white focus:border-blue-500/50 outline-none transition focus:bg-slate-200 dark:focus:bg-slate-900/80"
                    />
                 </div>
              </div>
            )}

             <div className="grid md:grid-cols-2 gap-5">
                <div className="bg-white dark:bg-white/5 p-5 rounded-3xl border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition duration-300 shadow-sm">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Email</label>
                   </div>
                   {isEditing ? (
                      <input 
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full bg-transparent border-b border-slate-200 dark:border-white/10 text-slate-900 dark:text-white py-2 focus:border-blue-500/50 outline-none transition"
                      />
                   ) : (
                      <p className="text-slate-900 dark:text-slate-200 font-medium pl-1">{user.email}</p>
                   )}
                </div>

                <div className="bg-white dark:bg-white/5 p-5 rounded-3xl border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition duration-300 shadow-sm">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-500/20 rounded-xl text-green-600 dark:text-green-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Phone</label>
                   </div>
                   {isEditing ? (
                      <input 
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full bg-transparent border-b border-slate-200 dark:border-white/10 text-slate-900 dark:text-white py-2 focus:border-blue-500/50 outline-none transition"
                      />
                   ) : (
                      <p className="text-slate-900 dark:text-slate-200 font-medium pl-1">{user.phone || 'Not set'}</p>
                   )}
                </div>

                <div className="bg-white dark:bg-white/5 p-5 rounded-3xl border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition duration-300 shadow-sm">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-500/20 rounded-xl text-purple-600 dark:text-purple-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">DOB</label>
                   </div>
                   {isEditing ? (
                      <input 
                        name="dob"
                        type="date"
                        aria-label="Date of birth"
                        max={new Date().toISOString().split('T')[0]}
                        value={formData.dob}
                        onChange={handleChange}
                        className="w-full bg-transparent border-b border-slate-200 dark:border-white/10 text-slate-900 dark:text-white py-2 focus:border-blue-500/50 outline-none transition"
                      />
                   ) : (
                      <p className="text-slate-900 dark:text-slate-200 font-medium pl-1">{user.dob || 'Not set'}</p>
                   )}
                </div>

                {/* Course Card */}
                <div className="bg-white dark:bg-white/5 p-5 rounded-3xl border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition duration-300 shadow-sm">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Course</label>
                   </div>
                   {isEditing ? (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, course: 'MBBS' })}
                          className={`py-2 rounded-xl font-bold text-xs transition border ${
                            formData.course === 'MBBS'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          MBBS
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, course: 'BDS' })}
                          className={`py-2 rounded-xl font-bold text-xs transition border ${
                            formData.course === 'BDS'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          BDS
                        </button>
                      </div>
                   ) : (
                      <p className="text-slate-900 dark:text-slate-200 font-bold pl-1 text-sm">
                        {user.course || 'MBBS'}
                      </p>
                   )}
                </div>

                {/* Batch Start Year Card */}
                <div className="bg-white dark:bg-white/5 p-5 rounded-3xl border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition duration-300 shadow-sm">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400">
                        <Clock className="w-4 h-4" />
                      </div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Batch Start Year</label>
                   </div>
                   {isEditing ? (
                      <select
                        name="batch_year"
                        value={formData.batch_year}
                        onChange={handleChange}
                        aria-label="Batch start year"
                        className="w-full bg-transparent border-b border-slate-200 dark:border-white/10 text-slate-900 dark:text-white py-2 focus:border-blue-500/50 outline-none transition text-sm cursor-pointer"
                      >
                        {['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018'].map((y) => (
                          <option key={y} value={y} className="text-slate-900 dark:text-white dark:bg-slate-900">
                            Batch of {y}
                          </option>
                        ))}
                      </select>
                   ) : (
                      <p className="text-slate-900 dark:text-slate-200 font-medium pl-1">
                        Batch of {user.batch_year || '2024'}
                      </p>
                   )}
                </div>

                <div className={`bg-white dark:bg-white/5 p-5 rounded-3xl border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition duration-300 shadow-sm ${isEditing && !canChangeUsername ? 'opacity-70' : ''}`}>
                   <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-200 dark:bg-slate-500/20 rounded-xl text-slate-600 dark:text-slate-400">
                             <User className="w-4 h-4" />
                        </div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Username</label>
                      </div>
                      {isEditing && !canChangeUsername && (
                          <div className="flex items-center gap-1.5 text-[10px] text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20" title={`Locked for ${daysRemaining} more days`}>
                              <Clock className="w-3 h-3" /> {daysRemaining}d lock
                          </div>
                      )}
                   </div>
                   
                   {isEditing ? (
                        canChangeUsername ? (
                            <input 
                                name="username"
                                type="text"
                                value={formData.username}
                                onChange={handleChange}
                                className="w-full bg-transparent border-b border-slate-200 dark:border-white/10 text-slate-900 dark:text-white py-2 focus:border-blue-500/50 outline-none transition"
                            />
                        ) : (
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 pl-1">{formData.username}</p>
                            </div>
                        )
                   ) : (
                      <p className="text-slate-900 dark:text-slate-200 font-medium pl-1">@{user.username}</p>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Biometric Quick Login Section */}
      {biometricSupported && (
        <div className="mt-6 glass rounded-[2rem] p-6 border border-white/10 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 dark:text-blue-400">
                <Fingerprint className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
                  Passkey & Biometric Login
                  {biometricEnabled && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" /> Active
                    </span>
                  )}
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Unlock RMCH Student Hub securely with your device Passkey (Face ID, Touch ID, or Windows Hello) without passwords.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {biometricEnabled ? 'Passkey active for @' + user.username : 'Not configured on this device'}
            </span>
            <button
              type="button"
              onClick={handleToggleBiometrics}
              disabled={biometricLoading}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                biometricEnabled
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/20'
              }`}
            >
              {biometricLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Fingerprint className="w-3.5 h-3.5" />
              )}
              {biometricEnabled ? 'Remove Passkey' : 'Create Device Passkey'}
            </button>
          </div>
        </div>
      )}

      {/* 1-Click PWA App Installation Card */}
      <div className="mt-6 glass rounded-[2rem] p-6 border border-white/10 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
              appInstalled 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500' 
                : 'bg-blue-500/15 border-blue-500/30 text-blue-500 dark:text-blue-400'
            }`}>
              {appInstalled ? <CheckCircle2 className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
            </div>
            <div>
              <h4 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
                {appInstalled ? 'RMCH Hub App Installed' : 'Install RMCH Hub App'}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  appInstalled 
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20'
                }`}>
                  {appInstalled ? 'Native App' : '1-Click Install'}
                </span>
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                {appInstalled 
                  ? 'Running as standalone app with instant startup and offline capability.' 
                  : 'Add to your phone home screen or desktop for fullscreen app experience.'}
              </p>
            </div>
          </div>

          {!appInstalled ? (
            <button
              type="button"
              onClick={handleInstallApp}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition active:scale-95 flex items-center justify-center gap-2 flex-shrink-0 border border-white/10"
            >
              <Download className="w-4 h-4" />
              <span>Install to Home Screen</span>
            </button>
          ) : (
            <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5 self-center sm:self-auto px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active on this device
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 text-center space-y-4">
         <button 
            type="button"
            onClick={onLogout}
            className="w-full glass rounded-2xl py-4 text-red-500 hover:text-red-600 hover:bg-red-500/5 transition font-bold flex items-center justify-center gap-2 shadow-lg border border-red-500/10 cursor-pointer active:scale-98"
         >
            <LogOut className="w-5 h-5" /> Logout
         </button>

         {/* About the Developer */}
         <div className="pt-6 pb-2 flex flex-col items-center justify-center text-center">
           <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
             <span>About the Developer</span>
           </div>
           <p className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5">
             Made with <span className="text-rose-500 animate-pulse text-base leading-none">♥️</span> by <span className="font-bold text-slate-900 dark:text-white">Tushar</span> <span className="text-slate-400 dark:text-slate-500 font-normal">(Batch of 2024)</span>
           </p>
         </div>
      </div>

      {/* Username Change Confirmation Modal */}
      {showUsernameConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-fade-in">
          <div className="glass-heavy border border-white/20 dark:border-white/10 p-6 rounded-[2rem] max-w-sm w-full shadow-2xl">
            <div className="flex flex-col items-center text-center mb-6">
               <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4 border border-orange-500/20">
                   <AlertTriangle className="w-8 h-8 text-orange-500 dark:text-orange-400" />
               </div>
               <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2">Change Username?</h3>
               <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                   Changing your username will lock it for <span className="text-orange-500 dark:text-orange-300 font-bold">7 days</span>. You won't be able to change it again during this period.
               </p>
            </div>
            
            <div className="space-y-3">
               <button 
                  onClick={executeSave}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition shadow-lg shadow-blue-900/20 flex justify-center items-center gap-2"
               >
                   {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Change it'}
               </button>
               <button 
                  onClick={() => setShowUsernameConfirm(false)}
                  className="w-full py-3.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl font-medium transition border border-slate-200 dark:border-white/5"
               >
                   Cancel
               </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Safari Installation Guide Modal */}
      {showIOSInstallModal && (
        <div className="fixed inset-0 bg-slate-900/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-heavy border border-white/20 dark:border-white/10 p-6 sm:p-7 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Install on iPhone / iPad
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSInstallModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Apple Safari allows 1-click home screen install via the Share menu:
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 flex-1">
                  Tap the <strong className="text-blue-500">Share</strong> button in Safari toolbar.
                </p>
                <Share className="w-4 h-4 text-blue-500 flex-shrink-0" />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 flex-1">
                  Scroll down and tap <strong className="text-blue-500">Add to Home Screen</strong>.
                </p>
                <PlusSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 flex-1">
                  Tap <strong className="text-blue-500">Add</strong> in the top right corner.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSInstallModal(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xs transition shadow-lg shadow-blue-500/20"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Avatar Cropper, Rotate & Flip Modal */}
      {cropModalImage && (
        <AvatarCropperModal
          imageSrc={cropModalImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropModalImage(null)}
          isProcessing={isCroppingProcessing}
        />
      )}
    </div>
  );
};

export default Profile;