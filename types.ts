export interface UserProfile {
  fullname: string;
  email: string;
  dob: string;
  phone: string;
  username: string;
  course?: 'MBBS' | 'BDS';
  batch_year?: string;
  password?: string;
  pin?: string; // backwards compatibility
  avatar?: string;
  username_last_changed?: string;
  role?: 'admin' | 'student';
}

export interface AttendanceRecord {
  attended: number;
  total: number;
  target: number;
}

export interface Subject {
  name: string;
  theory: AttendanceRecord;
  practical: AttendanceRecord;
}

export interface Book {
  title: string;
  author: string;
  subject: string;
  year: string;
  link: string;
  edition?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PollData {
  question: string;
  options: PollOption[];
  voters?: Record<string, string>; // username -> optionId
}

export interface Confession {
  id: string;
  text: string;
  username: string;
  created_at: string;
  likes: number;
  replies: Reply[];
  avatar?: string;
  poll?: PollData;
  image_url?: string;
  tag?: string;
  isAskSenior?: boolean;
}

export interface LostFoundItem {
  id: string;
  title: string;
  description: string;
  type: 'lost' | 'found';
  location: string;
  item_date: string;
  image_url?: string;
  contact_phone: string;
  contact_name: string;
  posted_by: string;
  status: 'open' | 'resolved';
  created_at: string;
}

export interface Reply {
  id: string;
  text: string;
  username: string;
  created_at: string;
  likes: number;
  avatar?: string;
}

export interface BookListing {
  id: string;
  lister_username: string;
  title: string;
  condition: string;
  price: string;
  price_type: 'day' | 'week' | 'month' | 'flat';
  upi_id?: string;
  created_at: string;
  lister?: {
    fullname: string;
    avatar: string;
    phone?: string;
  };
}

export interface BookRequest {
  id: string;
  listing_id: string;
  requester_username: string;
  requested_price: string;
  price_type: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  requester?: {
    fullname: string;
    avatar: string;
    phone?: string;
  };
  listing?: BookListing;
}
