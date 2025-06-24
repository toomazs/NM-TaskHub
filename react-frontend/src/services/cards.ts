import { api } from '../api/api';
import type { Card } from '../types/kanban';

export async function getCardsForColumn(columnId: number): Promise<Card[]> {
    const response = await api(`/columns/${columnId}/cards`);
    if (!response.ok) throw new Error('Falha ao buscar os cards da coluna.');
    return response.json();
}

export async function createCard(columnId: number, cardData: Partial<Card>): Promise<Card> {
    const response = await api(`/columns/${columnId}/cards`, {
        method: 'POST',
        body: JSON.stringify(cardData)
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Falha ao criar o card.' }));
        throw new Error(errorData.error);
    }
    return response.json();
}

export async function updateCard(cardId: number, cardData: Partial<Card>): Promise<Card> {
    const response = await api(`/cards/${cardId}`, {
        method: 'PUT',
        body: JSON.stringify(cardData)
    });
    if (!response.ok) throw new Error('Falha ao atualizar o card.');
    return response.json();
}

export async function deleteCard(cardId: number): Promise<void> {
    const response = await api(`/cards/${cardId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Falha ao excluir o card.');
}

export async function moveCard(cardId: number, newColumnId: number, newPosition: number): Promise<void> {
    const response = await api('/cards/move', {
        method: 'POST',
        body: JSON.stringify({
            card_id: cardId,
            new_column_id: newColumnId,
            new_position: newPosition
        })
    });
    if (!response.ok) throw new Error('Falha ao mover o card.');
}