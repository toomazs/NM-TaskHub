import { api } from '../api/api';
import { Column } from '../types/kanban';

export async function getColumnsForBoard(boardId: number): Promise<Omit<Column, 'cards'>[]> {
    const response = await api(`/boards/${boardId}/columns`);
    if (!response.ok) throw new Error('Falha ao buscar colunas');
    return response.json();
}

export async function createColumn(columnData: { title: string, color: string, board_id: number }): Promise<Column> {
    const response = await api('/columns', {
        method: 'POST',
        body: JSON.stringify(columnData),
    });
    if (!response.ok) throw new Error('Falha ao criar coluna');
    return response.json();
}

export async function updateColumn(columnId: number, columnData: { title: string, color: string }): Promise<Column> {
    const response = await api(`/columns/${columnId}`, {
        method: 'PUT',
        body: JSON.stringify(columnData),
    });
    if (!response.ok) throw new Error('Falha ao atualizar coluna');
    return response.json();
}

export async function deleteColumn(columnId: number): Promise<void> {
    const response = await api(`/columns/${columnId}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Falha ao excluir coluna');
}

export async function reorderColumns(boardId: number, orderedColumnIds: number[]): Promise<void> {
    const response = await api(`/boards/${boardId}/columns/reorder`, {
        method: 'POST',
        body: JSON.stringify({ ordered_column_ids: orderedColumnIds }),
    });

    if (!response.ok) {
        throw new Error('Falha ao reordenar as colunas');
    }
}