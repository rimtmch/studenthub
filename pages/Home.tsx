import React, { useState, useEffect, useCallback } from 'react';
import { Coffee, BookOpen, Calendar, HeartPulse, Activity, Store, ClipboardCheck, Sparkles, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';

interface HomeProps {
  user: UserProfile;
}

interface HealthEventRecord {
  event_name: string;
  category?: 'Day' | 'Week' | 'Month' | string;
  start_month: number;
  end_month: number;
  start_day: number;
  end_day: number;
}

const Home: React.FC<HomeProps> = ({ user }) => {
  // Health Day State
  const [healthDays, setHealthDays] = useState<string[]>([]);

  const fetchHealthDays = useCallback(async (day: number, month: number) => {
    try {
      const { data } = await supabase
        .from('health_events')
        .select('*')
        .or(`start_month.eq.${month},end_month.eq.${month}`);

      if (data && data.length > 0) {
        const events = data as HealthEventRecord[];
        const todaysEvents = events.filter((e) => {
          if (e.start_month === month && e.end_month === month && e.start_day === day && e.end_day === day) {
            return true;
          }
          const isAfterStart = month > e.start_month || (month === e.start_month && day >= e.start_day);
          const isBeforeEnd = month < e.end_month || (month === e.end_month && day <= e.end_day);
          return isAfterStart && isBeforeEnd;
        });

        todaysEvents.sort((a, b) => {
          const order: Record<string, number> = { Day: 1, Week: 2, Month: 3 };
          return (order[a.category || ''] || 4) - (order[b.category || ''] || 4);
        });

        setHealthDays(todaysEvents.map((d) => d.event_name));
      }
    } catch (e) {
      console.warn('fetchHealthDays failed gracefully:', e);
    }
  }, []);

  useEffect(() => {
    const today = new Date();
    fetchHealthDays(today.getDate(), today.getMonth() + 1);
  }, [fetchHealthDays]);

  const firstName = (user.fullname || user.username || 'Student').trim().split(/\s+/)[0];

  return (
    <div className="animate-fade-in space-y-6 sm:space-y-8">
      {/* Welcome Hero Widget */}
      <div className="glass rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative overflow-hidden group border border-white/20">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 dark:from-blue-900/40 dark:via-purple-900/40 dark:to-slate-900/60 -z-10" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 sm:gap-8">
          <div className="space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold border border-white/10 shadow-sm text-slate-800 dark:text-white">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <div>
              <h2 className="text-3xl sm:text-5xl font-extrabold mb-2 tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
                Hello,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                  {firstName}
                </span>
              </h2>
              <p className="text-slate-600 dark:text-slate-300 max-w-md text-sm sm:text-base font-medium leading-relaxed">
                Your personal RMCH academic and campus companion.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-4 w-full md:w-auto">
            <Link
              to="/attendance"
              className="flex-1 md:flex-none text-center bg-blue-600 hover:bg-blue-500 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/25 transition transform hover:-translate-y-0.5 active:scale-95 border border-white/10"
            >
              My Attendance
            </Link>
            <Link
              to="/book-renting"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/30 dark:bg-white/15 hover:bg-white/40 dark:hover:bg-white/25 text-slate-900 dark:text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-sm border border-white/30 dark:border-white/15 backdrop-blur-md shadow-lg transition transform hover:-translate-y-0.5 active:scale-95"
            >
              <Store className="w-4 h-4" /> Rent Books
            </Link>
          </div>
        </div>

        <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-gradient-to-br from-white/10 to-transparent rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
      </div>

      {/* Important Health Day Widget */}
      {healthDays.length > 0 && (
        <div className="glass rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-6 border border-emerald-500/30 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.2)] relative overflow-hidden animate-slide-up">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-900/20 dark:to-teal-900/20 -z-10" />
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-inner flex-shrink-0">
              <HeartPulse className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Important Today
              </p>
              <div className="flex flex-col gap-1">
                {healthDays.map((dayName, idx) => (
                  <h3 key={idx} className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {dayName}
                  </h3>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Access Grid */}
      <div className="glass rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 border border-white/20 shadow-xl">
        <h3 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-white mb-5 ml-1">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Link
            to="/attendance"
            className="group bg-slate-50/60 dark:bg-white/5 p-4 sm:p-6 rounded-[1.75rem] border border-slate-200/50 dark:border-white/10 flex flex-col items-center justify-center gap-3 hover:bg-white/80 dark:hover:bg-white/10 transition duration-300 shadow-sm hover:shadow-md"
          >
            <div className="p-3.5 bg-rose-500/10 dark:bg-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-300 group-hover:scale-110 transition duration-300 shadow-inner">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-rose-600 dark:group-hover:text-white transition">
              Attendance
            </span>
          </Link>

          <Link
            to="/library"
            className="group bg-slate-50/60 dark:bg-white/5 p-4 sm:p-6 rounded-[1.75rem] border border-slate-200/50 dark:border-white/10 flex flex-col items-center justify-center gap-3 hover:bg-white/80 dark:hover:bg-white/10 transition duration-300 shadow-sm hover:shadow-md"
          >
            <div className="p-3.5 bg-blue-500/10 dark:bg-blue-500/20 rounded-2xl text-blue-600 dark:text-blue-300 group-hover:scale-110 transition duration-300 shadow-inner">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-white transition">
              Library
            </span>
          </Link>

          <Link
            to="/book-renting"
            className="group bg-slate-50/60 dark:bg-white/5 p-4 sm:p-6 rounded-[1.75rem] border border-slate-200/50 dark:border-white/10 flex flex-col items-center justify-center gap-3 hover:bg-white/80 dark:hover:bg-white/10 transition duration-300 shadow-sm hover:shadow-md"
          >
            <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-300 group-hover:scale-110 transition duration-300 shadow-inner">
              <Store className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-white transition">
              Book Rent
            </span>
          </Link>

          <Link
            to="/lost-found"
            className="group bg-slate-50/60 dark:bg-white/5 p-4 sm:p-6 rounded-[1.75rem] border border-slate-200/50 dark:border-white/10 flex flex-col items-center justify-center gap-3 hover:bg-white/80 dark:hover:bg-white/10 transition duration-300 shadow-sm hover:shadow-md"
          >
            <div className="p-3.5 bg-purple-500/10 dark:bg-purple-500/20 rounded-2xl text-purple-600 dark:text-purple-300 group-hover:scale-110 transition duration-300 shadow-inner">
              <Search className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-white transition">
              Lost & Found
            </span>
          </Link>

          <Link
            to="/social"
            className="group bg-slate-50/60 dark:bg-white/5 p-4 sm:p-6 rounded-[1.75rem] border border-slate-200/50 dark:border-white/10 flex flex-col items-center justify-center gap-3 hover:bg-white/80 dark:hover:bg-white/10 transition duration-300 shadow-sm hover:shadow-md col-span-2 sm:col-span-1"
          >
            <div className="p-3.5 bg-amber-500/10 dark:bg-amber-500/20 rounded-2xl text-amber-600 dark:text-amber-300 group-hover:scale-110 transition duration-300 shadow-inner">
              <Coffee className="w-6 h-6" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-white transition">
              Chill Corner
            </span>
          </Link>
        </div>
      </div>

      {/* Daily Wisdom Card */}
      <div className="glass rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 border border-white/20 relative overflow-hidden min-h-[180px] flex flex-col justify-center shadow-xl group">
        <div className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.03] dark:opacity-[0.05] rotate-12 transition-transform duration-700 group-hover:rotate-6 group-hover:scale-110 pointer-events-none">
          <BookOpen className="w-64 h-64 text-slate-900 dark:text-white" />
        </div>
        <div className="relative z-10">
          <h4 className="text-blue-600 dark:text-blue-300 text-xs uppercase font-extrabold mb-3 tracking-widest flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> Daily Wisdom
          </h4>
          <p className="text-slate-900 dark:text-white font-serif text-xl sm:text-2xl italic leading-relaxed drop-shadow-sm max-w-3xl">
            &ldquo;Wherever the art of Medicine is loved, there is also a love of Humanity.&rdquo;
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-3 font-bold">— Hippocrates</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
