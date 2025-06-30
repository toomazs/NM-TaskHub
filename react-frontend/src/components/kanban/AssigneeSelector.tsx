import React from 'react';
import { User } from '../../types/kanban';
import { userDisplayNameModalMap } from '../../api/config';
import styles from './AssigneeSelector.module.css';

interface AssigneeSelectorProps {
    users: User[];
    onSelect: (selectedValue: string | null) => void;
    currentSelection?: string | null;
    valueType?: 'id' | 'email';
    allowUnassign?: boolean;
    unassignText?: string;
}

export function AssigneeSelector({
    users,
    onSelect,
    currentSelection,
    valueType = 'email', 
    allowUnassign = true,
    unassignText = 'Ninguém'
}: AssigneeSelectorProps) {
    return (
        <div className={styles.assigneeSelectorGrid}>
            {allowUnassign && (
                 <div
                    className={`${styles.assigneeItem} ${!currentSelection ? styles.selected : ''}`}
                    onClick={() => onSelect(null)}
                    title={unassignText}
                >
                    <div className={`${styles.assigneeItemAvatar} ${styles.assigneeItemNaAvatar}`}>
                        <i className="fas fa-ban"></i>
                    </div>
                    <div className={styles.assigneeItemName}>{unassignText}</div>
                </div>
            )}
           
            {users.map(user => {
                const displayName = userDisplayNameModalMap[user.email] || user.username;
                const avatarInitial = displayName.charAt(0).toUpperCase();
                
                const valueToReturn = valueType === 'id' ? user.id : user.email;
                const isSelected = currentSelection === valueToReturn;

                return (
                    <div
                        key={user.id}
                        className={`${styles.assigneeItem} ${isSelected ? styles.selected : ''}`}
                        onClick={() => onSelect(valueToReturn)}
                        title={`Atribuir para ${displayName}`}
                    >
                        <div
                            className={styles.assigneeItemAvatar}
                            style={{ backgroundImage: user.avatar ? `url(${user.avatar})` : 'none' }}
                        >
                            {!user.avatar && avatarInitial}
                        </div>
                        <div className={styles.assigneeItemName}>{displayName}</div>
                    </div>
                );
            })}
        </div>
    );
}