import { api } from '../api.js';

export async function getNotifications() {
    return await api('/notifications');
}

export async function markNotificationAsRead(notificationId) {
    return await api(`/notifications/${notificationId}/read`, { method: 'POST' });
}

export async function respondToInvitation(invitationId, notificationId, accept) {
    return await api(`/invitations/${invitationId}/respond?notification_id=${notificationId}`, {
        method: 'POST',
        body: JSON.stringify({ accept })
    });
}

export async function markAllNotificationsAsRead() {
    return await api('/notifications/mark-all-as-read', { method: 'POST' });
}