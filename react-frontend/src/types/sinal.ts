export interface Endereco {
  rua: string;
  numero: string;
  bairro: string;
}

export interface Contatos {
  celular: string;
  whatsapp: string;
  fone: string;
}

export type StatusKey = 'pendente' | 'Agendado O.S.' | 'Nao conseguido contato' | 'Nao solucionado' | 'Cancelados';

export interface ClienteSinalAlto {
  id: string;
  olt: string;
  login: string;
  ponid: string;
  mac: string;
  rx: number;
  tx: number;
  endereco: Endereco;
  contatos: Contatos;
}

export interface ClienteSinalAltoComStatus extends ClienteSinalAlto {
  status: StatusKey;
  anotacao?: string;
  assigned_to?: string;
  assigned_to_name?: string; 
  assigned_to_avatar?: string; 
}

export interface ContatoStatus {
    contato_id: string;
    status: StatusKey;
    anotacao: string;
    updated_at: string;
    updated_by: string;
    assigned_to?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  is_admin: boolean;
}

export interface Comment {
  text: string;
  author: string;   
  authorId: string; 
  avatar?: string;  
  timestamp: string;
  edited?: boolean;
}