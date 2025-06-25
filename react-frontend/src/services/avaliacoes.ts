import { api } from '../api/api';
import { Avaliacao } from '../types/kanban';

export async function getAvaliacoes(): Promise<Avaliacao[]> {
    const response = await api('/avaliacoes');
    if (!response.ok) throw new Error('Falha ao buscar avaliações');
    return response.json();
}

export async function createAvaliacao(data: Partial<Avaliacao>): Promise<Avaliacao> {
    const response = await api('/avaliacoes', { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Falha ao criar avaliação');
    return response.json();
}

export async function updateAvaliacao(id: number, data: Partial<Avaliacao>): Promise<Avaliacao> {
    const response = await api(`/avaliacoes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Falha ao atualizar avaliação');
    return response.json();
}

export async function deleteAvaliacao(id: number): Promise<void> {
    const response = await api(`/avaliacoes/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Falha ao deletar avaliação');
}