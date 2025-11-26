
export interface UserProfile {
  fullname: string;
  email: string;
  dob: string;
  phone: string;
  username: string;
  pin: string;
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}