import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import { useMemo } from 'react';

import type { Card as CardType } from '../../types/kanban';
import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import { userDisplayNameMap } from '../../api/config';
import * as cardService from '../../services/cards';

interface CardProps {
  card: CardType;
  isOverlay?: boolean;
}

export function KanbanCard({ card, isOverlay = false }: CardProps) {
  const { openModal } = useModal();
  const { users, removeCard, solucionadoId, naoSolucionadoId, isColumnDragging } = useBoard();

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
  
  const cardStatus = useMemo(() => {
    let isOverdue = false;
    let isDueToday = false;
    let formattedDate = '';
    let statusIcon = null;

    const isCompleted = card.column_id === solucionadoId || card.column_id === naoSolucionadoId;

    if (card.due_date && !isCompleted) {
        const now = new Date();
        const dueDate = new Date(card.due_date);
        
        formattedDate = dueDate.toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        });

        if (now > dueDate) {
            isOverdue = true;
            statusIcon = <i className="fas fa-exclamation-triangle overdue-icon"></i>;
        } else {
            const warningTime = new Date(dueDate.getTime() - (1 * 60 * 60 * 1000));
            if (now >= warningTime) {
                isDueToday = true;
                statusIcon = <i className="fas fa-clock due-today-icon"></i>;
            } else {
                statusIcon = <i className="fas fa-calendar"></i>;
            }
        }
    }
    
    return {
      formattedDate,
      statusIcon,
      statusClass: isOverdue ? 'overdue' : (isDueToday ? 'due-today' : ''),
    };
  }, [card.due_date, card.column_id, solucionadoId, naoSolucionadoId]);
  
  const cardClassName = [
    'task',
    `priority-${card.priority || 'media'}`,
    cardStatus.statusClass,
    isDragging ? 'dragging' : '',
    isOverlay ? 'is-overlay' : '',
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

  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        {...attributes} 
        {...listeners} 
        className={cardClassName} 
        onClick={() => openModal('task', { card: card })}
    >
      <div className="task-actions">
        <button className="action-btn delete-btn" title="Excluir Tarefa" onClick={handleDelete}>
            <i className="fas fa-trash"></i>
        </button>
      </div>
      <div className="task-header">
        <div className="task-title">{card.title}</div>
      </div>
      <div className="task-meta">

        {assignedUser ? (
            <div className="task-assignee">
                <div className="assignee-avatar" style={{ backgroundImage: assignedUser.avatar ? `url(${assignedUser.avatar})` : 'none' }}>
                    {!assignedUser.avatar && (assigneeDisplayName.charAt(0).toUpperCase())}
                </div>
                <span>{assigneeDisplayName}</span>
            </div>
        ) : (
            <div></div> 
        )}
        
        <div className="task-due-info">
            <span className="task-date-text">{cardStatus.formattedDate}</span>
            <div className="task-status-icons">{cardStatus.statusIcon}</div>
        </div>
      </div>
    </div>
  );
}