import React from 'react';
import { userDisplayNameModalMap } from '../../api/config'; 
import { User } from '../../types/kanban'; 

interface AssigneeSelectorProps {
    users: User[];
    selectedAssignee: string | null;
    onSelect: (assignee: string | null) => void;
}

export function AssigneeSelector({ users, selectedAssignee, onSelect }: AssigneeSelectorProps) {
    return (
        <div className="assignee-selector-grid">
            <div
                className={`assignee-item ${!selectedAssignee ? 'selected' : ''}`}
                onClick={() => onSelect(null)}
            >
                <div className="assignee-item-avatar assignee-item-na-avatar">
                    <i className="fas fa-ban"></i>
                </div>
                <div className="assignee-item-name">Ninguém</div>
            </div>

            {users.map(user => {
                const displayName = userDisplayNameModalMap[user.email] || user.username;
                const avatarInitial = displayName.charAt(0).toUpperCase();

                return (
                    <div
                        key={user.id}
                        className={`assignee-item ${selectedAssignee === user.email ? 'selected' : ''}`}
                        onClick={() => onSelect(user.email)}
                    >
                        <div
                            className="assignee-item-avatar"
                            style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : 'none' }}
                        >
                            {!user.avatar && avatarInitial}
                        </div>
                        <div className="assignee-item-name">{displayName}</div> 
                    </div>
                );
            })}
        </div>
    );
}