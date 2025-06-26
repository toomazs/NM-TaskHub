export type StatusKey = 'pendente' | 'Agendado O.S.' | 'Nao conseguido contato' | 'Nao solucionado';

export interface ClienteSinalAlto {
  id: string;
  olt: string;
  login: string;
  ponid: string;
  mac: string;
  rx: number;
  tx: number;
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
    assigned_to_avatar?: string; 
    assigned_to_name?: string;
}