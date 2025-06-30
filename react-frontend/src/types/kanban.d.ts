export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  created_at?: string;
  role?: string;
  is_owner?: boolean;
  is_admin?: boolean; 
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
  completed_at: string | null;
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

export interface Ligacao {
  id: number;
  name: string;
  type: 'Condomínio' | 'Bairro' | 'Outros';
  image_url?: string;
  status: string;
  spreadsheet_url?: string;
  address?: string;
  end_date?: string;
  observations?: string;
  created_at: string;
  updated_at: string;
}

export interface AgendaEvent {
  id: number;
  title: string;
  description?: string;
  event_date: string;
  color: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export type ReviewSource = 'Google' | 'ReclameAqui' | 'Procon' | 'ANATEL' | 'Outros';
export type ReviewStatus = 'Pendente' | 'Em Tratamento' | 'Resolvido' | 'Ignorado';

export interface Avaliacao {
  id: number;
  source: ReviewSource;
  customer_name: string;
  review_content: string;
  rating?: number;
  status: ReviewStatus;
  review_date: string;
  review_url?: string;
  assigned_to?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}
