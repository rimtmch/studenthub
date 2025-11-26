import React, { useState, useRef, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Camera, Save, X, Edit2, Loader2, AlertCircle, Clock, AlertTriangle, LogOut } from 'lucide-react';
import { UserProfile } from '../types';
import { supabase, getErrorMessage } from '../services/supabaseClient';

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

  const [canChangeUsername, setCanChangeUsername] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);

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
    avatar: user.avatar || '',
    username: user.username
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const validateForm = () => {
    if (!formData.fullname.trim()) return "Full name is required";
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) return "Invalid email address";
    if (formData.phone && !/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) return "Phone must be 10 digits";
    
    if (formData.username !== user.username) {
        if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) return "Username can only contain letters, numbers, and underscores";
        if (formData.username.length < 3) return "Username must be at least 3 characters";
    }
    
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          if (file.size > 2 * 1024 * 1024) {
              setError("Image size should be less than 2MB");
              return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  setFormData(prev => ({ ...prev, avatar: ev.target!.result as string }));
              }
          };
          reader.readAsDataURL(file);
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
      const isUsernameChanged = formData.username !== user.username;
      
      const updatePayload: any = {
          fullname: formData.fullname,
          email: formData.email,
          phone: formData.phone,
          dob: formData.dob,
          avatar_data: formData.avatar
      };

      if (isUsernameChanged) {
          if (!canChangeUsername) {
              throw new Error("You cannot change your username yet.");
          }
          updatePayload.username = formData.username;
          updatePayload.username_last_changed = new Date().toISOString();
      }

      const { error: dbError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('username', user.username);

      if (dbError) {
          if (dbError.code === '23505') throw new Error("Username already taken");
          throw dbError;
      }

      const updatedUser: UserProfile = {
        ...user,
        fullname: formData.fullname,
        email: formData.email,
        phone: formData.phone,
        dob: formData.dob,
        avatar: formData.avatar,
        username: formData.username,
        username_last_changed: isUsernameChanged ? updatePayload.username_last_changed : user.username_last_changed
      };
      
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
    setFormData({
      fullname: user.fullname,
      email: user.email,
      phone: user.phone || '',
      dob: user.dob || '',
      avatar: user.avatar || '',
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
            <div className="relative group self-center md:self-auto">
              <div className="w-40 h-40 rounded-[2.5rem] p-1.5 glass-heavy shadow-2xl">
                <img 
                    src={formData.avatar || `https://placehold.co/150x150/1e293b/white?text=${formData.fullname.charAt(0)}`}
                    alt="Profile"
                    className="w-full h-full rounded-[2rem] object-cover bg-slate-800"
                    onError={(e) => {e.currentTarget.src = `https://placehold.co/150x150/1e293b/white?text=${formData.fullname.charAt(0)}`}}
                />
              </div>
              {isEditing && (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 m-1.5 flex items-center justify-center rounded-[2rem] bg-black/60 opacity-0 group-hover:opacity-100 transition cursor-pointer border-2 border-white/20 backdrop-blur-sm z-10"
                >
                  <Camera className="w-8 h-8 text-white" />
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
              )}
            </div>
            
            {isEditing ? (
               <div className="flex gap-3 mb-2 self-center md:self-auto">
                 <button onClick={cancelEdit} disabled={isLoading} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 transition border border-white/5">
                    <X className="w-5 h-5" />
                 </button>
                 <button onClick={handleSaveRequest} disabled={isLoading} className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 transition shadow-lg shadow-blue-900/20">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
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

          <div className="space-y-6">
             {!isEditing && (
               <div className="mb-8 text-center md:text-left">
                 <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{user.fullname}</h1>
                 <p className="text-slate-500 dark:text-slate-400 font-medium">Medical Student • RMCH</p>
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
                        value={formData.dob}
                        onChange={handleChange}
                        className="w-full bg-transparent border-b border-slate-200 dark:border-white/10 text-slate-900 dark:text-white py-2 focus:border-blue-500/50 outline-none transition"
                      />
                   ) : (
                      <p className="text-slate-900 dark:text-slate-200 font-medium pl-1">{user.dob || 'Not set'}</p>
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

      <div className="mt-8 text-center space-y-4">
         <button 
            onClick={onLogout}
            className="w-full glass rounded-2xl py-4 text-red-500 hover:text-red-600 hover:bg-red-500/5 transition font-bold flex items-center justify-center gap-2 shadow-lg border border-red-500/10"
         >
            <LogOut className="w-5 h-5" /> Logout
         </button>
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
    </div>
  );
};

export default Profile;