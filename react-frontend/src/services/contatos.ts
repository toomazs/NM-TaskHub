import toast from 'react-hot-toast';
import { api } from '../api/api';
import { ClienteSinalAlto, ContatoStatus } from '../types/sinal';

const SINAIS_API_URL = 'http://10.0.100.3:3000/api/sinais';


export async function getSinais(): Promise<ClienteSinalAlto[]> {
  try {
    const response = await fetch(SINAIS_API_URL);
    if (!response.ok) {
      throw new Error(`A API de sinais retornou um erro: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Falha ao buscar dados de sinais da API:", error);
    toast.error("Não foi possível carregar os clientes. A API de sinais está online?");
    return []; 
  }
}


export async function getContatosStatus(): Promise<ContatoStatus[]> {  
    const response = await api('/contatos/status', { method: 'GET' });  
    if (!response.ok) {  
        throw new Error('Falha ao buscar status dos contatos');  
    }
    return response.json();  
}

export async function setContatoStatus(payload: {
    contato_id: string;
    status: string;
    anotacao: string;
}): Promise<any> {  
    const response = await api('/contatos/status', {  
        method: 'POST',  
        body: JSON.stringify(payload)  
    });
     if (!response.ok) { 
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' })); 
        console.error("Erro do servidor ao salvar status:", errorData); 
        throw new Error(errorData.error || 'Falha ao salvar o status do contato');
    }
    return response.json(); 
}

export async function assignContato(contatoId: string): Promise<any> {  
    const response = await api('/contatos/assign', {  
        method: 'POST',  
        body: JSON.stringify({ contato_id: contatoId })  
    });
    if (!response.ok) {  
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));  
        console.error("Erro do servidor ao assumir tarefa:", errorData);  
        throw new Error(errorData.error || 'Falha ao assumir a tarefa');  
    }
    return response.json();  
}

export async function unassignContato(contatoId: string): Promise<any> {  
    const response = await api('/contatos/unassign', {  
        method: 'POST',  
        body: JSON.stringify({ contato_id: contatoId })  
    });
    if (!response.ok) {  
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));  
        console.error("Erro do servidor ao desassociar tarefa:", errorData);  
        throw new Error(errorData.error || 'Falha ao desassociar a tarefa');  
    }
    return response.json();  
}