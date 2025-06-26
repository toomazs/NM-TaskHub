import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';

import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import { User } from '../../types/kanban';
import * as boardService from '../../services/boards';
import { Loader } from '../ui/Loader';
import { userDisplayNameMap } from '../../api/config';

export function InviteUserModal() {
    const { closeModal, isClosing } = useModal();
    const { board } = useBoard();
    const [invitableUsers, setInvitableUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingInviteIds, setPendingInviteIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!board?.id) return;

        const fetchUsers = async () => {
            setIsLoading(true);
            try {
                const users = await boardService.getInvitableUsers(board.id);
                setInvitableUsers(users);
            } catch (error) {
                toast.error("Não foi possível carregar os usuários.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, [board?.id]);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) {
            return invitableUsers;
        }
        return invitableUsers.filter(user =>
            (userDisplayNameMap[user.email] || user.username).toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [invitableUsers, searchTerm]);
    
    const handleInvite = useCallback(async (userId: string) => {
        if (!board?.id) return;

        setPendingInviteIds(prev => new Set(prev).add(userId));

        try {
            await boardService.inviteUserToBoard(board.id, userId);
            toast.success("Convite enviado!");
        } catch (error: any) {
            toast.error(error.message || "Falha ao enviar convite.");
            setPendingInviteIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        }
    }, [board?.id]);

     return (
        <div className={`modal ${isClosing ? 'closing' : ''}`} onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
                <div className="modal-header"><h2><i className="fas fa-user-plus"></i> Convidar para o Quadro</h2></div>
                <div className="modal-body" style={{ padding: '2rem', display: 'block' }}>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="form-input"
                        placeholder="Buscar usuário por nome ou email..."
                        style={{ marginBottom: '1rem' }}
                    />
                    <div className="invitable-users-grid">
                        {isLoading && <Loader />}
                        {!isLoading && filteredUsers.length === 0 && (
                            <p className="text-muted text-center" style={{ gridColumn: '1 / -1' }}>
                                Nenhum usuário encontrado para convidar.
                            </p>
                        )}
                        {!isLoading && filteredUsers.map(user => {
                            const displayName = userDisplayNameMap[user.email] || user.username;
                            const avatarInitial = displayName.charAt(0).toUpperCase();
                            const isInvited = pendingInviteIds.has(user.id);

                            return (
                                <div key={user.id} className="invitable-user-item">
                                    <div className="user-avatar" style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : 'none' }}>
                                        {!user.avatar && avatarInitial}
                                    </div>
                                    <div className="user-name">{displayName}</div>
                                    <button
                                        className={`btn btn-primary btn-invite ${isInvited ? 'invited' : ''}`}
                                        onClick={() => handleInvite(user.id)}
                                        disabled={isInvited}
                                    >
                                        {isInvited 
                                            ? <><i className="fas fa-check"></i> Convidado</> 
                                            : <><i className="fas fa-paper-plane"></i> Convidar</>
                                        }
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}