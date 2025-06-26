import React, { useState } from 'react';
import toast from 'react-hot-toast';

import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import { useAuth } from '../../contexts/AuthContext';
import * as boardService from '../../services/boards';
import { userDisplayNameMap } from '../../api/config';

export function ManageMembersModal() {
    const { closeModal, isClosing } = useModal();
    const { user } = useAuth();
    const { board, boardMembers, setBoardMembers } = useBoard();
    
    const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

    const handleRemoveMember = (memberId: string, memberName: string) => {
        if (!board?.id) return;

        toast((t) => (
            <span>
                Tem certeza que deseja remover <b>"{memberName}"</b> do quadro?
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <button
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={async () => {
                            toast.dismiss(t.id);
                            setRemovingIds(prev => new Set(prev).add(memberId));
                            try {
                                await boardService.removeMemberFromBoard(board.id, memberId);
                                setBoardMembers(prev => prev.filter(m => m.id !== memberId));
                                toast.success(`${memberName} removido.`);
                            } catch (error) {
                                toast.error(`Falha ao remover ${memberName}.`);
                                setRemovingIds(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(memberId);
                                    return newSet;
                                });
                            }
                        }}
                    >
                        Sim, Remover
                    </button>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => toast.dismiss(t.id)}>
                        Não
                    </button>
                </div>
            </span>
        ), { duration: 6000 });
    };

    return (
        <div className={`modal ${isClosing ? 'closing' : ''}`} onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
                <div className="modal-header"><h2><i className="fas fa-users-cog"></i> Gerenciar Membros</h2></div>
                <div className="modal-body" style={{ padding: '2rem', display: 'block' }}>
                    <div className="member-list">
                        {boardMembers.map(member => {
                           const isCurrentUserOwner = user?.id === board?.owner_id;
                           const isMemberOwnerInList = member.id === board?.owner_id;
                           const displayName = userDisplayNameMap[member.email] || member.username;
                           const isBeingRemoved = removingIds.has(member.id);

                           return (
                                <div key={member.id} className="member-list-item">
                                   <div className="member-info">
                                       <div className="user-avatar" style={{ backgroundImage: member.avatar ? `url(${member.avatar})` : 'none' }}>
                                          {!member.avatar && displayName.charAt(0).toUpperCase()}
                                       </div>
                                       <div className="member-details">
                                           <span className="user-name">{displayName}</span>
                                           {isMemberOwnerInList && <span className="user-role-tag">Dono</span>}
                                       </div>
                                   </div>
                                   {isCurrentUserOwner && !isMemberOwnerInList && (
                                       <button 
                                          className="btn btn-sm btn-remove-member" 
                                          onClick={() => handleRemoveMember(member.id, displayName)} 
                                          title="Remover membro"
                                          disabled={isBeingRemoved}
                                        >
                                           {isBeingRemoved ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-times"></i>}
                                       </button>
                                   )}
                               </div>
                           );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}