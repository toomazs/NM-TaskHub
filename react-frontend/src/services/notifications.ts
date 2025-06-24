import { api } from '../api/api';
import type { Notification } from '../types/kanban';

export async function getNotifications(): Promise<Notification[]> {
    const response = await api('/notifications');
    if (!response.ok) throw new Error('Falha ao buscar notificações.');
    return response.json();
}

export async function markNotificationAsRead(notificationId: number): Promise<void> {
    const response = await api(`/notifications/${notificationId}/read`, { method: 'POST' });
    if (!response.ok) throw new Error('Falha ao marcar notificação como lida.');
}


export async function respondToInvitation(invitationId: number, notificationId: number, accept: boolean): Promise<void> {
    const response = await api(`/invitations/${invitationId}/respond?notification_id=${notificationId}`, {
        method: 'POST',
        body: JSON.stringify({ accept })
    });
    if (!response.ok) throw new Error('Falha ao responder ao convite.');
}


export async function markAllNotificationsAsRead(): Promise<void> {
    const response = await api('/notifications/mark-all-as-read', { method: 'POST' });
    if (!response.ok) throw new Error('Falha ao marcar todas as notificações como lidas.');
}