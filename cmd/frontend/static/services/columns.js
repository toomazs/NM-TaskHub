import { api } from '../api.js';

export async function getColumnsForBoard(boardId) {
    return await api(`/boards/${boardId}/columns`);
}

export async function createColumn(columnData) {
    return await api('/columns', {
        method: 'POST',
        body: JSON.stringify(columnData)
    });
}

export async function deleteColumn(columnId) {
    return await api(`/columns/${columnId}`, {
        method: 'DELETE'
    });
}