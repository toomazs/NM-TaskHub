export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  created_at?: string;
  role?: string;
  is_owner?: boolean; 
}

export interface Board {
  id: number;
  title: string;
  description: string;
  owner_id: string;
  owner_name?: string; 
  is_public: boolean;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: number;
  board_id: number;
  title: string;
  position: number;
  color: string;
  cards: Card[];
}

export interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string;
  assigned_to: string;
  priority: 'baixa' | 'media' | 'alta';
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
    text: string;
    author: string;
    timestamp: string;
}

export interface Notification {
    id: number;
    user_id: string;
    type: 'board_invitation' | 'new_task_assigned' | 'invitation_accepted';
    message: string;
    is_read: boolean;
    related_board_id?: number;
    related_card_id?: number;
    invitation_id?: number;
    created_at: string;
    invitation_status?: 'pending' | 'accepted' | 'rejected' | '';
}