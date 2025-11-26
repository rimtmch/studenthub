
import React, { useState, useEffect } from 'react';
import { Sun, Moon, Coffee, Edit2, BookOpen, BrainCircuit, X, Save, Loader2, Calendar, Utensils, HeartPulse, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MessMenu, UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';

interface HomeProps {
  user: UserProfile;
}

const Home: React.FC<HomeProps> = ({ user }) => {
  const isAdmin = user.username === 'admin';
  const [currentMenu, setCurrentMenu] = useState<MessMenu>({
    day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    breakfast: 'Loading...',
    lunch: 'Loading...',
    snacks: 'Loading...',
    dinner: 'Loading...'
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<MessMenu>(currentMenu);
  const [selectedDayToEdit, setSelectedDayToEdit] = useState(currentMenu.day);
  
  // Health Day State
  const [healthDays, setHealthDays] = useState<string[]>([]);

  useEffect(() => {
      const today = new Date();
      fetchMenuForDay(today.toLocaleDateString('en-US', { weekday: 'long' }), true);
      fetchHealthDays(today.getDate(), today.getMonth() + 1); // Month is 0-indexed in JS
  }, []);

  const fetchHealthDays = async (day: number, month: number) => {
      // Fetch all events that involve this month (start or end)
      const { data, error } = await supabase
        .from('health_events')
        .select('*')
        .or(`start_month.eq.${month},end_month.eq.${month}`);
      
      if (data && data.length > 0) {
          const todaysEvents = data.filter((e: any) => {
              // 1. Single Day Event
              if (e.start_month === month && e.end_month === month && e.start_day === day && e.end_day === day) {
                  return true;
              }
              
              // 2. Range Event (Week/Month) checking
              // Check if today is after start
              const isAfterStart = (month > e.start_month) || (month === e.start_month && day >= e.start_day);
              // Check if today is before end
              const isBeforeEnd = (month < e.end_month) || (month === e.end_month && day <= e.end_day);

              return isAfterStart && isBeforeEnd;
          });

          // Sort so "Days" come first, then "Weeks", then "Months"
          todaysEvents.sort((a: any, b: any) => {
              const order = { 'Day': 1, 'Week': 2, 'Month': 3 };
              return (order[a.category as keyof typeof order] || 4) - (order[b.category as keyof typeof order] || 4);
          });

          setHealthDays(todaysEvents.map((d: any) => d.event_name));
      }
  };

  const fetchMenuForDay = async (day: string, isInitialLoad = false) => {
      const { data, error } = await supabase
          .from('mess_menu')
          .select('*')
          .eq('day', day)
          .single();
      
      const menuData = data ? {
          day: data.day,
          breakfast: data.breakfast || '',
          lunch: data.lunch || '',
          snacks: data.snacks || '',
          dinner: data.dinner || ''
      } : {
          day: day,
          breakfast: '',
          lunch: '',
          snacks: '',
          dinner: ''
      };

      if (isInitialLoad) {
          setCurrentMenu(menuData);
      }
      return menuData;
  };

  const handleEditOpen = async () => {
      setEditForm(currentMenu);
      setSelectedDayToEdit(currentMenu.day);
      setIsEditing(true);
  };

  const handleDayChange = async (day: string) => {
      setSelectedDayToEdit(day);
      const data = await fetchMenuForDay(day);
      setEditForm(data);
  };

  const handleSaveMenu = async () => {
      setIsSaving(true);
      try {
          const { error } = await supabase
            .from('mess_menu')
            .upsert([editForm], { onConflict: 'day' });
          
          if(error) throw error;
          
          const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
          if (editForm.day === today) {
              setCurrentMenu(editForm);
          }
          
          setIsEditing(false);
      } catch (e) {
          console.error("Failed to save menu", e);
          alert("Failed to save menu");
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* Welcome Hero Widget */}
      <div className="glass rounded-[3rem] p-8 sm:p-10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative overflow-hidden group border border-white/20">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 dark:from-blue-900/40 dark:via-purple-900/40 dark:to-slate-900/60 -z-10 animate-pulse-slow"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div className="space-y-4">
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold mb-1 border border-white/10 shadow-sm text-slate-800 dark:text-white">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date().toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'})}</span>
                </div>
                <div>
                    <h2 className="text-4xl sm:text-5xl font-extrabold mb-2 tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
                        Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">{user.fullname.split(' ')[0]}</span>
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 max-w-md text-base font-medium leading-relaxed">
                        Your personal academic dashboard.
                    </p>
                </div>
            </div>
            
            <div className="flex flex-wrap gap-4 w-full md:w-auto">
                <Link to="/attendance" className="flex-1 md:flex-none text-center bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/30 transition transform hover:-translate-y-1 active:scale-95 border border-white/10">
                    My Attendance
                </Link>
                <Link to="/ai-tutor" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-slate-900 dark:text-white px-8 py-4 rounded-2xl font-bold text-sm border border-white/20 backdrop-blur-md shadow-lg transition transform hover:-translate-y-1 active:scale-95">
                    <BrainCircuit className="w-4 h-4" /> Tutor
                </Link>
            </div>
        </div>
        
        {/* Decorative Gloss Shine */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-white/10 to-transparent rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
      </div>
      
      {/* Important Health Day Widget (Only shows if today is a special day) */}
      {healthDays.length > 0 && (
          <div className="glass rounded-[2.5rem] p-6 border border-emerald-500/30 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.2)] relative overflow-hidden animate-slide-up">
             <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-900/20 dark:to-teal-900/20 -z-10"></div>
             <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-inner flex-shrink-0">
                     <HeartPulse className="w-6 h-6 animate-pulse" />
                 </div>
                 <div>
                     <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                         <Activity className="w-3 h-3" /> Important Today
                     </p>
                     <div className="flex flex-col gap-1">
                        {healthDays.map((dayName, idx) => (
                            <h3 key={idx} className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                {dayName}
                            </h3>
                        ))}
                     </div>
                 </div>
             </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Access */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass rounded-[2.5rem] p-8 border border-white/20 shadow-xl">
            <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-6 ml-1">Quick Access</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link to="/library" className="group bg-slate-50/50 dark:bg-white/5 p-6 rounded-[2rem] border border-white/20 flex flex-col items-center justify-center gap-4 hover:bg-white/40 dark:hover:bg-white/10 transition duration-300 shadow-sm hover:shadow-lg">
                <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 rounded-2xl text-blue-600 dark:text-blue-300 group-hover:scale-110 transition duration-500 shadow-inner">
                  <BookOpen className="w-7 h-7" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-white transition">Library</span>
              </Link>
               <Link to="/ai-tutor" className="group bg-slate-50/50 dark:bg-white/5 p-6 rounded-[2rem] border border-white/20 flex flex-col items-center justify-center gap-4 hover:bg-white/40 dark:hover:bg-white/10 transition duration-300 shadow-sm hover:shadow-lg">
                <div className="p-4 bg-purple-500/10 dark:bg-purple-500/20 rounded-2xl text-purple-600 dark:text-purple-300 group-hover:scale-110 transition duration-500 shadow-inner">
                  <BrainCircuit className="w-7 h-7" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-white transition">AI Tutor</span>
              </Link>
            </div>
          </div>

          <div className="glass rounded-[2.5rem] p-8 border border-white/20 relative overflow-hidden min-h-[180px] flex flex-col justify-center shadow-xl group">
             <div className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.03] dark:opacity-[0.05] rotate-12 transition-transform duration-700 group-hover:rotate-6 group-hover:scale-110">
                <BookOpen className="w-48 h-48 text-slate-900 dark:text-white" />
             </div>
            <h4 className="text-blue-600 dark:text-blue-300 text-xs uppercase font-extrabold mb-3 tracking-widest relative z-10 flex items-center gap-2">
                <span className="w-8 h-[2px] bg-blue-500 rounded-full"></span> Daily Wisdom
            </h4>
            <p className="text-slate-900 dark:text-white font-serif text-2xl italic relative z-10 leading-relaxed drop-shadow-sm">
              "Wherever the art of Medicine is loved, there is also a love of Humanity."
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-4 relative z-10 font-bold">— Hippocrates</p>
          </div>
        </div>

        {/* Mess Menu Widget */}
        <div className="glass rounded-[2.5rem] p-6 border border-white/20 flex flex-col h-full shadow-xl">
          <div className="flex justify-between items-center mb-6 pl-2">
            <div>
                <h3 className="font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-orange-500" />
                    Today's Menu
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 ml-7">{currentMenu.day}</p>
            </div>
            {isAdmin && (
                <button onClick={handleEditOpen} className="text-slate-500 hover:text-white transition bg-slate-100 dark:bg-white/5 p-2.5 rounded-xl border border-white/10 hover:bg-blue-500 shadow-sm">
                    <Edit2 className="w-4 h-4" />
                </button>
            )}
          </div>
          <div className="space-y-3 flex-1">
            {[
                { label: 'Breakfast', icon: Sun, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10 dark:bg-yellow-500/5', val: currentMenu.breakfast },
                { label: 'Lunch', icon: Sun, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10 dark:bg-orange-500/5', val: currentMenu.lunch },
                { label: 'Snacks', icon: Coffee, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-500/10 dark:bg-pink-500/5', val: currentMenu.snacks },
                { label: 'Dinner', icon: Moon, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10 dark:bg-indigo-500/5', val: currentMenu.dinner },
            ].map((item, i) => (
                <div key={i} className={`flex gap-4 items-start p-4 rounded-2xl transition duration-300 border border-transparent hover:border-white/10 hover:bg-white/40 dark:hover:bg-white/5 ${!item.val ? 'opacity-50' : ''}`}>
                    <div className={`mt-0.5 ${item.color} ${item.bg} p-2.5 rounded-xl shadow-inner`}>
                        <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">{item.label}</p>
                        <p className="text-slate-900 dark:text-slate-200 text-sm font-semibold leading-snug">{item.val || '--'}</p>
                    </div>
                </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-heavy border border-white/20 p-8 rounded-[2.5rem] max-w-md w-full shadow-[0_20px_60px_rgba(0,0,0,0.5)] transform scale-100">
              <div className="flex justify-between items-center mb-8">
                  <h3 className="font-bold text-2xl text-slate-900 dark:text-white">Update Menu</h3>
                  <button onClick={() => setIsEditing(false)} className="p-2 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition"><X className="w-6 h-6 text-slate-500 dark:text-slate-300" /></button>
              </div>
              
              <div className="space-y-5">
                  <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-bold ml-2 uppercase tracking-wide">Select Day</label>
                      <select 
                          value={selectedDayToEdit} 
                          onChange={(e) => handleDayChange(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition shadow-inner"
                      >
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                              <option key={day} value={day}>{day}</option>
                          ))}
                      </select>
                  </div>

                  {['breakfast', 'lunch', 'snacks', 'dinner'].map((meal) => (
                    <div key={meal}>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 ml-2 capitalize font-bold">{meal}</label>
                        <input 
                            type="text" 
                            value={(editForm as any)[meal]} 
                            onChange={(e) => setEditForm({...editForm, [meal]: e.target.value})} 
                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition shadow-inner" 
                        />
                    </div>
                  ))}

                  <button onClick={handleSaveMenu} disabled={isSaving} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl font-bold transition mt-4 flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 border border-white/10">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Update Menu
                  </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
