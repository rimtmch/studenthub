
export interface UserProfile {
  fullname: string;
  email: string;
  dob: string;
  phone: string;
  username: string;
  password?: string;
  pin?: string; // keeping for backwards compatibility until db changes
  avatar?: string;
  username_last_changed?: string;
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

export interface Confession {
  id: string;
  text: string;
  username: string;
  created_at: string;
  likes: number;
  replies: Reply[];
  avatar?: string; // Added for social feed
}

export interface Reply {
  id: string;
  text: string;
  username: string;
  created_at: string;
  likes: number;
  avatar?: string; // Added for reply avatars
}

export interface MessMenu {
  day: string;
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
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
  };
  listing?: BookListing;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}