import { api } from '../api/api';
import { Board, User } from '../types/kanban';

export async function getPublicBoards(): Promise<Board[]> {
    const response = await api('/boards/public');
    if (!response.ok) throw new Error('Falha ao buscar quadros públicos');
    return response.json();
}

export async function getPrivateBoards(): Promise<Board[]> {
    const response = await api('/boards/private');
    if (!response.ok) throw new Error('Falha ao buscar quadros privados');
    return response.json();
}

export async function createBoard(boardData: Partial<Board>): Promise<Board> {
    const response = await api('/boards', {
        method: 'POST',
        body: JSON.stringify(boardData),
    });
    if (!response.ok) throw new Error('Falha ao criar quadro');
    return response.json();
}

export async function deleteBoard(boardId: number): Promise<void> {
    const response = await api(`/boards/${boardId}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Falha ao excluir quadro');
}

export async function getBoardMembers(boardId: number): Promise<User[]> {
    const response = await api(`/boards/${boardId}/members`);
    if (!response.ok) throw new Error('Falha ao buscar membros');
    return response.json();
}

export async function removeMemberFromBoard(boardId: number, memberId: string): Promise<void> {
    const response = await api(`/boards/${boardId}/members/${memberId}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Falha ao remover membro');
}

export async function getInvitableUsers(boardId: number): Promise<User[]> {
    const response = await api(`/boards/${boardId}/invitable-users`);
    if (!response.ok) throw new Error('Falha ao buscar usuários para convite');
    return response.json();
}

export async function inviteUserToBoard(boardId: number, inviteeId: string): Promise<void> {
    const response = await api(`/boards/${boardId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ invitee_id: inviteeId }),
    });
    if (!response.ok) throw new Error('Falha ao convidar usuário');
}

export async function leaveBoard(boardId: number): Promise<void> {
    const response = await api(`/boards/${boardId}/leave`, {
        method: 'POST',
    });
    if (!response.ok) throw new Error('Falha ao sair do quadro');
}
