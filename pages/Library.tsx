import React, { useState, useEffect } from 'react';
import { Search, Book as BookIcon, Filter, RefreshCw, ExternalLink, Bookmark } from 'lucide-react';
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

  useEffect(() => {
      const fetchBooks = async () => {
          setLoading(true);
          try {
              const { data, error } = await supabase.from('books').select('*');
              if(data) {
                  setBooks(data);
              } else {
                  console.error("Error fetching books", error);
              }
          } catch (e) {
              console.error("fetchBooks failed gracefully:", e);
          }
          setLoading(false);
      };
      
      const fetchBookmarks = async () => {
          if (!username) return;
          try {
              const { data, error } = await supabase
                  .from('user_bookmarks')
                  .select('book_data')
                  .eq('username', username);
                  
              if (data) {
                  setBookmarks(data.map(item => item.book_data as Book));
              } else {
                  console.error("Error fetching bookmarks", error);
              }
          } catch (e) {
              console.error("fetchBookmarks failed gracefully:", e);
          }
      };

      fetchBooks();
      fetchBookmarks();
  }, [username]);

  const toggleBookmark = async (book: Book) => {
      if (!username) return;
      
      const isCurrentlyBookmarked = bookmarks.some(b => b.title === book.title && b.author === book.author);
      let updated: Book[];
      
      try {
          if (isCurrentlyBookmarked) {
              // Remove bookmark locally
              updated = bookmarks.filter(b => !(b.title === book.title && b.author === book.author));
              setBookmarks(updated);
              
              // Remove from Supabase
              await supabase
                  .from('user_bookmarks')
                  .delete()
                  .eq('username', username)
                  .contains('book_data', { title: book.title, author: book.author });
          } else {
              // Add bookmark locally
              updated = [...bookmarks, book];
              setBookmarks(updated);
              
              // Add to Supabase
              await supabase
                  .from('user_bookmarks')
                  .insert({ username: username, book_data: book });
          }
      } catch (e) {
          console.error("toggleBookmark failed gracefully:", e);
      }
  };

  const isBookmarked = (book: Book) => {
      return bookmarks.some(b => b.title === book.title && b.author === book.author);
  };

  const subjects = ['All', ...Array.from(new Set(books.map(b => b.subject).filter(Boolean))).sort()];

  const activeBooksList = activeTab === 'all' ? books : bookmarks;

  const filteredBooks = activeBooksList.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'All' || b.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Digital Library</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium font-sans">Access course keys, papers and links</span>
            <span className="w-1 h-1 bg-slate-305 dark:bg-white/10 rounded-full"></span>
            <span className="text-xs text-blue-600 dark:text-blue-300 font-bold bg-blue-100/80 dark:bg-blue-500/10 border border-blue-500/15 rounded-md px-1.5 py-0.5">
              {filteredBooks.length} {filteredBooks.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-905/30 p-1 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-md self-start md:self-auto shadow-inner">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition duration-300 flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <BookIcon className="w-3.5 h-3.5" />
            Browse Materials
          </button>
          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition duration-300 flex items-center gap-2 relative ${
              activeTab === 'bookmarks'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            My Bookmarks
            {bookmarks.length > 0 && (
              <span className="flex items-center justify-center bg-rose-500 text-white text-[10px] w-5 h-5 rounded-full font-bold ml-1 animate-fade-in shadow-md">
                {bookmarks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="glass rounded-[2rem] p-6 mb-8 border border-white/5 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition" />
                <input 
                    type="text" 
                    placeholder="Search books, authors..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 focus:bg-slate-200 dark:focus:bg-slate-900/80 transition shadow-inner placeholder-slate-400 dark:placeholder-slate-600"
                />
            </div>

            <div className="relative w-full sm:w-72">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10" />
                <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-10 text-slate-900 dark:text-slate-200 appearance-none focus:outline-none focus:border-blue-500/50 focus:bg-slate-200 dark:focus:bg-slate-900/80 cursor-pointer transition text-sm shadow-inner"
                >
                    {subjects.map(s => <option key={s} value={s}>{s === 'All' ? 'All Subjects' : s}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <ChevronDownIcon className="w-4 h-4" />
                </div>
            </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-2">
        {loading && (
            <div className="col-span-full text-center text-slate-500 py-20 flex flex-col items-center gap-3 glass rounded-3xl">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <p className="animate-pulse">Accessing library database...</p>
            </div>
        )}
        
        {!loading && filteredBooks.map((book, idx) => (
            <div key={idx} className="glass rounded-3xl p-4 border border-white/5 flex gap-4 items-start group hover:border-white/10 transition cursor-pointer hover:shadow-2xl hover:-translate-y-1 duration-300">
                <div className="w-16 h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/5 group-hover:bg-blue-100 dark:group-hover:bg-blue-600/20 group-hover:border-blue-500/30 transition shadow-inner">
                    <BookIcon className="w-8 h-8 text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition" />
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col h-full justify-between py-1">
                    <div>
                        <h4 className="text-slate-900 dark:text-white font-bold text-sm mb-1 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-300 transition line-clamp-2">
                            {book.title}
                        </h4>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mb-3 truncate font-medium">{book.author}</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-auto">
                        {book.year && (
                            <span className="text-[10px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg">
                                {book.year}
                            </span>
                        )}
                        <span className="text-[10px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg truncate max-w-[120px]">
                            {book.subject}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0 self-center">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(book);
                        }}
                        className={`p-3 rounded-2xl transition duration-300 border ${
                            isBookmarked(book) 
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30' 
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/15 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10'
                        }`}
                        title={isBookmarked(book) ? "Unbookmark" : "Bookmark"}
                    >
                        <Bookmark className={`w-4 h-4 transition ${isBookmarked(book) ? 'fill-rose-500 stroke-rose-500 text-rose-500' : 'text-slate-400 dark:text-slate-500'}`} />
                    </button>
                    
                    <a 
                        href={book.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={`bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-2xl transition shadow-lg shadow-blue-900/20 ${!book.link ? 'opacity-50 cursor-not-allowed pointer-events-none bg-slate-705' : ''}`}
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>
        ))}
        
        {!loading && activeTab === 'bookmarks' && bookmarks.length === 0 && (
            <div className="col-span-full text-center py-20 px-8 glass rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500">
                    <Bookmark className="w-8 h-8" />
                </div>
                <p className="text-slate-800 dark:text-white font-bold text-lg mb-2">No Bookmarks Saved Yet</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mb-6">
                    Save resources you want to easily access later. Click the bookmark icon on any material to store it here.
                </p>
                <button 
                    onClick={() => setActiveTab('all')} 
                    className="text-white bg-blue-600 px-6 py-3 rounded-2xl hover:bg-blue-500 active:scale-95 transition shadow-lg shadow-blue-500/20 font-semibold text-sm"
                >
                    Browse Digital Library
                </button>
            </div>
        )}

        {!loading && filteredBooks.length === 0 && (activeTab !== 'bookmarks' || bookmarks.length > 0) && (
            <div className="col-span-full text-center py-20 glass rounded-[2.5rem] border border-white/5">
                <p className="text-slate-800 dark:text-slate-300 font-bold text-lg mb-2">No items found</p>
                <p className="text-slate-500 text-sm mb-6">Try adjusting your search or filter.</p>
                <button 
                    onClick={() => {setSearchTerm(''); setSelectedSubject('All');}} 
                    className="text-white bg-slate-800 px-6 py-3 rounded-2xl hover:bg-slate-700 transition border border-white/10"
                >
                    Clear Filters
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

const ChevronDownIcon = ({className}:{className?:string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
)

export default Library;