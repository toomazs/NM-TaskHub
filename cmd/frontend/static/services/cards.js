import { api } from '../api.js';

export async function getCardsForColumn(columnId) {
    return await api(`/columns/${columnId}/cards`);
}

export async function createCard(columnId, cardData) {
    return await api(`/columns/${columnId}/cards`, {
        method: 'POST',
        body: JSON.stringify(cardData)
    });
}

export async function updateCard(cardId, cardData) {
    return await api(`/cards/${cardId}`, {
        method: 'PUT',
        body: JSON.stringify(cardData)
    });
}

export async function deleteCard(cardId) {
    return await api(`/cards/${cardId}`, {
        method: 'DELETE'
    });
}

export async function reorderCardsInColumn(columnId, orderedCardIds) {
    return await api('/cards/reorder', {
        method: 'POST',
        body: JSON.stringify({
            column_id: parseInt(columnId, 10),
            ordered_card_ids: orderedCardIds
        })
    });
}