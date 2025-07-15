import toast from 'react-hot-toast';
import { api } from '../api/api';
import { ClienteSinalAlto, ContatoStatus } from '../types/sinal';

// URLs da API do Marques
const PRIMARY_SINAIS_API_URL = 'http://10.0.30.251:3000/api/sinais';
const FALLBACK_SINAIS_API_URL = 'http://10.0.100.3:3000/api/sinais';

async function tryFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export interface SinaisResponse {
  data: ClienteSinalAlto[];
}

export async function getSinais(): Promise<SinaisResponse> {
  const fetchFromUrl = async (url: string): Promise<SinaisResponse> => {
      const response = await tryFetch(url);
      if (!response.ok) {
          throw new Error(`API de sinais em ${url} retornou erro: ${response.statusText}`);
      }

      const apiResponse: SinaisResponse = await response.json();

      return { data: apiResponse.data };
  }

  try {
    return await fetchFromUrl(PRIMARY_SINAIS_API_URL);
  } catch (error) {
    console.warn("API primária indisponível, tentando fallback:", error);
    try {
        return await fetchFromUrl(FALLBACK_SINAIS_API_URL);
    } catch (fallbackError) {
        console.error("Falha ao buscar dados de sinais da API (ambas as URLs):", fallbackError);
        toast.error("Não foi possível carregar os clientes. As APIs de sinais estão online?");
        return { data: [] };
    }
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


export const updateContatoAnotacao = async (contatoId: string, anotacao: string): Promise<void> => {
    const response = await api(`/contatos/${contatoId}/anotacao`, {
        method: 'PUT',
        body: JSON.stringify({ anotacao })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error("Erro no salvamento automático:", errorData);
        throw new Error(errorData.error || 'Falha ao salvar anotação');
    }
};

export async function adminAssignContato(contatoId: string, assigneeId: string): Promise<any> {
    const response = await api('/contatos/admin-assign', {
        method: 'POST',
        body: JSON.stringify({ contato_id: contatoId, assignee_id: assigneeId })
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error("Erro do servidor ao atribuir tarefa (admin):", errorData);
        throw new Error(errorData.error || 'Falha ao atribuir a tarefa');
    }
    return response.json();
}

