import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserProfile, BookListing, BookRequest } from '../types';
import { Store, Book, ArrowRight, CheckCircle2, XCircle, Search, Plus, Bell, Clock, Send, MessageSquare, Trash2, X } from 'lucide-react';

interface Props {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const BookRenting: React.FC<Props> = ({ user, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'my-listings' | 'requests'>('browse');
  const [listings, setListings] = useState<BookListing[]>([]);
  const [myRequests, setMyRequests] = useState<BookRequest[]>([]);
  const [requestsForMe, setRequestsForMe] = useState<BookRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Missing Name State
  const [tempFullName, setTempFullName] = useState(user.fullname || '');
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Modals
  const [isNewListingModalOpen, setIsNewListingModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<BookListing | null>(null);

  const [newListingError, setNewListingError] = useState('');
  const [newListingSuccess, setNewListingSuccess] = useState('');

  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');

  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  const [listingToDelete, setListingToDelete] = useState<BookListing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // New Listing Form
  const [newListing, setNewListing] = useState({
    title: '',
    condition: 'Good',
    price: '',
    price_type: 'week' as any,
    upi_id: '',
  });

  // Request Form
  const [requestData, setRequestData] = useState({
    requested_price: '',
    price_type: 'week' as any,
    message: ''
  });

  useEffect(() => {
    if (user.fullname) {
      fetchData();
    }
  }, [user.fullname, activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Always fetch requests for my listings for the badges and inline requests in 'my-listings'
      const { data: reqsForMe } = await supabase
        .from('book_requests')
        .select(`*, listing:book_listings!inner(*), requester:profiles!requester_username(fullname, avatar_data)`)
        .eq('book_listings.lister_username', user.username)
        .order('created_at', { ascending: false });
        
      if (reqsForMe) {
        setRequestsForMe(reqsForMe.map((req: any) => ({
          ...req,
          requester: req.requester ? {
            fullname: req.requester.fullname,
            avatar: req.requester.avatar_data
          } : undefined
        })));
      } else {
        setRequestsForMe([]);
      }

      if (activeTab === 'browse') {
        const { data } = await supabase
          .from('book_listings')
          .select(`*, lister:profiles!lister_username(fullname, avatar_data)`)
          .neq('lister_username', user.username)
          .order('created_at', { ascending: false });
        if (data) {
          setListings(data.map((item: any) => ({
            ...item,
            lister: item.lister ? {
              fullname: item.lister.fullname,
              avatar: item.lister.avatar_data
            } : undefined
          })));
        }
      } else if (activeTab === 'my-listings') {
        const { data } = await supabase
          .from('book_listings')
          .select('*')
          .eq('lister_username', user.username)
          .order('created_at', { ascending: false });
        if (data) setListings(data);
      } else if (activeTab === 'requests') {
        // Fetch My Requests
        const { data: myReqs } = await supabase
          .from('book_requests')
          .select(`*, listing:book_listings(*, lister:profiles!lister_username(fullname, avatar_data))`)
          .eq('requester_username', user.username)
          .order('created_at', { ascending: false });
        if (myReqs) {
          setMyRequests(myReqs.map((req: any) => ({
            ...req,
            listing: req.listing ? {
              ...req.listing,
              lister: req.listing.lister ? {
                fullname: req.listing.lister.fullname,
                avatar: req.listing.lister.avatar_data
              } : undefined
            } : undefined
          })));
        }
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleUpdateName = async () => {
    if (!tempFullName.trim()) return;
    setIsUpdatingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ fullname: tempFullName })
        .eq('username', user.username);
      
      if (!error) {
        onUpdateUser({ ...user, fullname: tempFullName });
      }
    } catch (e) {
      console.error(e);
    }
    setIsUpdatingName(false);
  };

  const handleCreateListing = async () => {
    setNewListingError('');
    setNewListingSuccess('');
    if (!newListing.title || !newListing.price) {
        setNewListingError('Please fill in all required fields.');
        return;
    }
    try {
      const { error } = await supabase.from('book_listings').insert([{
        lister_username: user.username,
        title: newListing.title,
        condition: newListing.condition,
        price: newListing.price,
        price_type: newListing.price_type,
        ...(newListing.upi_id ? { upi_id: newListing.upi_id } : {})
      }]);
      
      if (!error) {
        setNewListingSuccess("Listing created successfully!");
        setNewListing({ title: '', condition: 'Good', price: '', price_type: 'week', upi_id: '' });
        fetchData();
        setTimeout(() => {
            setIsNewListingModalOpen(false);
            setNewListingSuccess('');
        }, 1500);
      } else {
        setNewListingError("Error creating listing details: " + error.message);
      }
    } catch (e: any) {
      console.error(e);
      setNewListingError("Unexpected error occurred.");
    }
  };

  const handleRequestBook = async () => {
    setRequestError('');
    setRequestSuccess('');
    if (!selectedListing || !requestData.requested_price) {
        setRequestError('Please provide a requested price.');
        return;
    }
    if (selectedListing.lister_username === user.username) {
        setRequestError('You cannot request to rent your own book.');
        return;
    }
    try {
      const { error } = await supabase.from('book_requests').insert([{
        listing_id: selectedListing.id,
        requester_username: user.username,
        requested_price: requestData.requested_price,
        price_type: requestData.price_type,
        message: requestData.message,
        status: 'pending'
      }]);
      
      if (!error) {
        setRequestSuccess(`Request sent to the owner!`);
        setTimeout(() => {
            setIsRequestModalOpen(false);
            setSelectedListing(null);
            setRequestSuccess('');
            fetchData();
        }, 1500);
      } else {
        setRequestError("Error requesting book: " + error.message);
      }
    } catch (e: any) {
      console.error(e);
      setRequestError("Unexpected error occurred.");
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      setUpdatingRequestId(requestId + '_' + status);
      const { error } = await supabase.from('book_requests').update({ status }).eq('id', requestId);
      if (error) {
        console.error("Error updating request status:", error);
        alert("Failed to update status: " + error.message);
      } else {
        await fetchData(); // refresh
      }
    } catch (e: any) {
      console.error(e);
      alert("Unexpected error occurred: " + (e.message || "Please check console"));
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    try {
      await supabase.from('book_requests').delete().eq('id', requestId);
      fetchData(); // refresh
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      // First, delete any requests associated with this listing to avoid constraint errors
      const { error: reqError } = await supabase.from('book_requests').delete().eq('listing_id', listingId);
      if (reqError) {
        console.error("Error deleting requests:", reqError);
        setDeleteError('Failed to delete pending requests: ' + reqError.message);
        setIsDeleting(false);
        return;
      }
      
      // Now, delete the listing itself
      const { error: listingError } = await supabase.from('book_listings').delete().eq('id', listingId);
      if (listingError) {
        console.error("Error deleting listing:", listingError);
        setDeleteError('Failed to delete the book listing: ' + listingError.message);
        setIsDeleting(false);
        return;
      }

      setListingToDelete(null);
      fetchData();
    } catch (e: any) {
      console.error(e);
      setDeleteError(e.message || 'An unexpected error occurred while deleting.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 1. Missing Name Step
  if (!user.fullname) {
    return (
      <div className="flex flex-col items-center justify-center pt-20 animate-fade-in text-center px-4">
        <Store className="w-16 h-16 text-blue-500 mb-6" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome to Book Renting</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm">To rent books from others or list your own, please provide your Full Name for easy identification.</p>
        
        <div className="w-full max-w-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl">
          <input 
            type="text" 
            placeholder="Your Full Name" 
            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 transition mb-4"
            value={tempFullName} 
            onChange={e => setTempFullName(e.target.value)} 
          />
          <button 
            onClick={handleUpdateName} 
            disabled={isUpdatingName || !tempFullName.trim()} 
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition"
          >
            {isUpdatingName ? 'Updating...' : 'Save & Continue'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <Store className="w-8 h-8 text-blue-500" />
              Book Market
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Rent books directly from peers.</p>
          </div>
          
          <button 
            onClick={fetchData} 
            disabled={isLoading}
            className="md:hidden p-2 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition"
            title="Refresh Data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? "animate-spin" : ""}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex bg-slate-200/50 dark:bg-white/5 p-1 rounded-full w-full md:w-auto relative">
            <button 
              onClick={() => setActiveTab('browse')} 
              className={`flex-1 md:flex-none px-6 py-2 rounded-full text-sm font-semibold transition ${activeTab === 'browse' ? 'bg-white dark:bg-white/10 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-amber-50'}`}
            >
              Browse
            </button>
            <button 
              onClick={() => setActiveTab('my-listings')} 
              className={`flex-1 md:flex-none px-6 py-2 rounded-full text-sm font-semibold transition ${activeTab === 'my-listings' ? 'bg-white dark:bg-white/10 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-amber-50'}`}
            >
              My Listings
              {requestsForMe.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{requestsForMe.filter(r => r.status === 'pending').length}</span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('requests')} 
              className={`flex-1 md:flex-none px-6 py-2 rounded-full text-sm font-semibold transition ${activeTab === 'requests' ? 'bg-white dark:bg-white/10 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-amber-50'}`}
            >
              Requests
            </button>
          </div>
          <button 
            onClick={fetchData} 
            disabled={isLoading}
            className="hidden md:flex p-2 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition"
            title="Refresh Data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? "animate-spin" : ""}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>
      ) : (
        <div className="mt-8">
          
          {/* TAB: BROWSE */}
          {activeTab === 'browse' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-500 dark:text-slate-400">No books available for rent right now.</div>
              ) : (
                listings.map(listing => (
                  <div key={listing.id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition group">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-2">{listing.title}</h3>
                      <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap">
                        ₹{listing.price} / {listing.price_type}
                      </span>
                    </div>
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Book className="w-4 h-4 opacity-70" /> Condition: {listing.condition}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
                          {listing.lister?.avatar ? <img src={listing.lister.avatar} className="w-full h-full object-cover" /> : <UserIconChar name={listing.lister?.fullname || '?'} />}
                        </div>
                        <span className="truncate">Listed by {listing.lister?.fullname || listing.lister_username}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => { 
                        setSelectedListing(listing); 
                        setRequestData({
                          requested_price: listing.price,
                          price_type: listing.price_type,
                          message: ''
                        });
                        setIsRequestModalOpen(true); 
                      }}
                      className="w-full bg-blue-50 dark:bg-white/5 hover:bg-blue-100 dark:hover:bg-white/10 text-blue-600 dark:text-white text-sm font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                    >
                      Request to Rent <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: MY LISTINGS */}
          {activeTab === 'my-listings' && (
            <div className="space-y-6">
              <button 
                onClick={() => setIsNewListingModalOpen(true)}
                className="w-full border-2 border-dashed border-slate-300 dark:border-white/20 hover:border-blue-500 dark:hover:border-blue-500/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition bg-slate-50/50 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/5 group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center group-hover:scale-110 transition">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-semibold tracking-wide">List a New Book</span>
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map(listing => {
                  const listingRequests = requestsForMe.filter(r => r.listing_id === listing.id);
                  
                  return (
                  <div key={listing.id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-sm opacity-90">
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-2">
                         <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-2">{listing.title}</h3>
                         <span className="bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap">
                           ₹{listing.price}/{listing.price_type}
                         </span>
                      </div>
                      <div className="text-sm text-slate-500 mb-4">{listing.condition} Condition</div>
                      {listing.upi_id && (
                        <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400 break-all border border-slate-100 dark:border-white/5">
                          UPI: <span className="font-mono">{listing.upi_id}</span>
                        </div>
                      )}
                      
                      {listingRequests.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requests ({listingRequests.length})</h4>
                          {listingRequests.map(req => (
                            <div key={req.id} className="bg-blue-50/50 dark:bg-black/30 border border-blue-100 dark:border-white/5 rounded-xl p-3">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 overflow-hidden">
                                     {req.requester?.avatar ? <img src={req.requester.avatar} className="object-cover w-full h-full"/> : <span className="text-[10px]">{req.requester?.fullname?.charAt(0)}</span>}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{req.requester?.fullname || req.requester_username}</span>
                                </div>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                  req.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                  req.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                                  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                                }`}>
                                  {req.status}
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                Offered: <strong className="text-slate-900 dark:text-white">₹{req.requested_price} / {req.price_type}</strong>
                              </div>
                              {req.status === 'pending' && (
                                <div className="flex gap-2 mt-2">
                                  <button 
                                    onClick={() => handleUpdateRequestStatus(req.id, 'accepted')} 
                                    disabled={updatingRequestId !== null}
                                    className="flex-1 bg-green-500 text-white hover:bg-green-600 active:scale-95 disabled:opacity-50 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex justify-center"
                                  >
                                    {updatingRequestId === req.id + '_accepted' ? '...' : 'Accept'}
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateRequestStatus(req.id, 'rejected')} 
                                    disabled={updatingRequestId !== null}
                                    className="flex-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30 active:scale-95 disabled:opacity-50 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex justify-center"
                                  >
                                    {updatingRequestId === req.id + '_rejected' ? '...' : 'Reject'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-50 dark:bg-black/20 p-3 border-t border-slate-100 dark:border-white/5 flex justify-end">
                      <button
                        onClick={() => { setDeleteError(''); setListingToDelete(listing); }}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1.5 transition py-1 px-2 rounded-lg hover:bg-red-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Listing
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}

          {/* TAB: REQUESTS */}
          {activeTab === 'requests' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Requests for My Listings */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <Bell className="w-5 h-5 text-amber-500" /> Requests for my books
                </h3>
                <div className="space-y-3">
                  {requestsForMe.length === 0 ? (
                    <div className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">No requests received yet</div>
                  ) : (
                    requestsForMe.map(req => (
                      <div key={req.id} className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                         <div className="flex justify-between items-start">
                            <div>
                               <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Requested your listed book:</div>
                               <div className="font-bold text-slate-900 dark:text-white">{req.listing?.title}</div>
                            </div>
                            <StatusBadge status={req.status} />
                         </div>
                         
                         <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-200 dark:border-white/5">
                               <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 overflow-hidden">
                                 {req.requester?.avatar ? <img src={req.requester.avatar} className="object-cover w-full h-full"/> : <span className="text-xs">{req.requester?.fullname?.charAt(0)}</span>}
                               </div>
                               <div className="text-sm"><span className="font-bold text-slate-800 dark:text-slate-200">{req.requester?.fullname || req.requester_username}</span> wants to rent this.</div>
                            </div>
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span className="text-slate-500">Proposed Price:</span>
                                <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded">₹{req.requested_price} / {req.price_type}</span>
                            </div>
                            {req.message && (
                                <div className="mt-3 text-sm text-slate-600 dark:text-slate-400 italic">"{req.message}"</div>
                            )}
                         </div>

                         {req.status === 'pending' && (
                           <div className="flex gap-2 mt-2">
                             <button 
                               onClick={() => handleUpdateRequestStatus(req.id, 'accepted')} 
                               disabled={updatingRequestId !== null}
                               className="flex-1 bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 active:scale-95 disabled:opacity-50 text-green-700 dark:text-green-400 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 border border-green-200 dark:border-green-500/20 cursor-pointer"
                             >
                               <CheckCircle2 className="w-4 h-4" /> 
                               {updatingRequestId === req.id + '_accepted' ? 'Accepting...' : 'Accept'}
                             </button>
                             <button 
                               onClick={() => handleUpdateRequestStatus(req.id, 'rejected')} 
                               disabled={updatingRequestId !== null}
                               className="flex-1 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 disabled:opacity-50 text-red-700 dark:text-red-400 py-2 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 border border-red-200 dark:border-red-500/20 cursor-pointer"
                             >
                               <XCircle className="w-4 h-4" /> 
                               {updatingRequestId === req.id + '_rejected' ? 'Rejecting...' : 'Reject'}
                             </button>
                           </div>
                         )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* My Sent Requests */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <Send className="w-5 h-5 text-blue-500" /> My sent requests
                </h3>
                <div className="space-y-3">
                  {myRequests.length === 0 ? (
                    <div className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">You haven't requested any books</div>
                  ) : (
                    myRequests.map(req => (
                      <div key={req.id} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                         <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white truncate">{req.listing?.title}</h4>
                                <div className="text-xs text-slate-500 mt-0.5">Requested from: {req.listing?.lister?.fullname || req.listing?.lister_username || "Unknown"}</div>
                            </div>
                            <StatusBadge status={req.status} />
                         </div>
                         <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span>Offered: <strong className="text-slate-700 dark:text-slate-300">₹{req.requested_price} / {req.price_type}</strong></span>
                            {req.status === 'accepted' && (
                                <span className="text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-bold">Contact Owner via App</span>
                            )}
                         </div>
                         <div className="flex justify-end mt-1">
                             <button onClick={() => handleDeleteRequest(req.id)} className="text-xs flex items-center gap-1.5 text-red-500 hover:text-red-600 transition">
                                 <Trash2 className="w-3.5 h-3.5" /> Remove Request
                             </button>
                         </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* --- MODALS --- */}

      {/* Create Listing Modal */}
      {isNewListingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#0f1219] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/10 relative">
            <button 
              onClick={() => setIsNewListingModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-500" /> List Book for Rent
            </h3>
            
            {newListingError && <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-sm p-3 rounded-xl">{newListingError}</div>}
            {newListingSuccess && <div className="mb-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-300 text-sm p-3 rounded-xl">{newListingSuccess}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Book Title</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400"
                  placeholder="e.g. Modern Operating Systems"
                  value={newListing.title} onChange={e => setNewListing({...newListing, title: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Price (₹)</label>
                   <input 
                     type="number" 
                     className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 transition"
                     placeholder="150"
                     value={newListing.price} onChange={e => setNewListing({...newListing, price: e.target.value})}
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Per</label>
                   <select 
                     className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 transition appearance-none"
                     value={newListing.price_type} onChange={e => setNewListing({...newListing, price_type: e.target.value as any})}
                   >
                     <option value="day">Day</option>
                     <option value="week">Week</option>
                     <option value="month">Month</option>
                     <option value="flat">Flat/Term</option>
                   </select>
                 </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Condition</label>
                <select 
                     className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 transition appearance-none"
                     value={newListing.condition} onChange={e => setNewListing({...newListing, condition: e.target.value})}
                >
                     <option value="Like New">Like New</option>
                     <option value="Good">Good</option>
                     <option value="Fair">Fair</option>
                     <option value="Heavily Used">Heavily Used</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">UPI ID (Optional, for payment)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 font-mono"
                  placeholder="username@bank"
                  value={newListing.upi_id} onChange={e => setNewListing({...newListing, upi_id: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setIsNewListingModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl font-bold transition">Cancel</button>
              <button 
                onClick={handleCreateListing}
                disabled={!newListing.title || !newListing.price}
                className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white hover:shadow-lg hover:shadow-blue-500/20 py-3 rounded-xl font-bold transition"
              >
                List Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Modal */}
      {isRequestModalOpen && selectedListing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#0f1219] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/10 relative">
            <button 
              onClick={() => setIsRequestModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Request Book</h3>
            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl mb-6 border border-slate-100 dark:border-white/5">
                <div className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{selectedListing.title}</div>
                <div className="text-xs text-slate-500">Listed by {selectedListing.lister?.fullname || selectedListing.lister_username}</div>
            </div>

            {requestError && <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-sm p-3 rounded-xl">{requestError}</div>}
            {requestSuccess && <div className="mb-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-300 text-sm p-3 rounded-xl">{requestSuccess}</div>}
            
            <div className="space-y-4">
              <div className="bg-blue-50/50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                 <p className="text-sm text-blue-900 dark:text-blue-300 font-medium mb-3">Owner's Asking Price: <strong className="text-xl ml-1">₹{selectedListing.price} / {selectedListing.price_type}</strong></p>
                 <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-blue-200/50 dark:border-blue-500/20">
                     <div>
                        <label className="block text-xs font-bold text-blue-700/70 dark:text-blue-400 uppercase tracking-wider mb-1.5">Your Offer (₹)</label>
                        <input 
                            type="number" 
                            className="w-full bg-white dark:bg-black/20 border border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-white px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30"
                            placeholder={selectedListing.price}
                            value={requestData.requested_price} onChange={e => setRequestData({...requestData, requested_price: e.target.value})}
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-blue-700/70 dark:text-blue-400 uppercase tracking-wider mb-1.5">Per</label>
                        <select 
                            className="w-full bg-white dark:bg-black/20 border border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-white px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none"
                            value={requestData.price_type} onChange={e => setRequestData({...requestData, price_type: e.target.value as any})}
                        >
                            <option value="day">Day</option>
                            <option value="week">Week</option>
                            <option value="month">Month</option>
                            <option value="flat">Flat/Term</option>
                        </select>
                     </div>
                 </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Message to owner (Optional)</label>
                <textarea 
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 transition placeholder-slate-400 resize-none text-sm"
                  placeholder="e.g. I need this for the midterms next week."
                  value={requestData.message} onChange={e => setRequestData({...requestData, message: e.target.value})}
                ></textarea>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setIsRequestModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl font-bold transition">Cancel</button>
              <button 
                onClick={handleRequestBook}
                disabled={!requestData.requested_price}
                className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white hover:shadow-lg hover:shadow-blue-500/20 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {listingToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#0f1219] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 relative">
            <button 
              onClick={() => setListingToDelete(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Delete Book Listing
            </h3>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 dark:text-white">"{listingToDelete.title}"</strong>? 
              This action is permanent and will also automatically remove any pending rent requests associated with this book.
            </p>

            {deleteError && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl p-3.5 mb-4 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setListingToDelete(null)} 
                disabled={isDeleting}
                className="flex-1 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50 rounded-xl font-bold transition text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteListing(listingToDelete.id)}
                disabled={isDeleting}
                className="flex-[2] bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white hover:shadow-lg hover:shadow-red-500/20 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Listing'}
              </button>
            </div>
            
            <div className="mt-4 text-[11px] text-slate-400 dark:text-slate-500 text-center leading-normal">
              If deletion continues to fail, please verify your Supabase database has a <strong>DELETE</strong> Row Level Security (RLS) policy enabled for the <code className="bg-slate-100 dark:bg-white/5 px-1 py-0.5 rounded font-mono text-slate-500">book_listings</code> and <code className="bg-slate-100 dark:bg-white/5 px-1 py-0.5 rounded font-mono text-slate-500">book_requests</code> tables.
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
        case 'accepted': 
            return <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-bold uppercase tracking-wider bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-md border border-green-200 dark:border-green-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Accepted</div>;
        case 'rejected':
            return <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-md border border-red-200 dark:border-red-500/20"><XCircle className="w-3.5 h-3.5" /> Rejected</div>;
        default:
            return <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Pending</div>;
    }
}

const UserIconChar = ({ name }: { name: string }) => {
    return <span className="font-bold text-xs text-slate-500 dark:text-slate-400">{name.charAt(0).toUpperCase()}</span>;
}

export default BookRenting;
