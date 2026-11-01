import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Plus,
  MapPin,
  Calendar,
  MessageCircle,
  CheckCircle2,
  Trash2,
  X,
  Image as ImageIcon,
  Loader2,
  Tag,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { UserProfile, LostFoundItem } from '../types';
import { supabase, getErrorMessage } from '../services/supabaseClient';
import { getDirectImageUrl, uploadImageFile, handleImageError } from '../services/imageStorage';

interface LostAndFoundProps {
  user?: UserProfile;
}

const LOCAL_STORAGE_KEY = 'rmch_lost_found_items';

const LostAndFound: React.FC<LostAndFoundProps> = ({ user }) => {
  const [items, setItems] = useState<LostFoundItem[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      return !cached;
    } catch {
      return true;
    }
  });
  const [activeTab, setActiveTab] = useState<'all' | 'lost' | 'found' | 'my-posts'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeLightbox, setActiveLightbox] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [location, setLocation] = useState('');
  const [itemDate, setItemDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async () => {
    try {
      const fetchPromise = supabase
        .from('lost_and_found')
        .select('*')
        .order('created_at', { ascending: false });

      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Timeout' } }), 4000)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!error && data) {
        setItems(data as LostFoundItem[]);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      } else {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          try {
            setItems(JSON.parse(cached));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        try {
          setItems(JSON.parse(cached));
        } catch {
          // ignore
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setIsUploadingImage(true);
        const { url } = await uploadImageFile(file, `lost_found_${user?.username || 'item'}`, 2560, 0.92);
        setImagePreview(url);
      } catch (err) {
        console.error('Failed to upload image:', err);
        setFormError('Failed to process image');
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Please enter an item title');
      return;
    }
    if (!location.trim()) {
      setFormError('Please enter campus location (e.g. Library 2nd floor, Lecture Hall 3)');
      return;
    }
    if (!description.trim()) {
      setFormError('Please add a brief description');
      return;
    }

    setSubmitting(true);
    try {
      const finalImageUrl = imagePreview || null;

      const newItemPayload = {
        title: title.trim(),
        description: description.trim(),
        type,
        location: location.trim(),
        item_date: itemDate,
        image_url: finalImageUrl || null,
        contact_phone: user?.phone || '',
        contact_name: user?.fullname || user?.username || 'Student',
        posted_by: user?.username || 'Student',
        status: 'open' as const,
      };

      const { data, error } = await supabase
        .from('lost_and_found')
        .insert([newItemPayload])
        .select();

      if (!error && data && data[0]) {
        setItems((prev) => [data[0] as LostFoundItem, ...prev]);
      } else {
        // Optimistic local fallback if table is waiting for SQL migration
        const localItem: LostFoundItem = {
          ...newItemPayload,
          id: `local_${Date.now()}`,
          image_url: finalImageUrl,
          created_at: new Date().toISOString(),
        };
        const updated = [localItem, ...items];
        setItems(updated);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      }

      // Reset and close
      setTitle('');
      setLocation('');
      setDescription('');
      setImagePreview('');
      setShowModal(false);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: LostFoundItem) => {
    const nextStatus: 'open' | 'resolved' = item.status === 'open' ? 'resolved' : 'open';
    const updated = items.map((i) =>
      String(i.id) === String(item.id) ? { ...i, status: nextStatus } : i
    );
    setItems(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    try {
      const targetId = String(item.id);
      if (!targetId.startsWith('local_')) {
        const numericId = parseInt(targetId, 10);
        await supabase
          .from('lost_and_found')
          .update({ status: nextStatus })
          .eq('id', isNaN(numericId) ? targetId : numericId);
      }
    } catch {
      // ignore
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemId) return;
    setIsDeleting(true);
    const targetId = String(deleteItemId);

    // 1. Immediately update UI state
    const updated = items.filter((i) => String(i.id) !== targetId);
    setItems(updated);

    // 2. Persist to localStorage so item is permanently removed
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    // 3. Delete from Supabase if not a local-only fallback
    try {
      if (!targetId.startsWith('local_')) {
        const numericId = parseInt(targetId, 10);
        await supabase
          .from('lost_and_found')
          .delete()
          .eq('id', isNaN(numericId) ? targetId : numericId);
      }
    } catch (err) {
      console.warn('Failed to delete item from database:', err);
    } finally {
      setIsDeleting(false);
      setDeleteItemId(null);
    }
  };

  const getWhatsAppLink = (item: LostFoundItem) => {
    const phone = item.contact_phone?.replace(/\D/g, '');
    if (!phone) return null;
    const fullPhone = phone.length === 10 ? `91${phone}` : phone;
    const contactName = item.contact_name || 'there';
    const itemType = (item.type || 'lost').toUpperCase();
    const itemTitle = item.title || 'item';
    const msg = `Hi ${contactName}, regarding the ${itemType} item "${itemTitle}" you posted on RMCH Hub:`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  };

  const currentUsername = user?.username || '';

  const filteredItems = (Array.isArray(items) ? items : []).filter((item) => {
    if (!item) return false;
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      (item.title || '').toLowerCase().includes(term) ||
      (item.description || '').toLowerCase().includes(term) ||
      (item.location || '').toLowerCase().includes(term);

    if (!matchSearch) return false;

    if (activeTab === 'lost') return item.type === 'lost';
    if (activeTab === 'found') return item.type === 'found';
    if (activeTab === 'my-posts') return item.posted_by === currentUsername;
    return true;
  });

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-600 dark:text-blue-400">
              <Tag className="w-6 h-6" />
            </span>
            Campus Lost &amp; Found
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            Report misplaced belongings or help return found items on the RMCH campus.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/20 active:scale-95 border border-white/10 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Post Item
        </button>
      </div>

      {/* Tabs and Search Bar */}
      <div className="glass rounded-[2rem] p-4 sm:p-5 mb-6 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition" />
            <input
              type="text"
              placeholder="Search by item name, location (e.g. Stethoscope, Library, Mess)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl py-2.5 sm:py-3 pl-11 pr-9 text-xs sm:text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 transition shadow-inner placeholder-slate-400 dark:placeholder-slate-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl font-semibold transition whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lost')}
              className={`px-3.5 py-2 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'lost'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Lost
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('found')}
              className={`px-3.5 py-2 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'found'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Found
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('my-posts')}
              className={`px-3.5 py-2 rounded-xl font-semibold transition whitespace-nowrap ${
                activeTab === 'my-posts'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              My Posts
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Items */}
      {loading ? (
        <div className="text-center py-20 glass rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-xs sm:text-sm text-slate-400">Loading campus records...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="glass rounded-[2.5rem] p-12 text-center border border-white/10">
          <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-50" />
          <h4 className="text-slate-900 dark:text-white font-bold text-base sm:text-lg mb-1">
            No items found
          </h4>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-sm mx-auto mb-5">
            {searchTerm
              ? 'Try searching with different keywords or clearing your filter.'
              : 'No items reported in this category yet.'}
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-900/20"
          >
            Report an Item
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isOwner = Boolean(
              currentUsername &&
              item.posted_by &&
              (
                item.posted_by.toLowerCase() === currentUsername.toLowerCase() ||
                item.posted_by === 'Student' ||
                (user?.fullname && item.posted_by.toLowerCase() === user.fullname.toLowerCase())
              )
            );
            const waLink = getWhatsAppLink(item);
            const isLost = item.type === 'lost';
            const displayImg = getDirectImageUrl(item.image_url);

            return (
              <div
                key={item.id}
                className="glass rounded-3xl overflow-hidden border border-white/10 flex flex-col justify-between group hover:border-white/20 transition hover:shadow-2xl duration-300"
              >
                <div>
                  {/* Photo Thumbnail */}
                  {displayImg ? (
                    <div
                      onClick={() => setActiveLightbox(displayImg)}
                      className="relative h-44 sm:h-48 w-full bg-slate-900 cursor-pointer overflow-hidden group/img"
                    >
                      <img
                        src={displayImg}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover/img:scale-105 transition duration-500"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const prevSrc = target.src;
                          handleImageError(e);
                          if (target.src === prevSrc) {
                            target.style.display = 'none';
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold backdrop-blur-sm">
                        Tap to expand
                      </div>
                    </div>
                  ) : (
                    <div className="h-28 w-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800/60 dark:to-slate-900/80 flex items-center justify-center text-slate-400 border-b border-white/5">
                      <Tag className="w-8 h-8 opacity-40" />
                    </div>
                  )}

                  <div className="p-4 sm:p-5">
                    {/* Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border tracking-wider ${
                          isLost
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {isLost ? 'Lost Item' : 'Found Item'}
                      </span>

                      {item.status === 'resolved' ? (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-white/5 px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Resolved
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                          Active
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1.5 leading-snug group-hover:text-blue-500 transition line-clamp-1">
                      {item.title}
                    </h3>

                    {/* Description */}
                    <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed line-clamp-3 mb-4">
                      {item.description}
                    </p>

                    {/* Metadata */}
                    <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-white/5 pt-3">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                        <span>Date: {item.item_date}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-0.5">
                        Reported by @{item.posted_by}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-4 sm:p-5 pt-0 flex items-center justify-between gap-2">
                  {waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm shadow-emerald-900/20 active:scale-95"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No contact phone</span>
                  )}

                  {isOwner && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                          item.status === 'open'
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/20'
                            : 'bg-slate-200 dark:bg-white/5 text-slate-400 border-white/5'
                        }`}
                        title={item.status === 'open' ? 'Mark Resolved' : 'Reopen item'}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteItemId(item.id)}
                        className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition"
                        title="Delete post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Post New Item Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="glass rounded-[2rem] border border-white/20 p-5 sm:p-7 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl bg-slate-900/90 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-400" /> Report Lost or Found Item
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-4 text-xs sm:text-sm">
              {/* Type Selector */}
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                  Report Type *
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-1 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setType('lost')}
                    className={`py-2 rounded-xl font-bold transition ${
                      type === 'lost' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400'
                    }`}
                  >
                    I Lost an Item
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('found')}
                    className={`py-2 rounded-xl font-bold transition ${
                      type === 'found' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400'
                    }`}
                  >
                    I Found an Item
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Item Name / Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Black iPhone 13, Littmann Stethoscope, Student ID card..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800/70 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>

              {/* Campus Location & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                    Campus Location *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Library 2nd Floor, OPD 4"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-800/70 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={itemDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setItemDate(e.target.value)}
                    className="w-full bg-slate-800/70 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Detailed Description *
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe color, markings, key features, or where to collect..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800/70 border border-white/10 rounded-xl p-3 text-white placeholder-slate-500 outline-none focus:border-blue-500 resize-none leading-relaxed"
                />
              </div>

              {/* Photo Options: File Upload or Google Drive Public Link */}
              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-white/10 space-y-3">
                <label className="block text-[11px] text-slate-300 uppercase font-bold tracking-wider flex items-center justify-between">
                  <span>Attach Photo (Optional)</span>
                  <span className="text-[10px] text-blue-400 lowercase font-normal">Auto-compressed</span>
                </label>

                {imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden h-36 bg-slate-900 border border-white/10">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImagePreview('')}
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-white font-medium flex items-center justify-center gap-2 border border-white/10 transition disabled:opacity-50"
                    >
                      {isUploadingImage ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          <span>Uploading photo...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-4 h-4 text-blue-400" />
                          <span>Choose Photo</span>
                        </>
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImagePick}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish to RMCH Campus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightbox && (
        <div
          onClick={() => setActiveLightbox(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={activeLightbox}
              alt="Enlarged view"
              referrerPolicy="no-referrer"
              onError={handleImageError}
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setActiveLightbox(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteItemId && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-heavy border border-white/20 p-6 sm:p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
              <Trash2 className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">Delete this post?</h3>
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mb-6 leading-relaxed">
              This item will be permanently removed from Campus Lost &amp; Found.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteItemId(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs sm:text-sm transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteItem}
                disabled={isDeleting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs sm:text-sm transition shadow-lg shadow-rose-500/20 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LostAndFound;
