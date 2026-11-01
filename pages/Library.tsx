import React, { useState, useEffect, useCallback } from 'react';
import { Search, Book as BookIcon, Filter, RefreshCw, ExternalLink, Bookmark, ChevronDown, X, ZoomIn, ZoomOut, RotateCcw, Eye } from 'lucide-react';
import { Book } from '../types';
import { supabase } from '../services/supabaseClient';

interface LibraryProps {
  username?: string;
}

const Library: React.FC<LibraryProps> = ({ username }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'bookmarks'>('all');
  const [bookmarks, setBookmarks] = useState<Book[]>([]);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com/file/d/')) {
      return url.replace(/\/view(\?.*)?$/, '/preview');
    }
    return url;
  };

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('books').select('*');
      if (data) {
        setBooks(data);
      } else if (error) {
        console.warn('Error fetching books:', error);
      }
    } catch (e) {
      console.warn('fetchBooks failed gracefully:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBookmarks = useCallback(async () => {
    if (!username) return;
    try {
      const { data, error } = await supabase
        .from('user_bookmarks')
        .select('book_data')
        .ilike('username', username);

      if (data) {
        setBookmarks(data.map((item) => item.book_data as Book));
      } else if (error) {
        console.warn('Error fetching bookmarks:', error);
      }
    } catch (e) {
      console.warn('fetchBookmarks failed gracefully:', e);
    }
  }, [username]);

  useEffect(() => {
    fetchBooks();
    fetchBookmarks();
  }, [fetchBooks, fetchBookmarks]);

  const toggleBookmark = async (book: Book) => {
    if (!username) return;

    const isCurrentlyBookmarked = bookmarks.some(
      (b) => b.title === book.title && b.author === book.author
    );

    try {
      if (isCurrentlyBookmarked) {
        setBookmarks((prev) =>
          prev.filter((b) => !(b.title === book.title && b.author === book.author))
        );
        await supabase
          .from('user_bookmarks')
          .delete()
          .ilike('username', username)
          .contains('book_data', { title: book.title, author: book.author });
      } else {
        setBookmarks((prev) => [...prev, book]);
        await supabase
          .from('user_bookmarks')
          .insert({ username: username.toLowerCase(), book_data: book });
      }
    } catch (e) {
      console.warn('toggleBookmark failed gracefully:', e);
    }
  };

  const isBookmarked = (book: Book) => {
    return bookmarks.some((b) => b.title === book.title && b.author === book.author);
  };

  const subjects = ['All', ...Array.from(new Set(books.map((b) => b.subject).filter(Boolean))).sort()];

  const activeBooksList = activeTab === 'all' ? books : bookmarks;

  const filteredBooks = activeBooksList.filter((b) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      b.title.toLowerCase().includes(term) ||
      (b.subject && b.subject.toLowerCase().includes(term)) ||
      (b.author && b.author.toLowerCase().includes(term));
    const matchesSubject = selectedSubject === 'All' || b.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Digital Library
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Medical references, notes &amp; syllabus guides
            </span>
            <span className="w-1 h-1 bg-slate-300 dark:bg-white/20 rounded-full" />
            <span className="text-xs text-blue-600 dark:text-blue-300 font-bold bg-blue-100/80 dark:bg-blue-500/10 border border-blue-500/15 rounded-md px-1.5 py-0.5">
              {filteredBooks.length} {filteredBooks.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100/80 dark:bg-slate-900/40 p-1 rounded-2xl border border-slate-200 dark:border-white/10 backdrop-blur-md self-start md:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs transition duration-200 flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookIcon className="w-3.5 h-3.5" />
            Browse Materials
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bookmarks')}
            className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs transition duration-200 flex items-center gap-2 relative ${
              activeTab === 'bookmarks'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            My Bookmarks
            {bookmarks.length > 0 && (
              <span className="flex items-center justify-center bg-rose-500 text-white text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full font-bold ml-1 animate-fade-in shadow-sm">
                {bookmarks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="glass rounded-[1.75rem] sm:rounded-[2rem] p-4 sm:p-6 mb-6 sm:mb-8 border border-white/10 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-focus-within:text-blue-500 transition" />
            <input
              type="text"
              placeholder="Search books, authors, subjects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl py-3 sm:py-3.5 pl-11 pr-4 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 transition shadow-inner placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="relative w-full sm:w-72">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              aria-label="Filter by subject"
              className="w-full bg-slate-100/70 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl py-3 sm:py-3.5 pl-11 pr-10 text-slate-900 dark:text-slate-200 appearance-none focus:outline-none focus:border-blue-500/50 cursor-pointer transition text-xs sm:text-sm shadow-inner"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All Subjects' : s}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        {loading && (
          <div className="col-span-full text-center text-slate-500 py-16 sm:py-20 flex flex-col items-center gap-3 glass rounded-3xl">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <p className="animate-pulse text-sm">Accessing library database...</p>
          </div>
        )}

        {!loading &&
          filteredBooks.map((book, idx) => (
            <div
              key={idx}
              className="glass rounded-3xl p-4 sm:p-5 border border-white/10 flex gap-4 items-start group hover:border-white/20 transition hover:shadow-2xl hover:-translate-y-0.5 duration-300"
            >
              <div className="w-14 h-18 sm:w-16 sm:h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center flex-shrink-0 border border-slate-300/40 dark:border-white/5 group-hover:bg-blue-100 dark:group-hover:bg-blue-600/20 group-hover:border-blue-500/30 transition shadow-inner">
                <BookIcon className="w-7 h-7 sm:w-8 sm:h-8 text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition" />
              </div>

              <div className="flex-1 min-w-0 flex flex-col h-full justify-between py-0.5">
                <div>
                  <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-1 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-300 transition line-clamp-2">
                    {book.title}
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-2.5 truncate font-medium">
                    {book.author}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {book.year && (
                    <span className="text-[10px] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-lg">
                      {book.year}
                    </span>
                  )}
                  {book.subject && (
                    <span className="text-[10px] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-lg truncate max-w-[130px]">
                      {book.subject}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-shrink-0 self-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark(book);
                  }}
                  aria-label={isBookmarked(book) ? 'Remove bookmark' : 'Bookmark book'}
                  className={`p-2.5 sm:p-3 rounded-2xl transition duration-200 border ${
                    isBookmarked(book)
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/15 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
                  }`}
                  title={isBookmarked(book) ? 'Unbookmark' : 'Bookmark'}
                >
                  <Bookmark
                    className={`w-4 h-4 transition ${
                      isBookmarked(book)
                        ? 'fill-rose-500 stroke-rose-500 text-rose-500'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                </button>

                {book.link && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewingBook(book);
                      setZoomLevel(100);
                    }}
                    aria-label={`Read ${book.title} in app`}
                    className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 p-2.5 sm:p-3 rounded-2xl transition border border-blue-500/20"
                    title="Read in-app"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}

                <a
                  href={book.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open link for ${book.title}`}
                  className={`bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 p-2.5 sm:p-3 rounded-2xl transition border border-slate-200 dark:border-white/10 active:scale-95 ${
                    !book.link ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                  }`}
                  title="Open external link"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}

        {!loading && activeTab === 'bookmarks' && bookmarks.length === 0 && (
          <div className="col-span-full text-center py-16 sm:py-20 px-6 sm:px-8 glass rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500">
              <Bookmark className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <p className="text-slate-900 dark:text-white font-bold text-base sm:text-lg mb-1">No Bookmarks Saved Yet</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-sm mb-5">
              Save materials you want to access quickly. Click the bookmark icon on any item to store it here.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className="text-white bg-blue-600 px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl hover:bg-blue-500 active:scale-95 transition shadow-lg shadow-blue-500/20 font-semibold text-xs sm:text-sm"
            >
              Browse Digital Library
            </button>
          </div>
        )}

        {!loading && filteredBooks.length === 0 && (activeTab !== 'bookmarks' || bookmarks.length > 0) && (
          <div className="col-span-full text-center py-16 sm:py-20 glass rounded-[2.5rem] border border-white/10 px-4">
            <p className="text-slate-900 dark:text-slate-300 font-bold text-base sm:text-lg mb-1">No items found</p>
            <p className="text-slate-500 text-xs sm:text-sm mb-5">Try adjusting your search or filter.</p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedSubject('All');
              }}
              className="text-white bg-slate-800 px-5 py-2.5 rounded-2xl hover:bg-slate-700 transition border border-white/10 text-xs sm:text-sm font-semibold"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* In-App PDF / Document Viewer Modal */}
      {viewingBook && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col p-2 sm:p-4 md:p-6 animate-fade-in">
          <div className="glass rounded-3xl border border-white/10 flex flex-col h-full overflow-hidden shadow-2xl bg-slate-900/90">
            {/* Viewer Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-slate-900/90">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="text-white font-bold text-sm sm:text-base truncate">
                  {viewingBook.title}
                </h3>
                <p className="text-slate-400 text-xs truncate">
                  {viewingBook.author} {viewingBook.subject ? `• ${viewingBook.subject}` : ''}
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="hidden sm:flex items-center bg-slate-800/80 rounded-xl p-1 border border-white/10 text-xs text-slate-300">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                    className="p-1.5 hover:text-white rounded-lg hover:bg-white/10 transition"
                    title="Zoom out"
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-mono text-[11px]">{zoomLevel}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                    className="p-1.5 hover:text-white rounded-lg hover:bg-white/10 transition"
                    title="Zoom in"
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(100)}
                    className="p-1.5 hover:text-white rounded-lg hover:bg-white/10 transition ml-1"
                    title="Reset Zoom"
                    aria-label="Reset zoom"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>

                <a
                  href={viewingBook.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition"
                  title="Open original link"
                  aria-label="Open original link"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={() => setViewingBook(null)}
                  className="p-2 sm:p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                  title="Close viewer"
                  aria-label="Close viewer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 bg-slate-950/70 overflow-auto flex items-center justify-center p-1 sm:p-3 relative">
              <div
                className="w-full h-full transition-transform duration-150 origin-top flex items-center justify-center"
                style={{ transform: `scale(${zoomLevel / 100})` }}
              >
                <iframe
                  src={getEmbedUrl(viewingBook.link || '')}
                  title={viewingBook.title}
                  className="w-full h-full rounded-2xl border-0 bg-white"
                  allow="autoplay; fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;
