import React, { useState } from 'react';
import { useNotifications } from '../../contexts/NotificationsContext';
import { Notification } from '../../types/kanban';
import styles from './NotificationsDropdown.module.css';

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
            <div className={styles.invitationsDropdown} style={{ display: 'block' }}>
                <div className={styles.invitationItem}><p>Carregando...</p></div>
            </div>
        );
    }
    
    const unreadNotifications = notifications.filter(n => !n.is_read);
    const readNotifications = notifications.filter(n => n.is_read);

    return (
        <div className={styles.invitationsDropdown} style={{ display: 'block' }}>
            <div id="unreadNotificationsContainer">
                {unreadNotifications.length > 0 ? (
                    unreadNotifications.map(n => (
                        <div key={n.id} className={`${styles.invitationItem} ${n.type !== 'board_invitation' ? styles.clickable : ''}`} onClick={() => n.type !== 'board_invitation' && handleNotificationClick(n)}>
                            <p dangerouslySetInnerHTML={{ __html: n.message }} />
                            {n.type === 'board_invitation' && n.invitation_id && (
                                <div className={styles.invitationActions}>
                                    <button className={`btn ${styles.btnReject}`} onClick={(e) => { e.stopPropagation(); handleResponse(n.invitation_id!, n.id, false); }}>Rejeitar</button>
                                    <button className={`btn ${styles.btnAccept}`} onClick={(e) => { e.stopPropagation(); handleResponse(n.invitation_id!, n.id, true); }}>Aceitar</button>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className={styles.invitationItem}><p>Nenhuma notificação nova.</p></div>
                )}
            </div>

            {readNotifications.length > 0 && (
                <>
                    <div className={styles.readNotificationsToggle} onClick={() => setShowRead(!showRead)}>
                        <i className={`fas ${showRead ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                        <span>Lidas</span>
                    </div>
                    {showRead && (
                        <div id="readNotificationsContainer" className={`${styles.collapsibleContent} ${styles.active}`}>
                            {readNotifications.map(n => (
                                <div key={n.id} className={`${styles.invitationItem} ${styles.read} ${styles.clickable}`} onClick={() => handleNotificationClick(n)}>
                                    <p dangerouslySetInnerHTML={{ __html: n.message }} />
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}