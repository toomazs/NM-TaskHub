import React, { useState, useMemo } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import { userDisplayNameMap } from '../../api/config';
import { Card } from '../../types/kanban';
import { FaTimes, FaCheckCircle, FaExclamationCircle, FaSpinner, FaUsers, FaChevronLeft, FaChevronRight, FaFlag, FaCalendarAlt, FaUser, FaEdit } from 'react-icons/fa';
import styles from './StatsModal.module.css';

type Priority = 'alta' | 'media' | 'baixa';
type ModalStatus = 'pendente' | 'solucionado' | 'naoSolucionado';
type SortByOption = 'newest' | 'oldest' | 'priority';

const ITEMS_PER_PAGE = 8;

const priorityValueMap: Record<Priority, number> = { alta: 3, media: 2, baixa: 1 };
const priorityDisplayMap: Record<Priority, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const getRelevantDate = (card: Card, status: ModalStatus): Date | null => {
    const dateString = (status === 'solucionado' || status === 'naoSolucionado') ? card.completed_at : card.created_at;
    return dateString ? new Date(dateString) : null;
};

const sortCards = (cards: Card[], sortBy: SortByOption, status: ModalStatus): Card[] => {
    return [...cards].sort((a, b) => {
        switch (sortBy) {
            case 'newest': return (getRelevantDate(b, status)?.getTime() || 0) - (getRelevantDate(a, status)?.getTime() || 0);
            case 'oldest': return (getRelevantDate(a, status)?.getTime() || 0) - (getRelevantDate(b, status)?.getTime() || 0);
            case 'priority': return (priorityValueMap[b.priority as Priority] || 0) - (priorityValueMap[a.priority as Priority] || 0);
            default: return 0;
        }
    });
};

export function StatsModal(): React.ReactElement {
    const { openModal, closeModal, modalProps, isClosing } = useModal();
    const { columns, users, solucionadoId, naoSolucionadoId } = useBoard();
    
    const [userFilter, setUserFilter] = useState('all');
    const [sortBy, setSortBy] = useState<SortByOption>('newest');
    const [periodFilter, setPeriodFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);

    const { status, title } = useMemo(() => {
        let s: ModalStatus = 'pendente';
        if (modalProps.status === 'solucionado') s = 'solucionado';
        else if (modalProps.status === 'naoSolucionado' || modalProps.status === 'nao-solucionado') s = 'naoSolucionado';
        
        const statusMap: Record<ModalStatus, { title: string }> = {
            solucionado: { title: 'Tarefas Solucionadas' },
            naoSolucionado: { title: 'Tarefas Não Solucionadas' },
            pendente: { title: 'Tarefas Pendentes' }
        };
        return { status: s, ...statusMap[s] };
    }, [modalProps.status]);

    const userMap = useMemo(() => new Map(users.map(user => [user.email, user])), [users]);

    const processedCards = useMemo(() => {
        const allCards = columns.flatMap(col => col.cards);
        let statusFiltered: Card[];
        if (status === 'pendente') {
            statusFiltered = allCards.filter(c => c.column_id !== solucionadoId && c.column_id !== naoSolucionadoId);
        } else {
            const targetColumnId = status === 'solucionado' ? solucionadoId : naoSolucionadoId;
            statusFiltered = allCards.filter(c => c.column_id === targetColumnId);
        }
        
        const userFiltered = userFilter === 'all' ? statusFiltered : statusFiltered.filter(card => card.assigned_to === userFilter);

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

    const totalPages = Math.ceil(processedCards.length / ITEMS_PER_PAGE);
    const paginatedCards = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return processedCards.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [processedCards, currentPage]);

    const handleCardClick = (card: Card) => {
        closeModal();
        setTimeout(() => openModal('task', { card }), 350);
    };

    return (
        <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={closeModal}>
            <div className={`${styles.modalContent}`} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>
                        <i className={`fas ${modalProps.status === 'solucionado' ? 'fa-check-circle' : modalProps.status === 'nao-solucionado' ? 'fa-times-circle' : 'fa-clock'}`}></i> 
                        {title}
                        <span className={styles.statsCount}><FaUsers /> {processedCards.length}</span>
                    </h2>
                    <button className={styles.modalClose} onClick={closeModal}><FaTimes /></button>
                </div>
                
                <div className={styles.statsBody}>
                    <div className={styles.statsSummary}>
                        <div className={styles.summaryItem}><i className="fas fa-filter"></i>
                            <select className={styles.formSelect} value={userFilter} onChange={e => setUserFilter(e.target.value)}>
                                <option value="all">Todos Colaboradores</option>
                                {users.map(u => (<option key={u.id} value={u.email}>{userDisplayNameMap[u.email] || u.username}</option>))}
                            </select>
                        </div>
                        <div className={styles.summaryItem}><i className="fas fa-calendar-alt"></i>
                            <select className={styles.formSelect} value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
                                <option value="all">Todo o Período</option>
                                <option value="7">Últimos 7 dias</option>
                                <option value="14">Últimos 14 dias</option>
                                <option value="30">Últimos 30 dias</option>
                            </select>
                        </div>
                        <div className={styles.summaryItem}><i className="fas fa-sort"></i>
                             <select className={styles.formSelect} value={sortBy} onChange={e => setSortBy(e.target.value as SortByOption)}>
                                <option value="newest">Mais Recentes</option>
                                <option value="oldest">Mais Antigos</option>
                                <option value="priority">Prioridade</option>
                            </select>
                        </div>
                    </div>

                    {paginatedCards.length === 0 ? (
                        <div className={styles.emptyState}><FaExclamationCircle className={styles.emptyIcon} /><p>Nenhuma tarefa encontrada.</p></div>
                    ) : (
                        <div className={styles.statsList}>
                            {paginatedCards.map(card => {
                                const assignedUser = userMap.get(card.assigned_to || '');
                                const assigneeDisplayName = assignedUser ? (userDisplayNameMap[assignedUser.email] || assignedUser.username) : "Não Atribuído";
                                const avatarInitial = assigneeDisplayName.charAt(0).toUpperCase();
                                const relevantDate = getRelevantDate(card, status);
                                const priority = (card.priority as Priority) || 'media';
                                
                                return (
                                    <div key={card.id} className={styles.statsListItem} onClick={() => handleCardClick(card)}>
                                        <div className={styles.itemHeader}>
                                            <div className={styles.taskTitle}><i className="fas fa-user"></i>{card.title}</div>
                                            <div className={styles.itemActions}><i className="fa-solid fa-pen-to-square"></i></div>
                                        </div>
                                        <div className={styles.taskMeta}>
                                            <div className={styles.metaItem}><FaFlag className={`${styles.priorityValue} ${styles[`priority-${priority}`]}`}/>{priorityDisplayMap[priority]}</div>•
                                            {relevantDate && <div className={styles.metaItem}><i className="fa-solid fa-calendar-check"></i> {relevantDate.toLocaleDateString('pt-BR')}</div>}•
                                            {assignedUser && (
                                                <div className={styles.metaItem}>
                                                    <div className={styles.metaAvatar} style={{ backgroundImage: assignedUser.avatar ? `url(${assignedUser.avatar})` : 'none' }}>
                                                        {!assignedUser.avatar && avatarInitial}
                                                    </div>
                                                    {assigneeDisplayName}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {totalPages > 1 && (
                        <div className={styles.paginationContainer}>
                             <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className={styles.paginationBtn}> <FaChevronLeft /> Anterior </button>
                             <div className={styles.paginationInfo}><span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span></div>
                             <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className={styles.paginationBtn}> Próxima <FaChevronRight /> </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}