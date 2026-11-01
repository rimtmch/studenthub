import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Users,
  MessageCircle,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  LogOut,
  Sparkles,
  UserX,
  UserCog,
  Eye,
  EyeOff,
} from 'lucide-react';
import { UserProfile, Confession } from '../types';
import { supabase, getErrorMessage } from '../services/supabaseClient';
import { getDirectImageUrl, handleImageError } from '../services/imageStorage';

interface AdminPanelProps {
  user: UserProfile;
  onLogout: () => void;
}

interface ReportItem {
  id: number;
  confession_id: number;
  reason: string;
  reporter_username: string;
  created_at: string;
  confession?: Confession | null;
}

interface StudentRecord {
  id?: string;
  username: string;
  fullname: string;
  email: string;
  phone?: string;
  dob?: string;
  course?: string;
  batch_year?: string;
  pin?: string;
  password?: string;
  avatar?: string;
  avatar_data?: string;
  avatar_url?: string;
  created_at?: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const isAdmin = user.username.toLowerCase() === 'adminrmch' || user.role === 'admin';

  const [activeTab, setActiveTab] = useState<'moderation' | 'students' | 'overview'>('moderation');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Moderation state
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [confessionSearch, setConfessionSearch] = useState('');
  const [confessionFilter, setConfessionFilter] = useState<'all' | 'confession' | 'ask_senior' | 'poll'>('all');
  const [processingPostId, setProcessingPostId] = useState<string | null>(null);

  // Student directory state
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<'all' | 'MBBS' | 'BDS'>('all');

  // Edit Student Modal
  const [selectedStudentForPassword, setSelectedStudentForPassword] = useState<StudentRecord | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [editBatchYear, setEditBatchYear] = useState('2024');
  const [editCourse, setEditCourse] = useState<'MBBS' | 'BDS'>('MBBS');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordModalMessage, setPasswordModalMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'post' | 'student' | 'reply';
    id: string | number;
    title: string;
    parentId?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status Notification
  const [actionNotice, setActionNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  const showNotice = (text: string, isError = false) => {
    setActionNotice({ text, isError });
    setTimeout(() => setActionNotice(null), 4000);
  };

  // 1. Fetch Reports & Confessions
  const fetchModerationData = useCallback(async () => {
    try {
      // A. Fetch reports
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      // B. Fetch all confessions with replies
      const { data: confessionsData } = await supabase
        .from('confessions')
        .select('*, replies(*)')
        .order('created_at', { ascending: false })
        .limit(100);

      const parsedConfessions: Confession[] = (confessionsData || []).map((p: any) => {
        let cleanText = p.text || '';
        let tag: string | undefined = undefined;
        let isAskSenior = false;
        let imageUrl: string | undefined = undefined;

        // Parse [TAG:...]
        const tagMatch = cleanText.match(/^\[TAG:([\s\S]*?)\]\n?/);
        if (tagMatch) {
          tag = tagMatch[1].trim();
          isAskSenior = true;
          cleanText = cleanText.replace(tagMatch[0], '');
        }

        // Parse [IMAGE:...]
        const imgMatch = cleanText.match(/^\[IMAGE:([\s\S]*?)\]\n?/);
        if (imgMatch) {
          imageUrl = imgMatch[1].trim();
          cleanText = cleanText.replace(imgMatch[0], '');
        }

        // Parse [POLL:...]
        let poll = null;
        const pollMatch = cleanText.match(/^\[POLL:([\s\S]*?)\]\n?/);
        if (pollMatch) {
          try {
            poll = JSON.parse(pollMatch[1]);
            cleanText = cleanText.replace(pollMatch[0], '');
          } catch {
            // ignore
          }
        }

        return {
          ...p,
          id: String(p.id),
          text: cleanText.trim(),
          tag,
          isAskSenior: Boolean(isAskSenior || tag),
          image_url: p.image_url || imageUrl,
          poll,
          likes: p.likes || 0,
          replies: (p.replies || []).map((r: any) => ({
            ...r,
            id: String(r.id),
            likes: r.likes || 0,
          })),
        };
      });

      setConfessions(parsedConfessions);

      // Link reports to confession objects
      const linkedReports: ReportItem[] = (reportsData || []).map((rep: any) => {
        const found = parsedConfessions.find((c) => Number(c.id) === Number(rep.confession_id));
        return {
          ...rep,
          confession: found || null,
        };
      });

      setReports(linkedReports);
    } catch (err) {
      console.error('Failed to load moderation data:', err);
    }
  }, []);

  // 2. Fetch Student Profiles
  const fetchStudentsData = useCallback(async () => {
    try {
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('*')
        .order('username', { ascending: true });

      if (error) throw error;
      setStudents(profilesData || []);
    } catch (err) {
      console.error('Failed to load student profiles:', err);
    }
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchModerationData(), fetchStudentsData()]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([fetchModerationData(), fetchStudentsData()]).finally(() => {
      setLoading(false);
    });
  }, [isAdmin, fetchModerationData, fetchStudentsData]);

  // Handle Post Deletion
  const handleDeletePost = async (confessionId: string | number) => {
    setIsDeleting(true);
    const idNum = Number(confessionId);
    try {
      // 1. Delete associated reports
      try {
        await supabase.from('reports').delete().eq('confession_id', idNum);
      } catch (e) {
        console.warn('Reports delete note:', e);
      }

      // 2. Delete associated replies
      try {
        await supabase.from('replies').delete().eq('confession_id', idNum);
      } catch (e) {
        console.warn('Replies delete note:', e);
      }

      // 3. Delete likes
      try {
        await supabase.from('confession_likes').delete().eq('confession_id', idNum);
      } catch (e) {
        console.warn('Likes delete note:', e);
      }

      // 4. Delete the confession itself
      const { error } = await supabase.from('confessions').delete().eq('id', idNum);
      if (error) throw error;

      // Update state
      setConfessions((prev) => prev.filter((p) => Number(p.id) !== idNum));
      setReports((prev) => prev.filter((r) => Number(r.confession_id) !== idNum));

      showNotice(`Post #${idNum} and all its comments were permanently deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Failed to delete post:', err);
      showNotice(`Failed to delete post: ${getErrorMessage(err)}`, true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Dismiss a Report (keep post, clear report row)
  const handleDismissReport = async (reportId: number) => {
    setProcessingPostId(String(reportId));
    try {
      const { error } = await supabase.from('reports').delete().eq('id', reportId);
      if (error) throw error;
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      showNotice('Report dismissed successfully. The post remains active.');
    } catch (err: any) {
      showNotice(`Failed to dismiss report: ${getErrorMessage(err)}`, true);
    } finally {
      setProcessingPostId(null);
    }
  };

  // Delete a Reply
  const handleDeleteReply = async (replyId: string | number, parentPostId?: string) => {
    setIsDeleting(true);
    const idNum = Number(replyId);
    try {
      const { error } = await supabase.from('replies').delete().eq('id', idNum);
      if (error) throw error;

      if (parentPostId) {
        setConfessions((prev) =>
          prev.map((p) =>
            p.id === parentPostId
              ? { ...p, replies: p.replies.filter((r) => Number(r.id) !== idNum) }
              : p
          )
        );
      }

      showNotice(`Reply #${idNum} was deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showNotice(`Failed to delete reply: ${getErrorMessage(err)}`, true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Edit Student Details (Batch, Course, Password / PIN)
  const handleSaveStudentPassword = async () => {
    if (!selectedStudentForPassword) return;
    setIsUpdatingPassword(true);
    setPasswordModalMessage(null);

    const cleanPass = newPasswordInput.trim();
    const studentUser = selectedStudentForPassword.username;

    try {
      const updateData: Record<string, any> = {
        batch_year: editBatchYear,
        course: editCourse,
      };
      if (cleanPass) {
        updateData.password = cleanPass;
        updateData.pin = cleanPass;
      }

      let { error } = await supabase
        .from('profiles')
        .update(updateData)
        .ilike('username', studentUser);

      if (error && (error.message?.includes('batch_year') || error.message?.includes('course') || error.message?.includes('pin'))) {
        // Fallback if batch_year or pin is missing in schema
        const fallbackData: Record<string, any> = {};
        if (cleanPass) fallbackData.password = cleanPass;
        const retryRes = await supabase
          .from('profiles')
          .update(fallbackData)
          .ilike('username', studentUser);
        error = retryRes.error;
      }

      if (error) throw error;

      // Update local state
      setStudents((prev) =>
        prev.map((s) =>
          s.username.toLowerCase() === studentUser.toLowerCase()
            ? {
                ...s,
                batch_year: editBatchYear,
                course: editCourse,
                ...(cleanPass ? { pin: cleanPass, password: cleanPass } : {}),
              }
            : s
        )
      );

      setPasswordModalMessage({
        text: `Student details updated successfully for @${studentUser}!`,
        isError: false,
      });

      setTimeout(() => {
        setSelectedStudentForPassword(null);
        setNewPasswordInput('');
        setPasswordModalMessage(null);
      }, 1500);
    } catch (err: any) {
      setPasswordModalMessage({
        text: `Error updating student: ${getErrorMessage(err)}`,
        isError: true,
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Delete Student Profile
  const handleDeleteStudent = async (studentUsername: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .ilike('username', studentUsername);

      if (error) throw error;

      setStudents((prev) =>
        prev.filter((s) => s.username.toLowerCase() !== studentUsername.toLowerCase())
      );

      showNotice(`Profile for @${studentUsername} was deleted permanently.`);
      setDeleteTarget(null);
    } catch (err: any) {
      showNotice(`Failed to delete student: ${getErrorMessage(err)}`, true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset Student Avatar
  const handleResetAvatar = async (studentUsername: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          avatar: null,
          avatar_data: null,
          avatar_url: null,
        })
        .ilike('username', studentUsername);

      if (error) throw error;

      setStudents((prev) =>
        prev.map((s) =>
          s.username.toLowerCase() === studentUsername.toLowerCase()
            ? { ...s, avatar: undefined, avatar_data: undefined, avatar_url: undefined }
            : s
        )
      );

      showNotice(`Profile photo cleared for @${studentUsername}.`);
    } catch (err: any) {
      showNotice(`Failed to clear avatar: ${getErrorMessage(err)}`, true);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-[2.5rem] p-10 max-w-md w-full text-center border border-rose-500/30 shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Restricted Access</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This administration control center is accessible only to verified administrators.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg shadow-blue-900/20"
          >
            Back to Student Hub
          </button>
        </div>
      </div>
    );
  }

  // Filtered Confessions
  const filteredConfessions = confessions.filter((post) => {
    const q = confessionSearch.toLowerCase().trim();
    if (q) {
      const matchText = (post.text || '').toLowerCase().includes(q);
      const matchAuthor = (post.username || '').toLowerCase().includes(q);
      const matchTag = (post.tag || '').toLowerCase().includes(q);
      if (!matchText && !matchAuthor && !matchTag) return false;
    }
    if (confessionFilter === 'ask_senior') {
      return Boolean(post.isAskSenior || post.tag);
    }
    if (confessionFilter === 'confession') {
      return !post.isAskSenior && !post.tag && !post.poll;
    }
    if (confessionFilter === 'poll') {
      return Boolean(post.poll);
    }
    return true;
  });

  // Filtered Students
  const filteredStudents = students.filter((s) => {
    if (s.username.toLowerCase() === 'adminrmch') return false; // Hide self from student list
    const q = studentSearch.toLowerCase().trim();
    if (q) {
      const matchUser = (s.username || '').toLowerCase().includes(q);
      const matchName = (s.fullname || '').toLowerCase().includes(q);
      const matchEmail = (s.email || '').toLowerCase().includes(q);
      const matchPhone = (s.phone || '').includes(q);
      if (!matchUser && !matchName && !matchEmail && !matchPhone) return false;
    }
    if (courseFilter !== 'all') {
      if ((s.course || 'MBBS').toUpperCase() !== courseFilter) return false;
    }
    return true;
  });

  return (
    <div className="pb-24 animate-fade-in max-w-5xl mx-auto space-y-6">
      {/* Toast Notification */}
      {actionNotice && (
        <div
          className={`fixed top-20 right-4 sm:right-8 z-50 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md border flex items-center gap-2.5 text-sm font-semibold animate-slide-up ${
            actionNotice.isError
              ? 'bg-rose-500/90 border-rose-400 text-white'
              : 'bg-emerald-600/90 border-emerald-400 text-white'
          }`}
        >
          {actionNotice.isError ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* Admin Top Header Banner */}
      <div className="glass-heavy rounded-[2.5rem] p-6 sm:p-8 border border-red-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-red-600/15 via-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[2rem] bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 p-0.5 shadow-xl shadow-red-900/30 flex items-center justify-center flex-shrink-0">
              <div className="w-full h-full rounded-[1.85rem] bg-slate-950 flex items-center justify-center text-red-400">
                <ShieldAlert className="w-8 h-8" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  RMCH Admin Center
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/15 border border-red-500/30 text-red-500 uppercase tracking-widest">
                  Superuser
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Logged in as <span className="font-bold text-slate-900 dark:text-white">@adminrmch</span> • Full Moderation & Profile Authority
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="p-3 rounded-2xl glass hover:bg-white/10 text-slate-700 dark:text-slate-300 transition border border-white/10 flex items-center gap-2 text-xs font-semibold"
              title="Refresh all data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <Link
              to="/social"
              className="px-4 py-3 rounded-2xl glass hover:bg-white/10 text-blue-600 dark:text-blue-400 font-bold text-xs transition border border-white/10 flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Student Feed</span>
            </Link>

            <button
              onClick={onLogout}
              className="px-4 py-3 rounded-2xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 font-bold text-xs transition border border-rose-500/20 flex items-center gap-1.5 shadow-sm"
              title="Sign out of admin session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit Admin</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-200/50 dark:border-white/10">
          <div className="p-3.5 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Pending Reports</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-2xl font-black ${reports.length > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                {reports.length}
              </span>
              {reports.length > 0 && <span className="text-[10px] text-red-500 font-bold animate-pulse">Needs Review</span>}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Students</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">
              {students.length}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Active Posts</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">
              {confessions.length}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Academic Threads</span>
            <span className="text-2xl font-black text-blue-500 mt-0.5 block">
              {confessions.filter((c) => c.isAskSenior || c.tag).length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="grid grid-cols-2 gap-2 p-1.5 glass rounded-3xl border border-white/20 shadow-lg">
        <button
          onClick={() => setActiveTab('moderation')}
          className={`py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 relative ${
            activeTab === 'moderation'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-900/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Moderation & Chill Zone</span>
          {reports.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-red-600 shadow-sm animate-bounce">
              {reports.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'students'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Student Directory & Passwords</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-slate-700 dark:text-white">
            {students.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-[2.5rem] p-16 text-center border border-white/10 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Loading admin database...</p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: MODERATION & REPORTS                                               */}
          {/* ========================================================================= */}
          {activeTab === 'moderation' && (
            <div className="space-y-6">
          {/* Section: Pending Reports Queue */}
          <div className="glass rounded-[2.5rem] p-6 sm:p-8 border border-white/20 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-500">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Reported Posts Queue</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Flagged content submitted by students for review</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-500">
                {reports.length} pending
              </span>
            </div>

            {reports.length === 0 ? (
              <div className="py-12 text-center rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">All Clean!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  There are currently no reported posts in the queue.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-5 rounded-3xl bg-slate-50/70 dark:bg-black/30 border border-red-500/30 shadow-md space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Flagged by @{rep.reporter_username || 'Student'}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-400">
                          {new Date(rep.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                        Reason: {rep.reason || 'Not specified'}
                      </span>
                    </div>

                    {/* Reported Post Content */}
                    {rep.confession ? (
                      <div className="space-y-2.5 pl-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Author: <strong className="text-slate-900 dark:text-white">@{rep.confession.username}</strong>
                          </span>
                          {rep.confession.tag && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                              {rep.confession.tag}
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-white/50 dark:bg-black/20 p-3 rounded-2xl border border-slate-200/50 dark:border-white/5">
                          {rep.confession.text}
                        </p>

                        {rep.confession.image_url && (
                          <div className="relative inline-block max-w-xs rounded-xl overflow-hidden border border-white/10">
                            <img
                              src={rep.confession.image_url}
                              alt="Reported Attachment"
                              referrerPolicy="no-referrer"
                              onError={handleImageError}
                              className="max-h-40 object-cover rounded-xl"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        The referenced post (# {rep.confession_id}) appears to have already been removed.
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2.5 pt-2">
                      <button
                        onClick={() => handleDismissReport(rep.id)}
                        disabled={processingPostId === String(rep.id)}
                        className="px-4 py-2 rounded-xl glass hover:bg-white/10 text-slate-600 dark:text-slate-300 font-semibold text-xs transition border border-white/10 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Dismiss Report (Keep Post)</span>
                      </button>

                      <button
                        onClick={() =>
                          setDeleteTarget({
                            type: 'post',
                            id: rep.confession_id,
                            title: rep.confession?.text ? `"${rep.confession.text.slice(0, 40)}..."` : `Post #${rep.confession_id}`,
                          })
                        }
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-md shadow-rose-900/30 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Post Permanently</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: All Confessions & Fun Posts Browser */}
          <div className="glass rounded-[2.5rem] p-6 sm:p-8 border border-white/20 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">All Feed Posts</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Search and manage any post in The Chill Zone & Ask a Senior</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={confessionFilter}
                  onChange={(e: any) => setConfessionFilter(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none"
                >
                  <option value="all">All Content</option>
                  <option value="confession">Confessions Only</option>
                  <option value="ask_senior">Ask a Senior Only</option>
                  <option value="poll">Polls Only</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search posts by keywords, author, or tags (#Anatomy, #Pharm)..."
                value={confessionSearch}
                onChange={(e) => setConfessionSearch(e.target.value)}
                className="w-full bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 pl-11 pr-4 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-red-500/50 transition"
              />
            </div>

            {/* Confessions List */}
            <div className="space-y-3.5 pt-2">
              {filteredConfessions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No posts matching your search query.</div>
              ) : (
                filteredConfessions.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3 hover:border-slate-300 dark:hover:border-white/20 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {post.username === 'Anonymous' ? '?' : post.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {post.username === 'Anonymous' ? 'Anonymous 🎭' : `@${post.username}`}
                            </span>
                            {post.tag && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                {post.tag}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(post.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • {post.likes} likes • {post.replies?.length || 0} replies
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setDeleteTarget({
                            type: 'post',
                            id: post.id,
                            title: post.text ? `"${post.text.slice(0, 40)}..."` : `Post #${post.id}`,
                          })
                        }
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition border border-rose-500/20"
                        title="Delete post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                      {post.text}
                    </p>

                    {post.image_url && (
                      <div className="relative inline-block max-w-xs rounded-xl overflow-hidden border border-white/10">
                        <img
                          src={post.image_url}
                          alt="Attachment"
                          referrerPolicy="no-referrer"
                          onError={handleImageError}
                          className="max-h-36 object-cover rounded-xl"
                        />
                      </div>
                    )}

                    {/* Replies if any */}
                    {post.replies && post.replies.length > 0 && (
                      <div className="pl-3 sm:pl-4 border-l-2 border-slate-200 dark:border-white/10 space-y-2 mt-2 pt-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Replies ({post.replies.length}):
                        </span>
                        {post.replies.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-100/60 dark:bg-black/20 text-xs"
                          >
                            <div>
                              <span className="font-bold text-blue-500">@{r.username}</span>:{' '}
                              <span className="text-slate-700 dark:text-slate-300">{r.text}</span>
                            </div>
                            <button
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'reply',
                                  id: r.id,
                                  title: `Reply: "${r.text.slice(0, 30)}..."`,
                                  parentId: post.id,
                                })
                              }
                              className="p-1 text-rose-500 hover:text-rose-400"
                              title="Delete reply"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STUDENT PROFILES & PASSWORD MANAGEMENT                             */}
      {/* ========================================================================= */}
      {activeTab === 'students' && (
        <div className="glass rounded-[2.5rem] p-6 sm:p-8 border border-white/20 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registered Students</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage passwords, view profile details, or remove accounts
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={courseFilter}
                onChange={(e: any) => setCourseFilter(e.target.value)}
                className="bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="all">All Courses</option>
                <option value="MBBS">MBBS Only</option>
                <option value="BDS">BDS Only</option>
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by full name, username, email, or phone number..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 pl-11 pr-4 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500/50 transition"
            />
          </div>

          {/* Students Directory Grid */}
          <div className="grid gap-3 pt-2">
            {filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">No students matching your search criteria.</div>
            ) : (
              filteredStudents.map((s) => (
                <div
                  key={s.username}
                  className="p-4 sm:p-5 rounded-2xl bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-base font-bold shadow-md overflow-hidden flex-shrink-0">
                      {s.avatar || s.avatar_data ? (
                        <img
                          src={getDirectImageUrl(s.avatar || s.avatar_data)}
                          alt={s.fullname || s.username}
                          referrerPolicy="no-referrer"
                          onError={handleImageError}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (s.fullname || s.username).charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {s.fullname || 'Student'}
                        </h4>
                        <span className="text-xs font-semibold text-blue-500">@{s.username}</span>
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                          {s.course || 'MBBS'} ({s.batch_year || '2024'})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>✉️ {s.email || 'No email'}</span>
                        {s.phone && <span>📞 {s.phone}</span>}
                        {s.dob && <span>🎂 {s.dob}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions for this Student */}
                  <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                    <button
                      onClick={() => {
                        setSelectedStudentForPassword(s);
                        setEditBatchYear(s.batch_year || '2024');
                        setEditCourse(s.course === 'BDS' ? 'BDS' : 'MBBS');
                        setNewPasswordInput(s.pin || s.password || '');
                        setShowPasswordText(false);
                        setPasswordModalMessage(null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-bold text-xs transition border border-blue-500/20 flex items-center gap-1.5 cursor-pointer"
                      title="Edit student batch, course & password"
                    >
                      <UserCog className="w-3.5 h-3.5" />
                      <span>Edit Student</span>
                    </button>

                    {(s.avatar || s.avatar_data) && (
                      <button
                        onClick={() => handleResetAvatar(s.username)}
                        className="p-2 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition border border-white/5"
                        title="Clear photo"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: 'student',
                          id: s.username,
                          title: `@${s.username} (${s.fullname || 'Student'})`,
                        })
                      }
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition border border-rose-500/20"
                      title="Delete profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </>
    )}

      {/* ========================================================================= */}
      {/* EDIT STUDENT MODAL (BATCH, COURSE, PASSWORD)                               */}
      {/* ========================================================================= */}
      {selectedStudentForPassword && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-heavy rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full border border-blue-500/30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                  <UserCog className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Student Details</h3>
                  <p className="text-xs text-slate-400">For student @{selectedStudentForPassword.username}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentForPassword(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Student Details:</label>
                <div className="text-xs p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300">
                  <span className="font-bold">{selectedStudentForPassword.fullname}</span> ({selectedStudentForPassword.email})
                </div>
              </div>

              {/* Course & Batch Year Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Course:</label>
                  <div className="flex rounded-xl bg-slate-100 dark:bg-white/5 p-1 border border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setEditCourse('MBBS')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        editCourse === 'MBBS'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-white'
                      }`}
                    >
                      MBBS
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCourse('BDS')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        editCourse === 'BDS'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-white'
                      }`}
                    >
                      BDS
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Batch Start Year:</label>
                  <select
                    value={editBatchYear}
                    onChange={(e) => setEditBatchYear(e.target.value)}
                    aria-label="Batch start year"
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500/50 cursor-pointer"
                  >
                    {['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018'].map((y) => (
                      <option key={y} value={y} className="text-slate-900 dark:text-white dark:bg-slate-900">
                        Batch of {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Set New Password / PIN:</label>
                <div className="relative">
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Enter new password (or leave as is)..."
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {passwordModalMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    passwordModalMessage.isError
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {passwordModalMessage.text}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 pt-3">
              <button
                onClick={() => setSelectedStudentForPassword(null)}
                disabled={isUpdatingPassword}
                className="flex-1 py-3 rounded-xl glass hover:bg-white/10 text-slate-300 text-xs font-bold transition border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStudentPassword}
                disabled={isUpdatingPassword}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-blue-900/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-heavy rounded-[2.5rem] p-6 sm:p-8 max-w-sm w-full border border-rose-500/30 shadow-2xl space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>

            <h3 className="font-bold text-xl text-slate-900 dark:text-white">
              Delete {deleteTarget.type === 'post' ? 'Post' : deleteTarget.type === 'student' ? 'Student Profile' : 'Reply'}?
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-200">{deleteTarget.title}</strong>? This action cannot be undone.
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl glass hover:bg-white/10 text-slate-300 text-xs font-bold transition border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteTarget.type === 'post') {
                    handleDeletePost(deleteTarget.id);
                  } else if (deleteTarget.type === 'student') {
                    handleDeleteStudent(String(deleteTarget.id));
                  } else if (deleteTarget.type === 'reply') {
                    handleDeleteReply(deleteTarget.id, deleteTarget.parentId);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-rose-900/30 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
