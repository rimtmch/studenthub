import React, { useState, useEffect } from 'react';
import { Search, Book as BookIcon, Filter, RefreshCw, ExternalLink } from 'lucide-react';
import { Book } from '../types';
import { supabase } from '../services/supabaseClient';

const Library: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      const fetchBooks = async () => {
          setLoading(true);
          const { data, error } = await supabase.from('books').select('*');
          if(data) {
              setBooks(data);
          } else {
              console.error("Error fetching books", error);
          }
          setLoading(false);
      };
      fetchBooks();
  }, []);

  const subjects = ['All', ...Array.from(new Set(books.map(b => b.subject).filter(Boolean))).sort()];

  const filteredBooks = books.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'All' || b.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Digital Library</h2>
        <div className="text-xs text-blue-600 dark:text-blue-200 font-medium bg-blue-100 dark:bg-blue-500/10 px-4 py-2 rounded-full self-start md:self-auto border border-blue-500/20 backdrop-blur-md">
            {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'} found
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

                <a 
                    href={book.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`flex-shrink-0 self-center bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-2xl transition shadow-lg shadow-blue-900/20 ${!book.link ? 'opacity-50 cursor-not-allowed pointer-events-none bg-slate-700' : ''}`}
                >
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        ))}
        
        {!loading && filteredBooks.length === 0 && (
            <div className="col-span-full text-center py-20 glass rounded-[2.5rem] border border-white/5">
                <p className="text-slate-800 dark:text-slate-300 font-bold text-lg mb-2">No books found</p>
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