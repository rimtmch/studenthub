
import React, { useState, useEffect } from 'react';
import { MessageCircle, Heart, Loader2, Send, ChevronDown, ChevronUp, Trash2, AlertTriangle, X, User, Flag, Check } from 'lucide-react';
import { Confession } from '../types';
import { supabase, getErrorMessage } from '../services/supabaseClient';

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

  const fetchConfessions = async () => {
      // 1. Fetch Confessions and Replies
      const { data, error } = await supabase
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
          
          let avatarMap: Record<string, string> = {};

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

          const formattedData = data.map((post: any) => ({
              ...post,
              id: String(post.id),
              likes: post.likes || 0,
              replies: post.replies ? post.replies.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((r:any) => ({
                  ...r,
                  id: String(r.id),
                  likes: r.likes || 0,
                  avatar: r.username === 'Anonymous' ? null : avatarMap[r.username]
              })) : [],
              avatar: post.username === 'Anonymous' ? null : avatarMap[post.username]
          }));
          setConfessions(formattedData as Confession[]);

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
      setLoading(false);
  };

  useEffect(() => {
      fetchConfessions();
      const interval = setInterval(fetchConfessions, 15000);
      return () => clearInterval(interval);
  }, [user]);

  const postConfession = async () => {
    if(!text.trim() || posting) return;
    setPosting(true);
    
    const { error } = await supabase.from('confessions').insert([{
        text: text,
        username: isAnon ? 'Anonymous' : user,
        likes: 0
    }]);

    if (!error) {
        setText('');
        // Trigger fetch to get the new ID from DB
        fetchConfessions();
    } else {
        alert("Failed to post");
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
       <div className="mb-6">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
             <span className="p-2 bg-blue-500/20 rounded-2xl border border-blue-500/30 text-blue-600 dark:text-blue-400 backdrop-blur-md">
                <MessageCircle className="w-6 h-6" />
             </span>
             The Chill Zone
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 ml-1 font-medium">Anonymous confessions & chats</p>
       </div>

       {/* Post Box */}
       <div className="glass rounded-[2.5rem] p-6 mb-8 border border-white/20 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-blue-500/20 transition duration-700"></div>
          
          <textarea
             value={text}
             onChange={(e) => setText(e.target.value)}
             className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-3xl p-5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/50 dark:focus:bg-black/40 transition resize-none text-base shadow-inner leading-relaxed"
             rows={3}
             placeholder="What's on your mind? (Be nice!)"
          />
          
          <div className="flex justify-between items-center mt-4">
              <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-white/5 px-4 py-2 rounded-2xl border border-slate-200 dark:border-white/10 backdrop-blur-md">
                  <span className={`text-xs font-bold ${isAnon ? 'text-slate-500 dark:text-slate-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {isAnon ? 'Anonymous' : `@${user}`}
                  </span>
                  <div 
                    onClick={() => setIsAnon(!isAnon)}
                    className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ${isAnon ? 'bg-slate-300 dark:bg-slate-700' : 'bg-blue-600'}`}
                  >
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transform duration-300 ${isAnon ? '' : 'translate-x-4'}`}></div>
                  </div>
              </div>

              <button 
                onClick={postConfession}
                disabled={!text.trim() || posting}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
              >
                 {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                 Post
              </button>
          </div>
       </div>

       {/* Feed */}
       <div className="space-y-6">
          {loading ? (
             <div className="text-center py-20 flex flex-col items-center gap-4">
                 <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-white/10 border-t-blue-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-blue-500" />
                    </div>
                 </div>
                 <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Loading confessions...</p>
             </div>
          ) : (
             confessions.map(post => (
                <div key={post.id} className="glass rounded-[2.5rem] p-6 border border-white/20 shadow-lg hover:border-white/30 transition duration-300 animate-slide-up">
                   
                   {/* Post Header */}
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border border-white/10 flex-shrink-0 ${post.username === 'Anonymous' ? 'bg-slate-200 dark:bg-slate-800' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                             {post.avatar ? (
                                 <img src={post.avatar} alt="Avatar" className="w-full h-full rounded-2xl object-cover" />
                             ) : (
                                 <User className={`w-6 h-6 ${post.username === 'Anonymous' ? 'text-slate-500' : 'text-white'}`} />
                             )}
                          </div>
                          <div>
                              <p className={`font-bold text-sm ${post.username === 'Anonymous' ? 'text-slate-500 dark:text-slate-400' : 'text-blue-600 dark:text-blue-300'}`}>
                                  {post.username === 'Anonymous' ? 'Anonymous' : `@${post.username}`}
                              </p>
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

                   {/* Content */}
                   <p className="text-slate-900 dark:text-slate-100 leading-relaxed text-base mb-6 font-medium whitespace-pre-wrap pl-1">
                       {post.text}
                   </p>

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
                                           <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-inner border border-white/10 flex-shrink-0 ${reply.username === 'Anonymous' ? 'bg-slate-200 dark:bg-slate-800' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                                                {reply.avatar ? (
                                                    <img src={reply.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    <User className={`w-4 h-4 ${reply.username === 'Anonymous' ? 'text-slate-500' : 'text-white'}`} />
                                                )}
                                           </div>

                                           <div>
                                               <span className={`text-xs font-bold block ${reply.username === 'Anonymous' ? 'text-slate-500 dark:text-slate-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                   {reply.username === 'Anonymous' ? 'Anonymous' : `@${reply.username}`}
                                               </span>
                                               <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                   {new Date(reply.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                               </span>
                                           </div>
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
                                    placeholder="Write a reply..."
                                    className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 pl-3 py-2"
                               />
                               
                               {/* Reply Identity Toggle */}
                               <div 
                                    onClick={() => setIsReplyAnon(!isReplyAnon)}
                                    className={`h-6 px-2 rounded-full flex items-center gap-1 cursor-pointer transition-colors duration-300 border border-white/10 ${isReplyAnon ? 'bg-slate-200 dark:bg-slate-700' : 'bg-blue-600/20'}`}
                                    title={isReplyAnon ? "Replying Anonymously" : `Replying as @${user}`}
                                >
                                    <div className={`w-2 h-2 rounded-full transition-colors ${isReplyAnon ? 'bg-slate-500' : 'bg-blue-500'}`}></div>
                                    <span className={`text-[10px] font-bold ${isReplyAnon ? 'text-slate-600 dark:text-slate-400' : 'text-blue-600 dark:text-blue-300'}`}>
                                        {isReplyAnon ? 'Anon' : 'Me'}
                                    </span>
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
    </div>
  );
};

export default Social;
