import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import { useMemo } from 'react';

import type { Card as CardType } from '../../types/kanban';
import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import { userDisplayNameMap } from '../../api/config';
import * as cardService from '../../services/cards';
import styles from './KanbanCard.module.css'; 

interface CardProps {
  card: CardType;
  isOverlay?: boolean;
}

export function KanbanCard({ card, isOverlay = false }: CardProps) {
  const { openModal } = useModal();
  const { board, users, removeCard, updateCard, solucionadoId, naoSolucionadoId, isColumnDragging } = useBoard();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "Card", card },
    disabled: isColumnDragging,
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const isCompleted = useMemo(() => {
    if (!board) return false;
    if (board.is_public) {
      return card.column_id === solucionadoId;
    }
    return !!card.completed_at;
  }, [card, board, solucionadoId]);
  
  const cardStatus = useMemo(() => {
    let isOverdue = false;
    let isDueToday = false;
    let formattedDate = '';
    let statusIcon = null;

    const isConsideredDone = isCompleted || (board?.is_public && card.column_id === naoSolucionadoId);

    if (card.due_date && !isConsideredDone) {
        const now = new Date();
        const dueDate = new Date(card.due_date);
        
        formattedDate = dueDate.toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        });

        if (now > dueDate) {
            isOverdue = true;
            statusIcon = <i className={`fas fa-exclamation-triangle ${styles.overdueIcon}`}></i>;
        } else {
            const warningTime = new Date(dueDate.getTime() - (1 * 60 * 60 * 1000));
            if (now >= warningTime) {
                isDueToday = true;
                statusIcon = <i className={`fas fa-clock ${styles.dueTodayIcon}`}></i>;
            } else {
                statusIcon = <i className="fas fa-calendar"></i>;
            }
        }
    }
    
    return {
      formattedDate,
      statusIcon,
      statusClass: isOverdue ? styles.overdue : (isDueToday ? styles.dueToday : ''),
    };
  }, [card.due_date, card.column_id, naoSolucionadoId, isCompleted, board]);
  
  const priorityClass = {
    baixa: styles.priorityBaixa,
    media: styles.priorityMedia,
    alta: styles.priorityAlta,
  }[card.priority || 'media'];

  const cardClassName = [
    styles.task,
    priorityClass,
    cardStatus.statusClass,
    isDragging ? styles.dragging : '',
    isOverlay ? styles.isOverlay : '',
    isCompleted ? styles.completed : '',
  ].filter(Boolean).join(' ');

  const assignedUser = useMemo(() => 
    users.find(u => u.username === card.assigned_to || u.email === card.assigned_to), 
    [users, card.assigned_to]
  );
  
  const assigneeDisplayName = assignedUser ? (userDisplayNameMap[assignedUser.email] || assignedUser.username) : "N/A";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast((t) => (
        <span>
            Excluir a tarefa <strong>"{card.title}"</strong>?
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                <button
                    className="btn btn-danger" style={{flex: 1}}
                    onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                            await cardService.deleteCard(card.id);
                            removeCard(card.id, card.column_id);
                            toast.success("Tarefa excluída!");
                        } catch (error) { toast.error("Falha ao excluir a tarefa."); }
                    }}
                >
                    Sim
                </button>
                <button className="btn btn-secondary" style={{flex: 1}} onClick={() => toast.dismiss(t.id)}>Não</button>
            </div>
        </span>
    ));
  };

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!board) return;
    if (board.is_public && isCompleted) return;

    let updatedCardData: CardType;
    let successMessage = "Tarefa concluída!";

    if (board.is_public) {
      if (!solucionadoId) {
        toast.error("Coluna 'Solucionado' não configurada.");
        return;
      }
      updatedCardData = { 
        ...card, 
        column_id: solucionadoId,
        completed_at: new Date().toISOString()
      };
    } else {
      const isCurrentlyCompleted = !!card.completed_at;
      updatedCardData = { 
        ...card, 
        completed_at: isCurrentlyCompleted ? null : new Date().toISOString() 
      };
      if (isCurrentlyCompleted) {
        successMessage = "Tarefa reaberta!";
      }
    }

    try {
      await cardService.updateCard(card.id, updatedCardData);
      updateCard(updatedCardData);
      toast.success(successMessage);
    } catch (error) {
      toast.error("Não foi possível atualizar a tarefa.");
    }
  };

  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        {...attributes} 
        {...listeners} 
        className={cardClassName} 
        onClick={() => openModal('task', { card: card })}
    >
      <div className={styles.taskActions}>
        {(!board?.is_public || !isCompleted) && (
           <button 
               className={`${styles.actionBtn} ${styles.completeBtn}`} 
               title={!board?.is_public && isCompleted ? 'Reabrir Tarefa' : 'Concluir Tarefa'} 
               onClick={handleToggleComplete}
           >
              <i className={`fas ${!board?.is_public && isCompleted ? 'fa-undo' : 'fa-check'}`}></i>
           </button>
        )}
        <button className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Excluir Tarefa" onClick={handleDelete}>
            <i className="fas fa-trash"></i>
        </button>
      </div>
      <div className={styles.taskHeader}>
        <div className={`${styles.taskTitle} ${isCompleted ? styles.completedTitle : ''}`}>{card.title}</div>
      </div>
      <div className={styles.taskMeta}>

        {assignedUser ? (
            <div className={styles.taskAssignee}>
                <div className={styles.assigneeAvatar} style={{ backgroundImage: assignedUser.avatar ? `url(${assignedUser.avatar})` : 'none' }}>
                    {!assignedUser.avatar && (assigneeDisplayName.charAt(0).toUpperCase())}
                </div>
                <span>{assigneeDisplayName}</span>
            </div>
        ) : (
            <div></div> 
        )}
        
        <div className={styles.taskDueInfo}>
            <span className={styles.taskDateText}>{cardStatus.formattedDate}</span>
            <div className={styles.taskStatusIcons}>{cardStatus.statusIcon}</div>
        </div>
      </div>
    </div>
  );
}