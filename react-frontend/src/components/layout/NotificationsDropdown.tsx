import React, { useState } from 'react';
import { useNotifications } from '../../contexts/NotificationsContext';
import { Notification } from '../../types/kanban';

export function NotificationsDropdown() {
    const { notifications, respondToInvitation, isLoading } = useNotifications();
    const [showRead, setShowRead] = useState(false);

    const handleResponse = (invitationId: number, notificationId: number, accept: boolean) => {
        respondToInvitation(invitationId, notificationId, accept);
    };

    const handleNotificationClick = (notification: Notification) => {
        console.log("Navegando para a notificação:", notification);
    };

    if (isLoading) {
        return (
            <div className="invitations-dropdown" style={{ display: 'block' }}>
                <div className="invitation-item"><p>Carregando...</p></div>
            </div>
        );
    }
    
    const unreadNotifications = notifications.filter(n => !n.is_read);
    const readNotifications = notifications.filter(n => n.is_read);

    return (
        <div className="invitations-dropdown" style={{ display: 'block' }}>
            <div id="unreadNotificationsContainer">
                {unreadNotifications.length > 0 ? (
                    unreadNotifications.map(n => (
                        <div key={n.id} className={`invitation-item ${n.type !== 'board_invitation' ? 'clickable' : ''}`} onClick={() => n.type !== 'board_invitation' && handleNotificationClick(n)}>
                            <p>{n.message}</p>
                            {n.type === 'board_invitation' && n.invitation_id && (
                                <div className="invitation-actions">
                                    <button className="btn btn-secondary btn-reject" onClick={(e) => { e.stopPropagation(); handleResponse(n.invitation_id!, n.id, false); }}>Rejeitar</button>
                                    <button className="btn btn-primary btn-accept" onClick={(e) => { e.stopPropagation(); handleResponse(n.invitation_id!, n.id, true); }}>Aceitar</button>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="invitation-item"><p>Nenhuma notificação nova.</p></div>
                )}
            </div>

            {readNotifications.length > 0 && (
                <>
                    <div className="read-notifications-toggle" onClick={() => setShowRead(!showRead)}>
                        <i className={`fas ${showRead ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                        <span>Lidas</span>
                    </div>
                    {showRead && (
                        <div id="readNotificationsContainer" className="collapsible-content active">
                            {readNotifications.map(n => (
                                <div key={n.id} className="invitation-item read clickable" onClick={() => handleNotificationClick(n)}>
                                    <p>{n.message}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}