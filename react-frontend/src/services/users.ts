import { api } from '../api/api';
import type { User } from '../types/kanban';

export async function getUsers(): Promise<User[]> {
    const response = await api('/users');
    if (!response.ok) throw new Error('Falha ao buscar usuários.');
    return response.json();
}

export async function uploadAvatar(formData: FormData): Promise<{ avatar_url: string }> {
    const response = await api('/user/avatar', {
        method: 'POST',
        body: formData
    });
    if (!response.ok) throw new Error('Falha no upload do avatar.');
    return response.json();
}