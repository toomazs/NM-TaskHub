import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';

import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import { User } from '../../types/kanban';
import * as boardService from '../../services/boards';
import { Loader } from '../ui/Loader';
import { userDisplayNameMap } from '../../api/config';
import styles from './InviteUserModal.module.css';

export function InviteUserModal() {
    const { closeModal, isClosing } = useModal();
    const { board } = useBoard();
    const [invitableUsers, setInvitableUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingInviteIds, setPendingInviteIds] = useState<Set<string>>(new Set());
    const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!board?.id) return;

        const fetchUsers = async () => {
            setIsLoading(true);
            try {
                const users = await boardService.getInvitableUsers(board.id);
                setInvitableUsers(users);
            } catch (error) {
                console.error('Erro ao buscar usuários:', error);
                toast.error("Não foi possível carregar os usuários.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, [board?.id]);

    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) {
            return invitableUsers;
        }
        
        const searchLower = searchTerm.toLowerCase().trim();
        return invitableUsers.filter(user => {
            const displayName = userDisplayNameMap[user.email] || user.username || '';
            return (
                displayName.toLowerCase().includes(searchLower) ||
                user.email.toLowerCase().includes(searchLower)
            );
        });
    }, [invitableUsers, searchTerm]);
    
    const handleInvite = useCallback(async (userId: string) => {
        if (!board?.id || pendingInviteIds.has(userId) || invitedIds.has(userId)) return;

        setPendingInviteIds(prev => new Set(prev).add(userId));

        try {
            await boardService.inviteUserToBoard(board.id, userId);
            setInvitedIds(prev => new Set(prev).add(userId));
            toast.success("Convite enviado com sucesso!");
        } catch (error: any) {
            console.error('Erro ao enviar convite:', error);
            const errorMessage = error?.response?.data?.message || error?.message || "Falha ao enviar convite.";
            toast.error(errorMessage);
        } finally {
            setPendingInviteIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        }
    }, [board?.id, pendingInviteIds, invitedIds]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    }, [closeModal]);

    const handleModalClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            closeModal();
        }
    }, [closeModal]);

    const getButtonState = useCallback((userId: string) => {
        const isPending = pendingInviteIds.has(userId);
        const isInvited = invitedIds.has(userId);
        
        if (isPending) {
            return {
                disabled: true,
                className: `${styles.btn} ${styles.btnPrimary} ${styles.btnInvite} ${styles.pending}`,
                icon: 'fas fa-spinner fa-spin',
                text: 'Enviando...'
            };
        }
        
        if (isInvited) {
            return {
                disabled: true,
                className: `${styles.btn} ${styles.btnPrimary} ${styles.btnInvite} ${styles.invited}`,
                icon: 'fas fa-check',
                text: 'Convidado'
            };
        }
        
        return {
            disabled: false,
            className: `${styles.btn} ${styles.btnPrimary} ${styles.btnInvite}`,
            icon: 'fas fa-paper-plane',
            text: 'Convidar'
        };
    }, [pendingInviteIds, invitedIds]);

    if (!board?.id) {
        return null;
    }

    return (
        <div 
            className={`${styles.modal} ${isClosing ? styles.closing : ''}`} 
            onClick={handleModalClick}
            onKeyDown={handleKeyPress}
            tabIndex={-1}
            role="dialog"
            aria-labelledby="modal-title"
            aria-modal="true"
        >
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <button 
                    className={styles.modalClose} 
                    onClick={closeModal}
                    aria-label="Fechar modal"
                    type="button"
                >
                    <i className="fas fa-times" aria-hidden="true"></i>
                </button>
                
                <div className={styles.modalHeader}>
                    <h2 id="modal-title">
                        <i className="fas fa-user-plus" aria-hidden="true"></i> 
                        Convidar para o Quadro
                    </h2>
                </div>
                
                <div className={styles.modalBody}>
                    <div className={styles.searchContainer}>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className={styles.formInput}
                            placeholder="Buscar usuário por nome ou email..."
                            aria-label="Buscar usuário"
                            autoFocus
                        />
                        {searchTerm && (
                            <button
                                className={styles.clearSearch}
                                onClick={() => setSearchTerm('')}
                                aria-label="Limpar busca"
                                type="button"
                            >
                                <i className="fas fa-times" aria-hidden="true"></i>
                            </button>
                        )}
                    </div>

                    <div className={styles.resultsContainer}>
                        {searchTerm.trim() && (
                            <p className={styles.resultsCount}>
                                {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''} encontrado{filteredUsers.length !== 1 ? 's' : ''}
                            </p>
                        )}

                        <div className={styles.invitableUsersGrid}>
                            {isLoading && (
                                <div className={styles.loadingContainer}>
                                    <Loader />
                                </div>
                            )}
                            
                            {!isLoading && filteredUsers.length === 0 && (
                                <div className={styles.emptyState}>
                                    <i className="fas fa-search" aria-hidden="true"></i>
                                    <p className={styles.emptyStateText}>
                                        {searchTerm.trim() 
                                            ? 'Nenhum usuário encontrado para a busca.' 
                                            : 'Nenhum usuário disponível para convidar.'
                                        }
                                    </p>
                                    {searchTerm.trim() && (
                                        <button
                                            className={`${styles.btn} ${styles.btnSecondary}`}
                                            onClick={() => setSearchTerm('')}
                                            type="button"
                                        >
                                            Limpar busca
                                        </button>
                                    )}
                                </div>
                            )}
                            
                            {!isLoading && filteredUsers.map(user => {
                                const displayName = userDisplayNameMap[user.email] || user.username || 'Usuário';
                                const avatarInitial = displayName.charAt(0).toUpperCase();
                                const buttonState = getButtonState(user.id);

                                return (
                                    <div key={user.id} className={styles.invitableUserItem}>
                                        <div 
                                            className={styles.userAvatar} 
                                            style={{ 
                                                backgroundImage: user.avatar ? `url(${user.avatar})` : 'none' 
                                            }}
                                            title={displayName}
                                        >
                                            {!user.avatar && avatarInitial}
                                        </div>
                                        
                                        <div className={styles.userInfo}>
                                            <div className={styles.userName} title={displayName}>
                                                {displayName}
                                            </div>
                                            {user.email && (
                                                <div className={styles.userEmail} title={user.email}>
                                                    {user.email}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <button
                                            className={buttonState.className}
                                            onClick={() => handleInvite(user.id)}
                                            disabled={buttonState.disabled}
                                            type="button"
                                            aria-label={`${buttonState.text} ${displayName}`}
                                        >
                                            <i className={buttonState.icon} aria-hidden="true"></i>
                                            {buttonState.text}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}