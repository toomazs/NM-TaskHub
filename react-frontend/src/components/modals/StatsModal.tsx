import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import { userDisplayNameMap } from '../../api/config';
import { Card } from '../../types/kanban';

type Priority = 'alta' | 'media' | 'baixa';
type ModalStatus = 'pendente' | 'solucionado' | 'naoSolucionado';
type SortByOption = 'newest' | 'oldest' | 'priority';

const priorityValueMap: Record<Priority, number> = {
    alta: 3,
    media: 2,
    baixa: 1,
};

const priorityDisplayMap: Record<Priority, string> = {
    alta: 'Alta',
    media: 'Média',
    baixa: 'Baixa',
};

const getRelevantDate = (card: Card, status: ModalStatus): Date | null => {
    const dateString = (status === 'solucionado' || status === 'naoSolucionado') 
        ? card.completed_at 
        : card.created_at;
    return dateString ? new Date(dateString) : null;
};

const sortCards = (cards: Card[], sortBy: SortByOption, status: ModalStatus): Card[] => {
    const sorted = [...cards];
    sorted.sort((a, b) => {
        switch (sortBy) {
            case 'newest': {
                const dateB = getRelevantDate(b, status);
                const dateA = getRelevantDate(a, status);
                return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
            }
            case 'oldest': {
                const dateA = getRelevantDate(a, status);
                const dateB = getRelevantDate(b, status);
                return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
            }
            case 'priority': {
                const priorityA = priorityValueMap[a.priority || 'media'] || 0;
                const priorityB = priorityValueMap[b.priority || 'media'] || 0;
                return priorityB - priorityA;
            }
            default:
                return 0;
        }
    });
    return sorted;
};


export function StatsModal(): React.ReactElement {
    const { isClosing, openModal, closeModal, modalProps } = useModal();
    const { columns, users, solucionadoId, naoSolucionadoId } = useBoard();
    const firstFilterRef = useRef<HTMLSelectElement>(null);

    const [userFilter, setUserFilter] = useState('all');
    const [periodFilter, setPeriodFilter] = useState('all');
    const [sortBy, setSortBy] = useState<SortByOption>('newest');

    useEffect(() => {
        if (!isClosing && firstFilterRef.current) {
            firstFilterRef.current.focus();
        }
    }, [isClosing]);
    
    const { status, title, icon } = useMemo(() => {
        let s: ModalStatus = 'pendente';
        
        if (modalProps.status === 'solucionado') {
            s = 'solucionado';
        } else if (modalProps.status === 'naoSolucionado' || modalProps.status === 'nao-solucionado') {
            s = 'naoSolucionado';
        }
        
        const statusMap: Record<ModalStatus, { title: string; icon: string }> = {
            solucionado: { title: 'Tarefas Solucionadas', icon: 'fa-check-circle' },
            naoSolucionado: { title: 'Tarefas Não Solucionadas', icon: 'fa-times-circle' },
            pendente: { title: 'Tarefas Pendentes', icon: 'fa-spinner' }
        };
        return { status: s, ...statusMap[s] };
    }, [modalProps.status]);

    const userMap = useMemo(() => new Map(users.map(user => [user.email, user])), [users]);

    const processedCards = useMemo(() => {
        const allCards = columns.flatMap(col => col.cards);
        
        let statusFiltered: Card[] = [];
        if (status === 'pendente') {
            statusFiltered = allCards.filter(c => c.column_id !== solucionadoId && c.column_id !== naoSolucionadoId);
        } else {
            const targetColumnId = status === 'solucionado' ? solucionadoId : naoSolucionadoId;
            statusFiltered = allCards.filter(c => c.column_id === targetColumnId);
        }
        
        const userFiltered = userFilter === 'all'
            ? statusFiltered
            : statusFiltered.filter(card => card.assigned_to === userFilter);

        const periodFiltered = periodFilter === 'all'
            ? userFiltered
            : userFiltered.filter(card => {
                const cardDate = getRelevantDate(card, status);
                if (!cardDate) return false;
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - parseInt(periodFilter, 10));
                return cardDate >= cutoffDate;
            });

        return sortCards(periodFiltered, sortBy, status);

    }, [columns, status, userFilter, periodFilter, sortBy, solucionadoId, naoSolucionadoId]);

    const handleCardClick = (card: Card) => {
        openModal('task', { card });
    };
    
    const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation();

    return (
        <div className={`modal ${isClosing ? 'closing' : ''}`} onClick={closeModal}>
            <div className="modal-content stats-modal" onClick={handleModalClick}>
                <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
                <div className="modal-header">
                    <h2><i className={`fas ${icon}`}></i> {title}</h2>
                    <div className="stats-filter-container">
                        <div className="filter-controls">
                            <label><i className="fas fa-filter"></i> Filtrar:</label>
                            <select ref={firstFilterRef} className="form-select" value={userFilter} onChange={e => setUserFilter(e.target.value)}>
                                <option value="all">Todos Colaboradores</option>
                                {users.map(u => (<option key={u.id} value={u.email}>{userDisplayNameMap[u.email] || u.username}</option>))}
                            </select>
                            <select className="form-select" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
                                <option value="all">Todo o Período</option>
                                <option value="7">Últimos 7 dias</option>
                                <option value="14">Últimos 14 dias</option>
                                <option value="30">Últimos 30 dias</option>
                            </select>
                            
                            <label><i className="fas fa-sort"></i> Ordenar:</label>
                            <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value as SortByOption)}>
                                <option value="newest">Mais Recentes</option>
                                <option value="oldest">Mais Antigos</option>
                                <option value="priority">Prioridade</option>
                            </select>
                        </div>
                        <div className="stats-total">Total: {processedCards.length}</div>
                    </div>
                </div>
                <div className="stats-body">
                    {processedCards.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                            Nenhuma tarefa encontrada com os filtros aplicados.
                        </p>
                    ) : (
                        processedCards.map(card => {
                            const assignedUser = userMap.get(card.assigned_to || '');
                            const assigneeDisplayName = assignedUser ? (userDisplayNameMap[assignedUser.email] || assignedUser.username) : "Não Atribuído";
                            const avatarInitial = assigneeDisplayName.charAt(0).toUpperCase();
                            const relevantDate = getRelevantDate(card, status);
                            
                            const formattedDate = relevantDate ? relevantDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/D';
                            
                            const priority = card.priority || 'media';

                            return (
                                <div key={card.id} className="stats-list-item" onClick={() => handleCardClick(card)}>
                                    <div className="task-title">{card.title}</div>
                                    <div className="task-meta">
                                        <div className="task-priority">
                                            <i className="fas fa-flag"></i>
                                            <span className={`priority-value priority-${priority}`}>
                                                {priorityDisplayMap[priority]}
                                            </span>
                                        </div>
                                        <div className="task-date">
                                            <i className="fas fa-calendar-alt"></i> {formattedDate}
                                        </div>
                                        <div className="task-assignee">
                                            <div className="assignee-avatar" style={{ backgroundImage: assignedUser?.avatar ? `url(${assignedUser.avatar})` : 'none' }}>
                                                {!assignedUser?.avatar && avatarInitial}
                                            </div>
                                            {assigneeDisplayName}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}