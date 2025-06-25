import { api } from '../api/api';
import type { Ligacao } from '../types/kanban';

export async function getLigacoes(): Promise<Ligacao[]> {
    const response = await api('/ligacoes');
    if (!response.ok) throw new Error('Falha ao buscar ligações');
    return response.json();
}

export async function createLigacao(data: Partial<Ligacao>): Promise<Ligacao> {
    const response = await api('/ligacoes', { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Falha ao criar ligação');
    return response.json();
}

export async function updateLigacao(id: number, data: Partial<Ligacao>): Promise<Ligacao> {
    const response = await api(`/ligacoes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Falha ao atualizar ligação');
    return response.json();
}

export async function deleteLigacao(id: number): Promise<void> {
    const response = await api(`/ligacoes/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Falha ao deletar ligação');
}

export async function uploadLigacaoImage(id: number, formData: FormData): Promise<{ image_url: string }> {
    const response = await api(`/ligacoes/${id}/image`, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Falha no upload da imagem');
    return response.json();
}