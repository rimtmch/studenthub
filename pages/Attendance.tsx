import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, X, MinusCircle, PlusCircle, Save, Loader2 } from 'lucide-react';
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

  useEffect(() => {
      const fetchAttendance = async () => {
          if(!username) return;
          const { data, error } = await supabase
              .from('profiles')
              .select('attendance_data')
              .eq('username', username)
              .single();
          
          if(data && data.attendance_data) {
              const loadedSubjects = Array.isArray(data.attendance_data) ? data.attendance_data : [];
              setSubjects(loadedSubjects);
          }
      };
      fetchAttendance();
  }, [username, setSubjects]);

  useEffect(() => {
      if(subjects.length === 0) return;
      
      const timeoutId = setTimeout(async () => {
          setSaveStatus('saving');
          try {
              const { error } = await supabase
                  .from('profiles')
                  .update({ attendance_data: subjects })
                  .eq('username', username);
              
              if(error) throw error;
              setSaveStatus('saved');
          } catch(e) {
              console.error("Save failed", e);
              setSaveStatus('error');
          }
      }, 2000); 

      return () => clearTimeout(timeoutId);
  }, [subjects, username]);

  const mbbsData: Record<string, string[]> = {
    "1st Year": ["Anatomy", "Physiology", "Biochemistry"],
    "2nd Year": ["Pathology", "Microbiology", "Pharmacology", "Forensic Medicine"],
    "3rd Year": ["Ophthalmology", "ENT", "Community Medicine (PSM)"],
    "4th Year": ["General Medicine", "General Surgery", "OBG", "Pediatrics"]
  };
  const [selectedYear, setSelectedYear] = useState('');

  const calculateStatus = (attended: number, total: number, target: number) => {
    if (total === 0) return { msg: "No classes", safe: true, percent: "0.0" };
    const percent = (attended / total) * 100;
    const isSafe = percent >= target;
    if (isSafe) {
      const buns = Math.floor((100 * attended - target * total) / target);
      return { msg: buns > 0 ? `Bunk ${buns} classes` : "On edge!", safe: true, percent: percent.toFixed(1) };
    } else {
      const needed = Math.ceil((target * total - 100 * attended) / (100 - target));
      return { msg: needed > 0 ? `Attend ${needed} next` : "Catch up!", safe: false, percent: percent.toFixed(1) };
    }
  };

  const addSubject = () => {
    if (!newSubjectName) return;
    setSubjects([...subjects, {
      name: newSubjectName,
      theory: { attended: 0, total: 0, target: 75 },
      practical: { attended: 0, total: 0, target: 80 }
    }]);
    setNewSubjectName('');
    setIsModalOpen(false);
  };

  const updateAttendance = (index: number, type: 'theory' | 'practical', field: 'attended' | 'total', delta: number) => {
    const newSubjects = [...subjects];
    const current = newSubjects[index][type][field];
    if (current + delta < 0) return;
    newSubjects[index][type][field] = current + delta;
    setSubjects(newSubjects);
  };

  const markDaily = (index: number, type: 'theory' | 'practical', isPresent: boolean) => {
    const newSubjects = [...subjects];
    newSubjects[index][type].total += 1;
    if (isPresent) {
        newSubjects[index][type].attended += 1;
    }
    setSubjects(newSubjects);
  };

  const deleteSubject = (index: number) => {
    const newSubjects = subjects.filter((_, i) => i !== index);
    setSubjects(newSubjects);
  };

  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Attendance</h2>
        <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-slate-200 dark:border-white/5 backdrop-blur-md">
                <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${
                    saveStatus === 'saved' ? 'bg-green-500 shadow-green-500' : 
                    saveStatus === 'saving' ? 'bg-yellow-500 shadow-yellow-500 animate-pulse' : 'bg-red-500 shadow-red-500'
                }`}></div>
                <span className="text-[10px] text-slate-600 dark:text-slate-300 uppercase font-bold tracking-wider">
                    {saveStatus === 'saved' ? 'Synced' : saveStatus === 'saving' ? 'Saving...' : 'Error'}
                </span>
             </div>

            <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-blue-900/20 active:scale-95"
            >
            <Plus className="w-5 h-5" /> Add Subject
            </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {subjects.length === 0 && (
            <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] bg-white/5 backdrop-blur-sm">
                <p className="text-slate-500 dark:text-slate-400 mb-4 text-lg">No subjects added yet.</p>
                <button onClick={() => setIsModalOpen(true)} className="text-blue-500 dark:text-blue-400 font-bold hover:text-blue-400 transition">Add one now</button>
            </div>
        )}

        {subjects.map((sub, idx) => {
          const theoryStat = calculateStatus(sub.theory.attended, sub.theory.total, sub.theory.target);
          const practStat = calculateStatus(sub.practical.attended, sub.practical.total, sub.practical.target);

          return (
            <div key={idx} className="glass rounded-[2rem] border border-white/5 p-6 relative group shadow-xl hover:border-white/10 transition duration-300">
              <button 
                onClick={() => deleteSubject(idx)}
                className="absolute top-5 right-5 text-slate-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100 p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              
              <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-6 pr-10">{sub.name}</h3>

              <div className="space-y-6">
                {/* Theory Section */}
                <div>
                   <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-300 uppercase tracking-widest">Theory (75%)</span>
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md ${theoryStat.safe ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-300'}`}>
                         <span className="text-[10px] font-bold whitespace-nowrap uppercase tracking-wide">{theoryStat.msg}</span>
                         <span className="text-sm font-bold font-mono">{theoryStat.percent}%</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3 mb-4">
                      <button onClick={() => markDaily(idx, 'theory', true)} className="bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/20 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition">
                        <Check className="w-4 h-4" /> Present
                      </button>
                      <button onClick={() => markDaily(idx, 'theory', false)} className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition">
                        <X className="w-4 h-4" /> Absent
                      </button>
                   </div>

                   <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-3">
                         <span className="uppercase tracking-wide">Attended</span>
                         <div className="flex items-center gap-1">
                            <button onClick={() => updateAttendance(idx, 'theory', 'attended', -1)}><MinusCircle className="w-5 h-5 hover:text-slate-900 dark:hover:text-white transition"/></button>
                            <span className="font-mono text-slate-900 dark:text-white w-6 text-center text-sm">{sub.theory.attended}</span>
                            <button onClick={() => updateAttendance(idx, 'theory', 'attended', 1)}><PlusCircle className="w-5 h-5 hover:text-slate-900 dark:hover:text-white transition"/></button>
                         </div>
                      </div>
                      <div className="w-px h-6 bg-slate-200 dark:bg-white/10"></div>
                      <div className="flex items-center gap-3">
                         <span className="uppercase tracking-wide">Total</span>
                         <div className="flex items-center gap-1">
                            <button onClick={() => updateAttendance(idx, 'theory', 'total', -1)}><MinusCircle className="w-5 h-5 hover:text-slate-900 dark:hover:text-white transition"/></button>
                            <span className="font-mono text-slate-900 dark:text-white w-6 text-center text-sm">{sub.theory.total}</span>
                            <button onClick={() => updateAttendance(idx, 'theory', 'total', 1)}><PlusCircle className="w-5 h-5 hover:text-slate-900 dark:hover:text-white transition"/></button>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Practical Section */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/5">
                   <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-300 uppercase tracking-widest">Practical (80%)</span>
                       <div className={`flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md ${practStat.safe ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-300'}`}>
                         <span className="text-[10px] font-bold whitespace-nowrap uppercase tracking-wide">{practStat.msg}</span>
                         <span className="text-sm font-bold font-mono">{practStat.percent}%</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3 mb-4">
                      <button onClick={() => markDaily(idx, 'practical', true)} className="bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/20 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition">
                        <Check className="w-4 h-4" /> Present
                      </button>
                      <button onClick={() => markDaily(idx, 'practical', false)} className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition">
                        <X className="w-4 h-4" /> Absent
                      </button>
                   </div>
                   
                   <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-3">
                         <span className="uppercase tracking-wide">Attended</span>
                         <div className="flex items-center gap-1">
                            <button onClick={() => updateAttendance(idx, 'practical', 'attended', -1)}><MinusCircle className="w-5 h-5 hover:text-slate-900 dark:hover:text-white transition"/></button>
                            <span className="font-mono text-slate-900 dark:text-white w-6 text-center text-sm">{sub.practical.attended}</span>
                            <button onClick={() => updateAttendance(idx, 'practical', 'attended', 1)}><PlusCircle className="w-5 h-5 hover:text-slate-900 dark:hover:text-white transition"/></button>
                         </div>
                      </div>
                      <div className="w-px h-6 bg-slate-200 dark:bg-white/10"></div>
                      <div className="flex items-center gap-3">
                         <span className="uppercase tracking-wide">Total</span>
                         <div className="flex items-center gap-1">
                            <button onClick={() => updateAttendance(idx, 'practical', 'total', -1)}><MinusCircle className="w-5 h-5 hover:text-slate-900 dark:hover:text-white transition"/></button>
                            <span className="font-mono text-slate-900 dark:text-white w-6 text-center text-sm">{sub.practical.total}</span>
                            <button onClick={() => updateAttendance(idx, 'practical', 'total', 1)}><PlusCircle className="w-5 h-5 hover:text-slate-900 dark:hover:text-white transition"/></button>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-heavy border border-white/10 p-8 rounded-[2rem] max-w-sm w-full animate-fade-in shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Add Subject</h3>
            
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium ml-1 uppercase tracking-wide">Select Year</label>
            <select 
                className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl p-4 mb-4 text-sm focus:outline-none focus:border-blue-500/50"
                value={selectedYear}
                onChange={(e) => {
                    setSelectedYear(e.target.value);
                    if (e.target.value !== 'Custom') setNewSubjectName(mbbsData[e.target.value][0]);
                    else setNewSubjectName('');
                }}
            >
                <option value="" disabled>Choose Year</option>
                {Object.keys(mbbsData).map(y => <option key={y} value={y}>{y}</option>)}
                <option value="Custom">Custom / Elective</option>
            </select>

            {selectedYear && selectedYear !== 'Custom' && (
                <div className="mb-6">
                     <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium ml-1 uppercase tracking-wide">Subject</label>
                     <select 
                        className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl p-4 text-sm focus:outline-none focus:border-blue-500/50"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                     >
                         {mbbsData[selectedYear].map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                </div>
            )}

            {(selectedYear === 'Custom') && (
                 <div className="mb-6">
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium ml-1 uppercase tracking-wide">Custom Subject Name</label>
                    <input 
                        type="text" 
                        className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl p-4 text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-400 dark:placeholder-slate-600"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        placeholder="e.g. Research Methodology"
                    />
                 </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm transition">Cancel</button>
              <button onClick={addSubject} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-900/30 hover:bg-blue-500 transition">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;