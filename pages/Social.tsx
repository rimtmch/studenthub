
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageCircle,
  Heart,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  X,
  User,
  UserX,
  Flag,
  Search,
  BarChart3,
  TrendingUp,
  Sparkles,
  PlusCircle,
  Image as ImageIcon,
  ExternalLink,
  Maximize2,
  GraduationCap,
  Tag,
  BookOpen,
} from 'lucide-react';
import { Confession, PollData } from '../types';
import { supabase, getErrorMessage } from '../services/supabaseClient';
import { getDirectImageUrl, uploadImageFile, handleImageError } from '../services/imageStorage';

const SENIOR_TAGS = [
  { tag: 'all', label: 'All Topics' },
  // 1st Prof
  { tag: '#1stProf', label: '1st Prof', desc: '1st Year general guidance' },
  { tag: '#Anatomy', label: 'Anatomy', desc: 'Gross Anatomy, Histology, Embryo, Osteology' },
  { tag: '#Physiology', label: 'Physiology', desc: 'General & Systemic Physiology' },
  { tag: '#Biochemistry', label: 'Biochemistry', desc: 'Metabolic pathways & clinical cycles' },

  // 2nd Prof
  { tag: '#2ndProf', label: '2nd Prof', desc: '2nd Year general guidance' },
  { tag: '#Pathology', label: 'Pathology', desc: 'General & Systemic Pathology, Slides' },
  { tag: '#Microbiology', label: 'Microbiology', desc: 'Bacteriology, Virology, Stains, Culture' },
  { tag: '#Pharmacology', label: 'Pharmacology', desc: 'Drug mechanisms, Dosages & Viva' },

  // 3rd Prof
  { tag: '#3rdProf', label: '3rd Prof', desc: '3rd Year general guidance' },
  { tag: '#PSM', label: 'PSM', desc: 'Community Medicine & Epidemiology' },
  { tag: '#FMT', label: 'FMT', desc: 'Forensic Medicine & Toxicology' },
  { tag: '#Ophthalmology', label: 'Ophthalmology', desc: 'Eye diseases & clinical cases' },
  { tag: '#ENT', label: 'ENT', desc: 'Ear, Nose & Throat examination' },

  // Final Prof
  { tag: '#FinalProf', label: 'Final Prof', desc: 'Final Year general guidance' },
  { tag: '#Medicine', label: 'Medicine', desc: 'Internal Medicine, Ward rounds, ECG' },
  { tag: '#Surgery', label: 'Surgery', desc: 'General Surgery, Operative viva & Instruments' },
  { tag: '#OBGYN', label: 'OBGYN', desc: 'Obstetrics & Gynecology cases' },
  { tag: '#Pediatrics', label: 'Pediatrics', desc: 'Milestones, Vaccines & Pediatric cases' },
  { tag: '#Orthopedics', label: 'Orthopedics', desc: 'Fractures, Splints & X-rays' },

  // Clinical & Career
  { tag: '#Internship', label: 'Internship', desc: 'Ward duties, Procedures & Logbook' },
  { tag: '#NEETPG', label: 'NEET PG', desc: 'Grand Tests, Q-Banks & Prep Strategy' },
  { tag: '#GeneralAdvice', label: 'General Advice', desc: 'Textbooks, Exam strategy & Faculty tips' },
];

const parsePostContent = (
  rawText: string
): { cleanText: string; poll: PollData | null; imageUrl?: string; tag?: string; isAskSenior?: boolean } => {
  if (!rawText) return { cleanText: '', poll: null, imageUrl: undefined, tag: undefined, isAskSenior: false };
  let currentText = rawText;
  let imageUrl: string | undefined = undefined;
  let poll: PollData | null = null;
  let tag: string | undefined = undefined;
  let isAskSenior = false;

  // 1. Check for explicit [TAG:...]
  const tagMatch = currentText.match(/^\[TAG:([\s\S]*?)\]\n?/);
  if (tagMatch) {
    tag = tagMatch[1].trim();
    isAskSenior = true;
    currentText = currentText.replace(tagMatch[0], '');
  }

  // 2. Check for attached image [IMAGE:...]
  const imgMatch = currentText.match(/^\[IMAGE:([\s\S]*?)\]\n?/);
  if (imgMatch) {
    imageUrl = imgMatch[1].trim();
    currentText = currentText.replace(imgMatch[0], '');
  }

  // 3. Check for poll [POLL:...]
  const pollMatch = currentText.match(/^\[POLL:([\s\S]*?)\]\n?/);
  if (pollMatch) {
    try {
      poll = JSON.parse(pollMatch[1]);
      currentText = currentText.replace(pollMatch[0], '');
    } catch {
      // ignore
    }
  }

  // 4. Fallback: check if text contains common senior hashtags
  if (!tag) {
    const hashtagMatch = currentText.match(/#(1stProf|Anatomy|Physiology|Biochemistry|2ndProf|Pathology|Microbiology|Pharmacology|3rdProf|PSM|FMT|Ophthalmology|ENT|FinalProf|Medicine|Surgery|OBGYN|Pediatrics|Orthopedics|Internship|NEETPG|GeneralAdvice|PharmTips|AnatomyViva|InternshipPrep|NEETPGStrategy|PathoMicro|AskSenior)\b/i);
    if (hashtagMatch) {
      tag = `#${hashtagMatch[1]}`;
      isAskSenior = true;
    }
  }

  return { cleanText: currentText.trim(), poll, imageUrl, tag, isAskSenior };
};

interface SocialProps {
    user: string;
    userAvatar?: string;
}

const Social: React.FC<SocialProps> = ({ user, userAvatar }) => {
  const [text, setText] = useState('');
  const [isAnon, setIsAnon] = useState(true);
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // Search and Feed Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [feedFilter, setFeedFilter] = useState<'all' | 'trending' | 'popular' | 'polls'>('all');

  // Spaces & Ask a Senior States
  const [activeSpace, setActiveSpace] = useState<'all' | 'confessions' | 'ask_senior'>('all');
  const [selectedSeniorTag, setSelectedSeniorTag] = useState<string>('all');
  const [postCategory, setPostCategory] = useState<'confession' | 'ask_senior'>('confession');
  const [composerTag, setComposerTag] = useState<string>('#Anatomy');

  // Campus Polls
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});

  // Photos
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`rmch_poll_votes_${user}`);
      if (stored) {
        setVotedPolls(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [user]);
  
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isReplyAnon, setIsReplyAnon] = useState(true);

  // Tracks IDs of items the CURRENT user has liked
  const [likedConfessions, setLikedConfessions] = useState<Set<string>>(new Set());
  const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set());

  const [deleteModal, setDeleteModal] = useState<{
      isOpen: boolean;
      type: 'confession' | 'reply';
      id: string; 
      parentId?: string; 
  }>({ isOpen: false, type: 'confession', id: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  const [reportModal, setReportModal] = useState<{
      isOpen: boolean;
      confessionId: string;
  }>({ isOpen: false, confessionId: '' });
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const fetchConfessions = useCallback(async () => {
      try {
          // 1. Fetch Confessions and Replies
          const { data } = await supabase
              .from('confessions')
              .select('*, replies(*)')
              .order('created_at', { ascending: false })
              .limit(50);
          
          if(data) {
              // 2. Fetch User Avatars (for both OP and Repliers)
              const usernamesToFetch = new Set<string>();
              data.forEach((p: any) => {
                  if (p.username && p.username !== 'Anonymous') usernamesToFetch.add(p.username);
                  // Also fetch avatars for replies
                  if (p.replies) {
                      p.replies.forEach((r: any) => {
                          if (r.username && r.username !== 'Anonymous') usernamesToFetch.add(r.username);
                      });
                  }
              });
              
              const avatarMap: Record<string, string> = {};

              if (usernamesToFetch.size > 0) {
                  const { data: profiles } = await supabase
                      .from('profiles')
                      .select('username, avatar_data') // Explicitly fetch avatar_data
                      .in('username', Array.from(usernamesToFetch));
                  
                  if (profiles) {
                      profiles.forEach((p: any) => {
                          // Prioritize avatar_data (base64)
                          avatarMap[p.username] = p.avatar_data;
                      });
                  }
              }

              const formattedData = data.map((post: any) => {
                  const { cleanText, poll, imageUrl, tag, isAskSenior } = parsePostContent(post.text);
                  return {
                      ...post,
                      id: String(post.id),
                      text: cleanText || post.text,
                      poll: poll || undefined,
                      image_url: post.image_url || imageUrl,
                      tag: tag || undefined,
                      isAskSenior: Boolean(isAskSenior || tag),
                      likes: post.likes || 0,
                      replies: post.replies ? post.replies.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((r:any) => ({
                          ...r,
                          id: String(r.id),
                          likes: r.likes || 0,
                          avatar: r.username === 'Anonymous' ? null : getDirectImageUrl(avatarMap[r.username])
                      })) : [],
                      avatar: post.username === 'Anonymous' ? null : getDirectImageUrl(avatarMap[post.username])
                  };
              });
              setConfessions((prev) => {
                if (prev.length === 0) return formattedData as Confession[];
                const prevSig = prev.map((p) => `${p.id}:${p.likes}:${p.replies?.length || 0}`).join(',');
                const nextSig = formattedData.map((p: any) => `${p.id}:${p.likes}:${p.replies?.length || 0}`).join(',');
                if (prevSig === nextSig) {
                  return prev;
                }
                return formattedData as Confession[];
              });

              // 3. Fetch User's Likes (Confessions) - Safely
              if (user) {
                try {
                    const { data: myConfessionLikes, error: confLikeError } = await supabase
                        .from('confession_likes')
                        .select('confession_id')
                        .eq('user_username', user);
                    
                    if (!confLikeError && myConfessionLikes) {
                        setLikedConfessions(new Set(myConfessionLikes.map((l: any) => String(l.confession_id))));
                    }
                } catch (e) {
                    console.warn("Confession likes table missing or unavailable", e);
                }

                // 4. Fetch User's Likes (Replies) - Safely
                try {
                    const { data: myReplyLikes, error: replyLikeError } = await supabase
                        .from('reply_likes')
                        .select('reply_id')
                        .eq('user_username', user);

                    if (!replyLikeError && myReplyLikes) {
                        setLikedReplies(new Set(myReplyLikes.map((l: any) => String(l.reply_id))));
                    }
                } catch (e) {
                    console.warn("Reply likes table missing or unavailable", e);
                }
              }
          }
      } catch (e) {
          console.error("fetchConfessions failed gracefully:", e);
      }
      setLoading(false);
  }, [user]);

  useEffect(() => {
      fetchConfessions();
      const interval = setInterval(() => {
        if (!document.hidden) {
          fetchConfessions();
        }
      }, 45000);
      return () => clearInterval(interval);
  }, [fetchConfessions]);

  const handleVotePoll = (postId: string, optionId: string) => {
    if (votedPolls[postId]) return;
    const updated = { ...votedPolls, [postId]: optionId };
    setVotedPolls(updated);
    try {
      localStorage.setItem(`rmch_poll_votes_${user}`, JSON.stringify(updated));
    } catch {
      // ignore
    }

    setConfessions((prev) =>
      prev.map((post) => {
        if (post.id !== postId || !post.poll) return post;
        const updatedOptions = post.poll.options.map((opt) =>
          opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
        );
        return {
          ...post,
          poll: {
            ...post.poll,
            options: updatedOptions,
            voters: { ...(post.poll.voters || {}), [user]: optionId },
          },
        };
      })
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, WebP).');
      return;
    }
    setIsProcessingImage(true);
    try {
      const { url } = await uploadImageFile(file, `confession_${user || 'anon'}`, 2560, 0.92);
      setAttachedImage(url);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image. Please try another photo.');
    } finally {
      setIsProcessingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const postConfession = async () => {
    if (!text.trim() && !attachedImage && (!showPollCreator || !pollQuestion.trim())) return;
    if (posting) return;
    setPosting(true);

    try {
      let finalContent = text.trim();
      if (attachedImage) {
        finalContent = `[IMAGE:${attachedImage}]\n${finalContent}`;
      }
      if (showPollCreator && pollQuestion.trim()) {
        const cleanOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (cleanOpts.length < 2) {
          alert("Please provide at least 2 options for your poll.");
          setPosting(false);
          return;
        }
        const pollPayload = {
          question: pollQuestion.trim(),
          options: cleanOpts.map((opt, i) => ({ id: `opt_${i + 1}`, text: opt, votes: 0 })),
          voters: {},
        };
        finalContent = `[POLL:${JSON.stringify(pollPayload)}]\n${finalContent}`;
      }

      if (postCategory === 'ask_senior') {
        const tagToUse = composerTag.startsWith('#') ? composerTag : `#${composerTag}`;
        finalContent = `[TAG:${tagToUse}]\n${finalContent}`;
      }

      const insertPayload: Record<string, any> = {
        text: finalContent,
        username: isAnon ? 'Anonymous' : user,
        likes: 0,
      };
      if (attachedImage) {
        insertPayload.image_url = attachedImage;
      }

      let { error } = await supabase.from('confessions').insert([insertPayload]);
      if (error && error.message?.includes('image_url')) {
        // Fallback without image_url column if not yet added in Supabase
        delete insertPayload.image_url;
        const retryRes = await supabase.from('confessions').insert([insertPayload]);
        error = retryRes.error;
      }

      if (!error) {
        setText('');
        setAttachedImage(null);
        setShowPollCreator(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        fetchConfessions();
      } else {
        alert("Failed to post: " + error.message);
      }
    } catch (e) {
      console.error("postConfession failed gracefully:", e);
      alert("Unexpected error posting confession. Please check your connection.");
    }
    setPosting(false);
  };

  const handleConfessionLike = async (postId: string, currentLikes: number) => {
      const isLiked = likedConfessions.has(postId);
      const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;
      const postIdNum = parseInt(postId, 10); // Ensure BigInt compatibility for Confessions

      // Optimistic UI Update
      setConfessions(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p));
      setLikedConfessions(prev => {
          const newSet = new Set(prev);
          if (isLiked) newSet.delete(postId);
          else newSet.add(postId);
          return newSet;
      });

      try {
          if (isLiked) {
              // Remove Like
              const { error } = await supabase
                .from('confession_likes')
                .delete()
                .eq('user_username', user)
                .eq('confession_id', postIdNum);
              
              if (error) throw error;
          } else {
              // Add Like
              const { error } = await supabase
                .from('confession_likes')
                .insert([{ user_username: user, confession_id: postIdNum }]);
              
              if (error) {
                  // Handle table missing specifically
                  if (error.code === '42P01') {
                      alert("Like feature is currently being upgraded. Please try again later.");
                  }
                  throw error;
              }
          }
      } catch (error) {
          console.error("Like toggle error", error);
          // Revert Optimistic UI Update
          setConfessions(prev => prev.map(p => p.id === postId ? { ...p, likes: currentLikes } : p));
          setLikedConfessions(prev => {
              const newSet = new Set(prev);
              if (isLiked) newSet.add(postId); // Re-add if we failed to delete
              else newSet.delete(postId); // Remove if we failed to add
              return newSet;
          });
      }
  };

  const handleReplyLike = async (replyId: string, confessionId: string, currentLikes: number) => {
      const isLiked = likedReplies.has(replyId);
      const newLikes = isLiked ? currentLikes - 1 : currentLikes + 1;
      const replyIdNum = parseInt(replyId, 10); // IMPORTANT: Replies are BigInt, parse to number
      
      // Optimistic UI Update
      setConfessions(prev => prev.map(p => {
          if (p.id === confessionId) {
              return {
                  ...p,
                  replies: p.replies.map(r => r.id === replyId ? { ...r, likes: newLikes } : r)
              };
          }
          return p;
      }));

      setLikedReplies(prev => {
          const newSet = new Set(prev);
          if (isLiked) newSet.delete(replyId);
          else newSet.add(replyId);
          return newSet;
      });

      try {
          if (isLiked) {
              // Remove Like
              const { error } = await supabase
                .from('reply_likes')
                .delete()
                .eq('user_username', user)
                .eq('reply_id', replyIdNum); 
              
              if (error) throw error;

          } else {
              // Add Like
              const { error } = await supabase
                .from('reply_likes')
                .insert([{ user_username: user, reply_id: replyIdNum }]);

              if (error) throw error;
          }
      } catch (error) {
           const msg = getErrorMessage(error);
           console.error("Reply like error", msg);
           
           // Detailed Feedback for user if schema is wrong
           if (msg.includes('column "likes" does not exist')) {
               alert("System Update Required: The 'likes' column is missing from the database. Please contact admin.");
           }
           
           // Revert Optimistic UI Update
           setConfessions(prev => prev.map(p => {
            if (p.id === confessionId) {
                return {
                    ...p,
                    replies: p.replies.map(r => r.id === replyId ? { ...r, likes: currentLikes } : r)
                };
            }
            return p;
            }));
            setLikedReplies(prev => {
                const newSet = new Set(prev);
                if (isLiked) newSet.add(replyId);
                else newSet.delete(replyId);
                return newSet;
            });
      }
  };

  const postReply = async (confessionId: string) => {
      if(!replyText.trim() || isReplying) return;
      setIsReplying(true);

      const confessionIdNum = parseInt(confessionId, 10);

      const { data, error } = await supabase.from('replies').insert([{
          confession_id: confessionIdNum,
          text: replyText,
          username: isReplyAnon ? 'Anonymous' : user,
          likes: 0
      }]).select();

      if (!error && data) {
          setReplyText('');
          // Optimistic append
          const newReply = {
              id: String(data[0].id),
              text: data[0].text,
              username: data[0].username,
              created_at: data[0].created_at,
              likes: 0,
              // Optimistically add avatar using prop if posting as user
              avatar: isReplyAnon ? null : userAvatar 
          };
          
          setConfessions(prev => prev.map(p => {
              if (p.id === confessionId) {
                  return { ...p, replies: [...p.replies, newReply] };
              }
              return p;
          }));
          
          // Trigger a fetch to ensure data consistency
          fetchConfessions();
      } else {
          console.error("Reply failed", error);
          alert("Failed to reply");
      }
      setIsReplying(false);
  };

  const handleDelete = async () => {
      setIsDeleting(true);
      const { type, id, parentId } = deleteModal;
      
      try {
          if (type === 'confession') {
              const idNum = parseInt(id, 10);
              const { error, count } = await supabase
                  .from('confessions')
                  .delete()
                  .eq('id', idNum)
                  .select('id'); // Force return to check RLS
              
              if (error) throw error;
              if (count === 0) throw new Error("Permission denied or item not found");

              setConfessions(prev => prev.filter(p => p.id !== id));
          } else {
              // Reply is BigInt, convert to number
              const idNum = parseInt(id, 10);
              const { error, count } = await supabase
                  .from('replies')
                  .delete()
                  .eq('id', idNum)
                  .select('id');

              if (error) throw error;
              if (count === 0) throw new Error("Permission denied");

              if (parentId) {
                  setConfessions(prev => prev.map(p => {
                      if (p.id === parentId) {
                          return { ...p, replies: p.replies.filter(r => r.id !== id) };
                      }
                      return p;
                  }));
              }
          }
          setDeleteModal({ isOpen: false, type: 'confession', id: '' });
      } catch (e: any) {
          console.error(e);
          alert("Failed to delete: " + getErrorMessage(e));
      } finally {
          setIsDeleting(false);
      }
  };

  const submitReport = async () => {
      if (!reportReason || !reportModal.confessionId) return;
      setIsReporting(true);
      try {
          const confessionIdNum = parseInt(reportModal.confessionId, 10);
          
          const { error } = await supabase.from('reports').insert([{
              confession_id: confessionIdNum,
              reason: reportReason,
              reporter_username: user
          }]).select();

          if (error) throw error;
          
          alert("Report submitted. An admin will review it shortly.");
          setReportModal({ isOpen: false, confessionId: '' });
          setReportReason('');
      } catch (e: any) {
          console.error("Report failed", e);
          alert("Report failed: " + getErrorMessage(e));
      } finally {
          setIsReporting(false);
      }
  };

  return (
    <div className="pb-20 animate-fade-in max-w-2xl mx-auto">
       {/* Feed Header */}
       <div className="mb-6">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
             <span className="p-2 bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 rounded-2xl border border-blue-500/30 text-blue-600 dark:text-blue-400 backdrop-blur-md">
                {activeSpace === 'ask_senior' ? (
                  <GraduationCap className="w-6 h-6" />
                ) : (
                  <MessageCircle className="w-6 h-6" />
                )}
             </span>
             {activeSpace === 'ask_senior' ? 'Ask a Senior Q&A' : 'The Chill Zone'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 ml-1 font-medium">
             {activeSpace === 'ask_senior' 
               ? 'Academic guidance, viva secrets, posting tips & exam strategy from batch seniors' 
               : 'Anonymous confessions, campus buzz & polls'}
          </p>
       </div>

       {/* Top Spaces Switcher */}
       <div className="grid grid-cols-3 gap-1.5 p-1.5 glass rounded-3xl mb-6 border border-white/20 shadow-lg">
          <button
            type="button"
            onClick={() => setActiveSpace('all')}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeSpace === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>All Feed</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSpace('confessions');
              setPostCategory('confession');
            }}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeSpace === 'confessions'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Chill Zone</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSpace('ask_senior');
              setPostCategory('ask_senior');
            }}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeSpace === 'ask_senior'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Ask a Senior</span>
          </button>
       </div>

       {/* Post Box */}
       <div className="glass rounded-[2.5rem] p-6 mb-8 border border-white/20 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-blue-500/20 transition duration-700"></div>

          {/* Post Type Selector (Confession vs Ask a Senior) */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/70 dark:border-white/10">
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setPostCategory('confession')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  postCategory === 'confession'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Confession</span>
              </button>
              <button
                type="button"
                onClick={() => setPostCategory('ask_senior')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  postCategory === 'ask_senior'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/20'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Ask a Senior</span>
              </button>
            </div>

            {postCategory === 'ask_senior' && (
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Academic Q&A</span>
              </span>
            )}
          </div>

          {/* Topic Tag Selector when Ask a Senior is active */}
          {postCategory === 'ask_senior' && (
            <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/5 border border-blue-500/20 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Select Topic Tag:
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Tag your question</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SENIOR_TAGS.filter(t => t.tag !== 'all').map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => setComposerTag(t.tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                      composerTag === t.tag
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/20 font-bold scale-[1.02]'
                        : 'bg-white/80 dark:bg-black/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-blue-400'
                    }`}
                    title={t.desc}
                  >
                    {t.tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <textarea
             value={text}
             onChange={(e) => setText(e.target.value)}
             className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-3xl p-5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/50 dark:focus:bg-black/40 transition resize-none text-base shadow-inner leading-relaxed"
             rows={3}
             placeholder={
               showPollCreator
                 ? "Add optional note or context for your poll..."
                 : postCategory === 'ask_senior'
                   ? `Ask seniors about ${composerTag} (e.g. viva questions, duty shifts, exam prep, books)...`
                   : isAnon
                     ? "What's on your mind? (Posting anonymously 🎭)"
                     : `What's on your mind, @${user}? (Posting publicly 👤)`
             }
          />

          {/* Poll Creator Inputs */}
          {showPollCreator && (
            <div className="mt-4 p-4 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <BarChart3 className="w-3.5 h-3.5" /> Anonymous Campus Poll
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowPollCreator(false);
                    setPollQuestion('');
                    setPollOptions(['', '']);
                  }}
                  className="text-xs text-rose-500 hover:text-rose-400 transition"
                >
                  Cancel Poll
                </button>
              </div>

              <input
                type="text"
                placeholder="Poll Question (e.g. Best book for Pharmacology?)"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="w-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500/50"
              />

              <div className="space-y-2">
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const copy = [...pollOptions];
                        copy[idx] = e.target.value;
                        setPollOptions(copy);
                      }}
                      className="flex-1 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500/50"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                        className="p-2 text-slate-400 hover:text-rose-500 transition"
                        title="Remove option"
                        aria-label="Remove option"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 pt-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Option ({pollOptions.length}/4)
                </button>
              )}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Image Processing Indicator */}
          {isProcessingImage && (
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-500 dark:text-blue-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Uploading photo to Google Drive...</span>
            </div>
          )}

          {/* Attached Image Preview */}
          {attachedImage && (
            <div className="mt-4 relative inline-block rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-md group/img">
              <img
                src={attachedImage}
                alt="Post attachment"
                referrerPolicy="no-referrer"
                onError={handleImageError}
                className="max-h-48 max-w-full rounded-2xl object-cover"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveLightboxImage(attachedImage)}
                  className="p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 transition"
                  title="Expand preview"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="p-2 rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition"
                  title="Remove image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-rose-600 transition"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          
          <div className="flex flex-wrap justify-between items-center gap-3 mt-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Identity Selector */}
                <div className="flex items-center p-1 rounded-2xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setIsAnon(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        isAnon
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                      title="Post anonymously (name hidden)"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Anonymous</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAnon(false)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        !isAnon
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                      title={`Post publicly as @${user}`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>@{user}</span>
                    </button>
                </div>

                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold border transition ${
                    attachedImage
                      ? 'bg-blue-500/15 border-blue-500/30 text-blue-500 font-bold'
                      : 'text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 border-slate-200 dark:border-white/10'
                  }`}
                  title="Attach photo"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                  <span>{attachedImage ? 'Photo Added' : 'Photo'}</span>
                </button>

                {!showPollCreator && (
                  <button
                    type="button"
                    onClick={() => setShowPollCreator(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Poll</span>
                  </button>
                )}
              </div>

              <button 
                onClick={postConfession}
                disabled={(!text.trim() && !attachedImage && (!showPollCreator || !pollQuestion.trim())) || posting || isProcessingImage}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
              >
                 {posting ? (
                   <Loader2 className="w-4 h-4 animate-spin" />
                 ) : postCategory === 'ask_senior' ? (
                   <>
                     <GraduationCap className="w-4 h-4" />
                     <span>Ask Seniors</span>
                   </>
                 ) : (
                   <>
                     <Send className="w-4 h-4" />
                     <span>Post</span>
                   </>
                 )}
              </button>
          </div>
       </div>

       {/* Topic Tag Filter Bar (Ask a Senior / All) */}
       {(activeSpace === 'ask_senior' || activeSpace === 'all') && (
         <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-4 animate-fade-in">
           {SENIOR_TAGS.map((t) => (
             <button
               key={t.tag}
               type="button"
               onClick={() => setSelectedSeniorTag(selectedSeniorTag === t.tag ? 'all' : t.tag)}
               className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 border ${
                 selectedSeniorTag === t.tag
                   ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/20 font-bold'
                   : 'bg-slate-100/80 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-blue-400'
               }`}
               title={t.desc}
             >
               <Tag className="w-3 h-3 text-blue-400" />
               <span>{t.tag === 'all' ? 'All Topics' : t.tag}</span>
             </button>
           ))}
         </div>
       )}

       {/* Search and Feed Filter Tabs */}
       <div className="glass rounded-[2rem] p-4 mb-6 border border-white/15 shadow-xl space-y-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition" />
            <input
              type="text"
              placeholder="Search confessions, polls, topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 pl-11 pr-9 text-xs sm:text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 transition shadow-inner placeholder-slate-400 dark:placeholder-slate-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            <button
              type="button"
              onClick={() => setFeedFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                feedFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Latest
            </button>
            <button
              type="button"
              onClick={() => setFeedFilter('trending')}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                feedFilter === 'trending'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Trending
            </button>
            <button
              type="button"
              onClick={() => setFeedFilter('popular')}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                feedFilter === 'popular'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" /> Most Liked
            </button>
            <button
              type="button"
              onClick={() => setFeedFilter('polls')}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                feedFilter === 'polls'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Campus Polls
            </button>
          </div>
       </div>

       {/* Feed */}
       {(() => {
          const filteredConfessions = confessions.filter((post) => {
            // Space filtering
            if (activeSpace === 'ask_senior') {
              if (!post.isAskSenior && !post.tag) return false;
              if (selectedSeniorTag !== 'all' && post.tag?.toLowerCase() !== selectedSeniorTag.toLowerCase()) {
                return false;
              }
            } else if (activeSpace === 'confessions') {
              if (post.isAskSenior || post.tag) return false;
            } else if (activeSpace === 'all') {
              if (selectedSeniorTag !== 'all') {
                if (post.tag?.toLowerCase() !== selectedSeniorTag.toLowerCase()) return false;
              }
            }

            const q = searchTerm.toLowerCase().trim();
            if (q) {
              const matchText = (post.text || '').toLowerCase().includes(q);
              const matchAuthor = (post.username || '').toLowerCase().includes(q);
              const matchTag = (post.tag || '').toLowerCase().includes(q);
              const matchPoll = post.poll && (
                post.poll.question.toLowerCase().includes(q) ||
                post.poll.options.some((o) => o.text.toLowerCase().includes(q))
              );
              if (!matchText && !matchAuthor && !matchPoll && !matchTag) return false;
            }

            if (feedFilter === 'polls') {
              return Boolean(post.poll);
            }
            return true;
          }).sort((a, b) => {
            if (feedFilter === 'trending') {
              const scoreA = (a.likes || 0) * 2 + (a.replies?.length || 0) * 3;
              const scoreB = (b.likes || 0) * 2 + (b.replies?.length || 0) * 3;
              return scoreB - scoreA;
            }
            if (feedFilter === 'popular') {
              return (b.likes || 0) - (a.likes || 0);
            }
            return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
          });

          return (
             <div className="space-y-6">
                {loading ? (
                   <div className="text-center py-20 flex flex-col items-center gap-4">
                       <div className="relative">
                          <div className="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-white/10 border-t-blue-500 animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                              <MessageCircle className="w-5 h-5 text-blue-500" />
                          </div>
                       </div>
                       <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Loading feed...</p>
                   </div>
                ) : filteredConfessions.length === 0 ? (
                   <div className="glass rounded-[2.5rem] p-12 text-center border border-white/10">
                     {activeSpace === 'ask_senior' ? (
                       <GraduationCap className="w-12 h-12 text-blue-500 mx-auto mb-3 opacity-70" />
                     ) : (
                       <MessageCircle className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
                     )}
                     <h4 className="text-slate-900 dark:text-white font-bold text-lg mb-1">
                       {searchTerm 
                         ? 'No matching posts found' 
                         : activeSpace === 'ask_senior'
                           ? `No questions yet in ${selectedSeniorTag !== 'all' ? selectedSeniorTag : 'Ask a Senior'}`
                           : 'No posts in this feed'}
                     </h4>
                     <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-md mx-auto">
                       {searchTerm 
                         ? 'Try adjusting your search terms or clearing the filter.' 
                         : activeSpace === 'ask_senior'
                           ? 'Have a question about vivas, posting duties, or exam prep? Ask seniors above!'
                           : 'Be the first to break the ice! Post an anonymous confession or campus poll above.'}
                     </p>
                   </div>
                ) : (
                   filteredConfessions.map(post => (
                      <div key={post.id} className="glass rounded-[2.5rem] p-6 border border-white/20 shadow-lg hover:border-white/30 transition duration-300 animate-slide-up">
                         
                         {/* Academic Ask a Senior Tag Header */}
                         {post.tag && (
                           <div className="mb-4 flex items-center justify-between">
                             <button
                               type="button"
                               onClick={() => {
                                 setActiveSpace('ask_senior');
                                 setSelectedSeniorTag(post.tag!);
                               }}
                               className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-purple-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-300 transition hover:scale-105 active:scale-95 shadow-sm"
                               title={`Filter posts by ${post.tag}`}
                             >
                               <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
                               <span>Ask a Senior</span>
                               <span className="opacity-40">•</span>
                               <span className="font-extrabold text-blue-700 dark:text-blue-200">{post.tag}</span>
                             </button>
                             <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                               <BookOpen className="w-3 h-3 text-indigo-400" />
                               <span>Academic Q&A</span>
                             </span>
                           </div>
                         )}

                         {/* Post Header */}
                         {(() => {
                            const isPostAnon = !post.username || post.username.toLowerCase() === 'anonymous';
                            return (
                              <div className="flex justify-between items-start mb-4">
                                 <div className="flex items-center gap-3.5">
                                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border border-white/10 flex-shrink-0 ${isPostAnon ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                                        {!isPostAnon && post.avatar ? (
                                            <img
                                              src={post.avatar}
                                              alt="Avatar"
                                              referrerPolicy="no-referrer"
                                              onError={handleImageError}
                                              className="w-full h-full rounded-2xl object-cover"
                                            />
                                        ) : isPostAnon ? (
                                            <UserX className="w-6 h-6 text-purple-400" />
                                        ) : (
                                            <User className="w-6 h-6 text-white" />
                                        )}
                                     </div>
                                     <div>
                                         <div className={`font-bold text-sm ${isPostAnon ? 'text-purple-600 dark:text-purple-400 font-extrabold flex items-center gap-1.5' : 'text-blue-600 dark:text-blue-300'}`}>
                                             {isPostAnon ? (
                                               <>
                                                 <span>Anonymous</span>
                                                 <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/15 border border-purple-500/20 uppercase tracking-widest font-bold">Ghost</span>
                                               </>
                                             ) : `@${post.username}`}
                                         </div>
                                         <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                             {new Date(post.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                                         </p>
                                     </div>
                                 </div>

                                 <div className="flex items-center gap-2">
                                     {post.username === user && (
                                        <button 
                                           onClick={() => setDeleteModal({ isOpen: true, type: 'confession', id: post.id })}
                                           className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                                           title="Delete Post"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                     )}
                                     {post.username !== user && (
                                         <button 
                                           onClick={() => setReportModal({ isOpen: true, confessionId: post.id })}
                                           className="p-2 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 transition"
                                           title="Report Post"
                                         >
                                             <AlertTriangle className="w-4 h-4" />
                                         </button>
                                     )}
                                 </div>
                              </div>
                            );
                         })()}

                         {/* Poll Card */}
                         {post.poll && (
                           <div className="mb-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-slate-900/40 border border-blue-500/20">
                             <div className="flex items-center gap-2 mb-3">
                               <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                                 <BarChart3 className="w-4 h-4" />
                               </span>
                               <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                 {post.poll.question}
                               </h4>
                             </div>

                             {(() => {
                               const userVote = votedPolls[post.id] || post.poll.voters?.[user];
                               const totalVotes = post.poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);

                               return (
                                 <div className="space-y-2">
                                   {post.poll.options.map((option) => {
                                     const hasVoted = Boolean(userVote);
                                     const isSelected = userVote === option.id;
                                     const percentage = totalVotes > 0 ? Math.round(((option.votes || 0) / totalVotes) * 100) : 0;

                                     return (
                                       <button
                                         key={option.id}
                                         type="button"
                                         disabled={hasVoted}
                                         onClick={() => handleVotePoll(post.id, option.id)}
                                         className={`w-full relative overflow-hidden rounded-xl p-3 text-left transition border text-xs sm:text-sm font-medium ${
                                           isSelected
                                             ? 'border-blue-500 bg-blue-500/20 text-blue-600 dark:text-blue-300'
                                             : hasVoted
                                             ? 'border-slate-200 dark:border-white/10 bg-slate-100/60 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                                             : 'border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:border-blue-500/50 hover:bg-blue-500/5 text-slate-800 dark:text-slate-200'
                                         }`}
                                       >
                                         {hasVoted && (
                                           <div
                                             className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                                               isSelected
                                                 ? 'bg-blue-500/25 dark:bg-blue-500/35'
                                                 : 'bg-slate-300/40 dark:bg-white/10'
                                             }`}
                                             style={{ width: `${percentage}%` }}
                                           />
                                         )}

                                         <div className="relative z-10 flex items-center justify-between gap-2">
                                           <span className="flex items-center gap-2 truncate">
                                             {isSelected && <span className="text-blue-500 font-bold">✓</span>}
                                             {option.text}
                                           </span>
                                           {hasVoted && (
                                             <span className="font-mono text-xs font-bold opacity-80 flex-shrink-0">
                                               {percentage}% ({option.votes || 0})
                                             </span>
                                           )}
                                         </div>
                                       </button>
                                     );
                                   })}

                                   <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 px-1">
                                     <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
                                     <span>{userVote ? 'Vote recorded anonymously' : 'Tap an option to vote'}</span>
                                   </div>
                                 </div>
                               );
                             })()}
                           </div>
                         )}

                         {/* Content */}
                         {post.text && (
                           <p className="text-slate-900 dark:text-slate-100 leading-relaxed text-base mb-4 font-medium whitespace-pre-wrap pl-1">
                               {post.text}
                           </p>
                         )}

                         {/* Attached Image */}
                         {post.image_url && (
                           <div
                             className="mb-5 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 group/img relative cursor-pointer max-w-md bg-slate-900/40"
                             onClick={() => setActiveLightboxImage(post.image_url!)}
                           >
                             <img
                               src={post.image_url}
                               alt="Post attachment"
                               loading="lazy"
                               referrerPolicy="no-referrer"
                               onError={handleImageError}
                               className="w-full max-h-80 object-cover group-hover/img:scale-[1.02] transition duration-300"
                             />
                             <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white flex items-center gap-1 opacity-80 group-hover/img:opacity-100 transition">
                               <Maximize2 className="w-3 h-3" />
                               <span>Expand</span>
                             </div>
                           </div>
                         )}

                   {/* Actions */}
                   <div className="flex items-center gap-4 border-t border-slate-200 dark:border-white/10 pt-4">
                      <button 
                        onClick={() => handleConfessionLike(post.id, post.likes)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition border ${
                            likedConfessions.has(post.id) 
                            ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                            : 'bg-slate-100 dark:bg-white/5 border-transparent text-slate-500 dark:text-slate-400 hover:bg-white/10 hover:text-red-400'
                        }`}
                      >
                          <Heart className={`w-4 h-4 ${likedConfessions.has(post.id) ? 'fill-current' : ''}`} />
                          {post.likes}
                      </button>

                      <button 
                        onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition border ${
                            expandedPostId === post.id
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                            : 'bg-slate-100 dark:bg-white/5 border-transparent text-slate-500 dark:text-slate-400 hover:bg-white/10 hover:text-blue-400'
                        }`}
                      >
                          <MessageCircle className="w-4 h-4" />
                          {post.replies.length} {post.replies.length === 1 ? 'Reply' : 'Replies'}
                          {expandedPostId === post.id ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                      </button>
                   </div>

                   {/* Replies Section */}
                   {expandedPostId === post.id && (
                       <div className="mt-6 pl-4 border-l-2 border-slate-200 dark:border-white/10 space-y-4 animate-fade-in">
                           {post.replies.map(reply => (
                               <div key={reply.id} className="bg-slate-50/50 dark:bg-black/20 rounded-2xl p-4 border border-slate-200 dark:border-white/5 backdrop-blur-sm">
                                   <div className="flex justify-between items-start mb-2">
                                       <div className="flex items-center gap-2">
                                            {/* Avatar for Reply */}
                                            {(() => {
                                              const isReplyUserAnon = !reply.username || reply.username.toLowerCase() === "anonymous";
                                              return (
                                                <>
                                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-inner border border-white/10 flex-shrink-0 ${isReplyUserAnon ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : "bg-gradient-to-br from-blue-500 to-purple-600"}`}>
                                                       {!isReplyUserAnon && reply.avatar ? (
                                                           <img
                                                             src={reply.avatar}
                                                             alt="Avatar"
                                                             referrerPolicy="no-referrer"
                                                             onError={handleImageError}
                                                             className="w-full h-full rounded-full object-cover"
                                                           />
                                                       ) : isReplyUserAnon ? (
                                                           <UserX className="w-4 h-4 text-purple-400" />
                                                       ) : (
                                                           <User className="w-4 h-4 text-white" />
                                                       )}
                                                  </div>

                                                  <div>
                                                      <div className="flex items-center gap-1.5">
                                                        <span className={`text-xs font-bold block ${isReplyUserAnon ? "text-purple-600 dark:text-purple-400 font-extrabold" : "text-blue-600 dark:text-blue-400"}`}>
                                                            {isReplyUserAnon ? "Anonymous" : `@${reply.username}`}
                                                        </span>
                                                        {post.isAskSenior && !isReplyUserAnon && (
                                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                            Senior Advice
                                                          </span>
                                                        )}
                                                      </div>
                                                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                          {new Date(reply.created_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
                                                      </span>
                                                  </div>
                                                </>
                                              );
                                            })()}
                                        </div>
                                        {reply.username === user && (
                                            <button 
                                                onClick={() => setDeleteModal({ isOpen: true, type: 'reply', id: reply.id, parentId: post.id })}
                                                className="text-slate-400 hover:text-red-500 transition"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                       )}
                                   </div>
                                   <p className="text-slate-800 dark:text-slate-300 text-sm mb-3 pl-10">{reply.text}</p>
                                   <div className="flex items-center gap-3 pl-10">
                                       <button 
                                            onClick={() => handleReplyLike(reply.id, post.id, reply.likes)}
                                            className={`flex items-center gap-1.5 text-xs font-bold transition ${
                                                likedReplies.has(reply.id)
                                                ? 'text-red-500'
                                                : 'text-slate-400 hover:text-red-400'
                                            }`}
                                       >
                                           <Heart className={`w-3 h-3 ${likedReplies.has(reply.id) ? 'fill-current' : ''}`} />
                                           {reply.likes}
                                       </button>
                                   </div>
                               </div>
                           ))}

                           {/* Reply Input */}
                           <div className="bg-white/40 dark:bg-white/5 rounded-3xl p-1.5 border border-white/20 dark:border-white/10 flex items-center gap-2 shadow-inner backdrop-blur-md">
                               <input 
                                    type="text" 
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder={post.isAskSenior ? "Share your advice or answer for this question..." : "Write a reply..."}
                                    className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 pl-3 py-2"
                               />
                               
                               {/* Reply Identity Segmented Control */}
                               <div className="flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-white/10 border border-slate-300/40 dark:border-white/10">
                                    <button
                                      type="button"
                                      onClick={() => setIsReplyAnon(true)}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                                        isReplyAnon
                                          ? "bg-purple-600 text-white shadow-sm"
                                          : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                      }`}
                                      title="Reply anonymously (name hidden)"
                                    >
                                      <UserX className="w-3 h-3" />
                                      <span>Anon</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setIsReplyAnon(false)}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                                        !isReplyAnon
                                          ? "bg-blue-600 text-white shadow-sm"
                                          : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                      }`}
                                      title={`Reply publicly as @${user}`}
                                    >
                                      <User className="w-3 h-3" />
                                      <span>Me</span>
                                    </button>
                               </div>

                               <button 
                                    onClick={() => postReply(post.id)}
                                    disabled={!replyText.trim() || isReplying}
                                    className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition shadow-md disabled:opacity-50"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                           </div>
                       </div>
                   )}
                </div>
             ))
          )}
       </div>
       );
       })()}

       {/* Delete Confirmation Modal */}
       {deleteModal.isOpen && (
           <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
               <div className="glass-heavy border border-white/20 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-center">
                   <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                       <Trash2 className="w-8 h-8 text-red-500" />
                   </div>
                   <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete {deleteModal.type}?</h3>
                   <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">This action cannot be undone.</p>
                   
                   <div className="flex gap-3">
                       <button 
                        onClick={() => setDeleteModal({ isOpen: false, type: 'confession', id: '' })}
                        className="flex-1 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition"
                       >
                           Cancel
                       </button>
                       <button 
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition shadow-lg shadow-red-500/20"
                       >
                           {isDeleting ? 'Deleting...' : 'Delete'}
                       </button>
                   </div>
               </div>
           </div>
       )}

       {/* Report Modal */}
       {reportModal.isOpen && (
           <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
               <div className="glass-heavy border border-white/20 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                           <Flag className="w-5 h-5 text-orange-500" /> Report Post
                       </h3>
                       <button onClick={() => setReportModal({isOpen: false, confessionId: ''})} className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
                           <X className="w-5 h-5" />
                       </button>
                   </div>
                   
                   <div className="space-y-3 mb-6">
                       {['Harassment or Bullying', 'Spam or Misleading', 'Inappropriate Content', 'Hate Speech', 'Other'].map(reason => (
                           <label key={reason} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:border-blue-500/30 transition">
                               <input 
                                    type="radio" 
                                    name="reportReason" 
                                    value={reason} 
                                    checked={reportReason === reason}
                                    onChange={(e) => setReportReason(e.target.value)}
                                    className="text-blue-600 focus:ring-blue-500 bg-slate-200 dark:bg-slate-700 border-slate-400"
                               />
                               <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{reason}</span>
                           </label>
                       ))}
                   </div>

                   <button 
                        onClick={submitReport}
                        disabled={!reportReason || isReporting}
                        className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition shadow-lg shadow-orange-500/20 flex justify-center items-center gap-2"
                   >
                       {isReporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Report'}
                   </button>
               </div>
           </div>
       )}

       {/* Image Lightbox Modal */}
       {activeLightboxImage && (
         <div
           className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
           onClick={() => setActiveLightboxImage(null)}
         >
           <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
             <div className="absolute -top-12 right-0 flex items-center gap-2">
               <a
                 href={activeLightboxImage}
                 target="_blank"
                 rel="noreferrer"
                 className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition flex items-center gap-1.5"
               >
                 <ExternalLink className="w-3.5 h-3.5" /> Open Full
               </a>
               <button
                 type="button"
                 onClick={() => setActiveLightboxImage(null)}
                 className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition"
                 aria-label="Close image preview"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>
             <img
               src={activeLightboxImage}
               alt="Full size view"
               referrerPolicy="no-referrer"
               onError={handleImageError}
               className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
             />
           </div>
         </div>
       )}
    </div>
  );
};

export default Social;
