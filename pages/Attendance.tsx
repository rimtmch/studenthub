import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Check, X, MinusCircle, PlusCircle, AlertCircle } from 'lucide-react';
import { Subject } from '../types';
import { supabase } from '../services/supabaseClient';

interface AttendanceProps {
  subjects: Subject[];
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  username: string;
}

const Attendance: React.FC<AttendanceProps> = ({ subjects, setSubjects, username }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [subjectToDelete, setSubjectToDelete] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const fetchAttendance = async () => {
      if (!username) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('attendance_data')
          .ilike('username', username)
          .maybeSingle();

        if (isMounted && data && data.attendance_data) {
          const loadedSubjects = Array.isArray(data.attendance_data) ? data.attendance_data : [];
          setSubjects(loadedSubjects);
        }
      } catch (e) {
        console.warn('fetch attendance failed gracefully:', e);
      } finally {
        if (isMounted) {
          hasLoadedRef.current = true;
        }
      }
    };
    fetchAttendance();
    return () => {
      isMounted = false;
    };
  }, [username, setSubjects]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const timeoutId = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ attendance_data: subjects })
          .ilike('username', username);

        if (error) throw error;
        setSaveStatus('saved');
      } catch (e) {
        console.error('Save failed', e);
        setSaveStatus('error');
      }
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [subjects, username]);

  const mbbsData: Record<string, string[]> = {
    '1st Year': ['Anatomy', 'Physiology', 'Biochemistry'],
    '2nd Year': ['Pathology', 'Microbiology', 'Pharmacology', 'Forensic Medicine'],
    '3rd Year': ['Ophthalmology', 'ENT', 'Community Medicine (PSM)'],
    '4th Year': ['General Medicine', 'General Surgery', 'OBG', 'Pediatrics'],
  };
  const [selectedYear, setSelectedYear] = useState('');

  const calculateStatus = (attended: number, total: number, target: number) => {
    if (total === 0) return { msg: 'No classes', safe: true, percent: '0.0' };
    const percent = (attended / total) * 100;
    const isSafe = percent >= target;
    if (isSafe) {
      const buns = Math.floor((100 * attended - target * total) / target);
      return {
        msg: buns > 0 ? `Bunk ${buns} classes` : 'On edge!',
        safe: true,
        percent: percent.toFixed(1),
      };
    } else {
      const needed = Math.ceil((target * total - 100 * attended) / (100 - target));
      return {
        msg: needed > 0 ? `Attend ${needed} next` : 'Catch up!',
        safe: false,
        percent: percent.toFixed(1),
      };
    }
  };

  const addSubject = () => {
    const trimmed = newSubjectName.trim();
    if (!trimmed) return;
    setSubjects((prev) => [
      ...prev,
      {
        name: trimmed,
        theory: { attended: 0, total: 0, target: 75 },
        practical: { attended: 0, total: 0, target: 80 },
      },
    ]);
    setNewSubjectName('');
    setSelectedYear('');
    setIsModalOpen(false);
  };

  const updateAttendance = (
    index: number,
    type: 'theory' | 'practical',
    field: 'attended' | 'total',
    delta: number
  ) => {
    setSubjects((prev) => {
      const updated = [...prev];
      const targetSub = { ...updated[index] };
      const targetRec = { ...targetSub[type] };

      const current = targetRec[field];
      if (current + delta < 0) return prev;

      // Ensure attended doesn't exceed total
      if (field === 'attended' && current + delta > targetRec.total) {
        targetRec.total = current + delta;
      }
      targetRec[field] = current + delta;

      // If total was decreased below attended, adjust attended
      if (field === 'total' && targetRec.attended > current + delta) {
        targetRec.attended = current + delta;
      }

      targetSub[type] = targetRec;
      updated[index] = targetSub;
      return updated;
    });
  };

  const markDaily = (index: number, type: 'theory' | 'practical', isPresent: boolean) => {
    setSubjects((prev) => {
      const updated = [...prev];
      const targetSub = { ...updated[index] };
      const targetRec = { ...targetSub[type] };

      targetRec.total += 1;
      if (isPresent) {
        targetRec.attended += 1;
      }

      targetSub[type] = targetRec;
      updated[index] = targetSub;
      return updated;
    });
  };

  const confirmDeleteSubject = (index: number) => {
    setSubjects((prev) => prev.filter((_, i) => i !== index));
    setSubjectToDelete(null);
  };

  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-6 sm:mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Attendance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track Theory (75%) and Practical (80%) requirements
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync indicator visible on all viewports */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/70 dark:bg-white/5 rounded-full border border-slate-200 dark:border-white/10 backdrop-blur-md">
            <div
              className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${
                saveStatus === 'saved'
                  ? 'bg-green-500 shadow-green-500'
                  : saveStatus === 'saving'
                  ? 'bg-yellow-500 shadow-yellow-500 animate-pulse'
                  : 'bg-red-500 shadow-red-500'
              }`}
            />
            <span className="text-[10px] text-slate-600 dark:text-slate-300 uppercase font-bold tracking-wider">
              {saveStatus === 'saved' ? 'Synced' : saveStatus === 'saving' ? 'Saving...' : 'Error'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-blue-900/20 active:scale-95"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Add Subject
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {subjects.length === 0 && (
          <div className="col-span-full text-center py-16 sm:py-20 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] bg-white/5 backdrop-blur-sm px-4">
            <p className="text-slate-500 dark:text-slate-400 mb-4 text-base sm:text-lg">No subjects added yet.</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline transition"
            >
              Add one now
            </button>
          </div>
        )}

        {subjects.map((sub, idx) => {
          const theoryStat = calculateStatus(sub.theory.attended, sub.theory.total, sub.theory.target);
          const practStat = calculateStatus(sub.practical.attended, sub.practical.total, sub.practical.target);

          return (
            <div
              key={idx}
              className="glass rounded-[2rem] border border-white/10 p-5 sm:p-6 relative group shadow-xl hover:border-white/20 transition duration-300"
            >
              <button
                type="button"
                onClick={() => setSubjectToDelete(idx)}
                aria-label={`Delete subject ${sub.name}`}
                className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <h3 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-white mb-5 pr-10">
                {sub.name}
              </h3>

              <div className="space-y-5">
                {/* Theory Section */}
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-300 uppercase tracking-widest">
                      Theory (75%)
                    </span>
                    <div
                      className={`flex items-center gap-2 px-2.5 py-1 rounded-full border backdrop-blur-md ${
                        theoryStat.safe
                          ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-300'
                          : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-300'
                      }`}
                    >
                      <span className="text-[10px] font-bold whitespace-nowrap uppercase tracking-wide">
                        {theoryStat.msg}
                      </span>
                      <span className="text-xs sm:text-sm font-bold font-mono">{theoryStat.percent}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    <button
                      type="button"
                      onClick={() => markDaily(idx, 'theory', true)}
                      aria-label="Mark theory present"
                      className="bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/20 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <Check className="w-4 h-4" /> Present
                    </button>
                    <button
                      type="button"
                      onClick={() => markDaily(idx, 'theory', false)}
                      aria-label="Mark theory absent"
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <X className="w-4 h-4" /> Absent
                    </button>
                  </div>

                  <div className="flex justify-between items-center bg-slate-100/60 dark:bg-slate-900/50 p-2.5 sm:p-3 rounded-xl border border-slate-200/50 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="uppercase tracking-wide text-[10px] sm:text-xs">Attended</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Decrease attended theory"
                          onClick={() => updateAttendance(idx, 'theory', 'attended', -1)}
                          className="hover:text-slate-900 dark:hover:text-white transition p-0.5"
                        >
                          <MinusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <span className="font-mono text-slate-900 dark:text-white w-6 text-center text-xs sm:text-sm font-bold">
                          {sub.theory.attended}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase attended theory"
                          onClick={() => updateAttendance(idx, 'theory', 'attended', 1)}
                          className="hover:text-slate-900 dark:hover:text-white transition p-0.5"
                        >
                          <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="uppercase tracking-wide text-[10px] sm:text-xs">Total</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Decrease total theory"
                          onClick={() => updateAttendance(idx, 'theory', 'total', -1)}
                          className="hover:text-slate-900 dark:hover:text-white transition p-0.5"
                        >
                          <MinusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <span className="font-mono text-slate-900 dark:text-white w-6 text-center text-xs sm:text-sm font-bold">
                          {sub.theory.total}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase total theory"
                          onClick={() => updateAttendance(idx, 'theory', 'total', 1)}
                          className="hover:text-slate-900 dark:hover:text-white transition p-0.5"
                        >
                          <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Practical Section */}
                <div className="pt-4 border-t border-slate-200/50 dark:border-white/5">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-300 uppercase tracking-widest">
                      Practical (80%)
                    </span>
                    <div
                      className={`flex items-center gap-2 px-2.5 py-1 rounded-full border backdrop-blur-md ${
                        practStat.safe
                          ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-300'
                          : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-300'
                      }`}
                    >
                      <span className="text-[10px] font-bold whitespace-nowrap uppercase tracking-wide">
                        {practStat.msg}
                      </span>
                      <span className="text-xs sm:text-sm font-bold font-mono">{practStat.percent}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    <button
                      type="button"
                      onClick={() => markDaily(idx, 'practical', true)}
                      aria-label="Mark practical present"
                      className="bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/20 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <Check className="w-4 h-4" /> Present
                    </button>
                    <button
                      type="button"
                      onClick={() => markDaily(idx, 'practical', false)}
                      aria-label="Mark practical absent"
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <X className="w-4 h-4" /> Absent
                    </button>
                  </div>

                  <div className="flex justify-between items-center bg-slate-100/60 dark:bg-slate-900/50 p-2.5 sm:p-3 rounded-xl border border-slate-200/50 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="uppercase tracking-wide text-[10px] sm:text-xs">Attended</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Decrease attended practical"
                          onClick={() => updateAttendance(idx, 'practical', 'attended', -1)}
                          className="hover:text-slate-900 dark:hover:text-white transition p-0.5"
                        >
                          <MinusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <span className="font-mono text-slate-900 dark:text-white w-6 text-center text-xs sm:text-sm font-bold">
                          {sub.practical.attended}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase attended practical"
                          onClick={() => updateAttendance(idx, 'practical', 'attended', 1)}
                          className="hover:text-slate-900 dark:hover:text-white transition p-0.5"
                        >
                          <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="uppercase tracking-wide text-[10px] sm:text-xs">Total</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Decrease total practical"
                          onClick={() => updateAttendance(idx, 'practical', 'total', -1)}
                          className="hover:text-slate-900 dark:hover:text-white transition p-0.5"
                        >
                          <MinusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <span className="font-mono text-slate-900 dark:text-white w-6 text-center text-xs sm:text-sm font-bold">
                          {sub.practical.total}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase total practical"
                          onClick={() => updateAttendance(idx, 'practical', 'total', 1)}
                          className="hover:text-slate-900 dark:hover:text-white transition p-0.5"
                        >
                          <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Subject Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-heavy border border-white/20 p-6 sm:p-8 rounded-[2rem] max-w-sm w-full animate-fade-in shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-5">Add Subject</h3>

            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium ml-1 uppercase tracking-wide">
              Select MBBS Year
            </label>
            <select
              className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl p-3.5 mb-4 text-sm focus:outline-none focus:border-blue-500"
              value={selectedYear}
              onChange={(e) => {
                const year = e.target.value;
                setSelectedYear(year);
                if (year !== 'Custom' && mbbsData[year]) {
                  setNewSubjectName(mbbsData[year][0]);
                } else {
                  setNewSubjectName('');
                }
              }}
            >
              <option value="" disabled>
                Choose Year
              </option>
              {Object.keys(mbbsData).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              <option value="Custom">Custom / Elective</option>
            </select>

            {selectedYear && selectedYear !== 'Custom' && (
              <div className="mb-5">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium ml-1 uppercase tracking-wide">
                  Subject
                </label>
                <select
                  className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl p-3.5 text-sm focus:outline-none focus:border-blue-500"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                >
                  {mbbsData[selectedYear]?.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedYear === 'Custom' && (
              <div className="mb-5">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium ml-1 uppercase tracking-wide">
                  Custom Subject Name
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl p-3.5 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="e.g. Research Methodology"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addSubject}
                disabled={!newSubjectName.trim()}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-900/30 hover:bg-blue-500 transition disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {subjectToDelete !== null && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-heavy border border-white/20 p-6 rounded-[2rem] max-w-sm w-full shadow-2xl">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-3 text-red-500 border border-red-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Delete Subject?</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Are you sure you want to remove{' '}
                <span className="font-bold text-slate-900 dark:text-white">
                  &ldquo;{subjects[subjectToDelete]?.name}&rdquo;
                </span>
                ? Its logged attendance record will be deleted.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSubjectToDelete(null)}
                className="flex-1 py-3 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs sm:text-sm transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteSubject(subjectToDelete)}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs sm:text-sm transition shadow-lg shadow-red-900/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
