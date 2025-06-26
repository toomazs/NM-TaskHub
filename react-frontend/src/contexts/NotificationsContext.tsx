import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as notificationService from '../services/notifications';
import { Notification } from '../types/kanban'; 

interface NotificationsContextType {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    fetchNotifications: () => Promise<void>;
    respondToInvitation: (invitationId: number, notificationId: number, accept: boolean) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        try {
            const fetchedNotifications = await notificationService.getNotifications();
            setNotifications(fetchedNotifications);
        } catch (error) {
            console.error("Erro ao buscar notificações", error);
            toast.error("Não foi possível carregar as notificações.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        setIsLoading(true);
        fetchNotifications();
    }, [fetchNotifications]);

    const respondToInvitation = async (invitationId: number, notificationId: number, accept: boolean) => {
        try {
            await notificationService.respondToInvitation(invitationId, notificationId, accept);
            toast.success(accept ? "Convite aceito!" : "Convite rejeitado.");
            fetchNotifications(); 
        } catch (error) {
            console.error("Falha ao responder ao convite", error);
            toast.error("Falha ao responder ao convite.");
        }
    };

    const markAllAsRead = async () => {
        const unreadNotifications = notifications.filter(n => !n.is_read);
        if (unreadNotifications.length === 0) return;

        const newNotificationsState = notifications.map(n => {
            if (n.type === 'board_invitation' && n.invitation_status === 'pending') {
                return n;
            }
            return { ...n, is_read: true };
        });

        setNotifications(newNotificationsState);

        try {
            await notificationService.markAllNotificationsAsRead();
        } catch (error) {
            console.error("Falha ao marcar notificações como lidas", error);
            fetchNotifications(); 
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const value = {
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        respondToInvitation,
        markAllAsRead
    };

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
}

export const useNotifications = () => {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotifications deve ser usado dentro de um NotificationsProvider');
    }
    return context;
};

