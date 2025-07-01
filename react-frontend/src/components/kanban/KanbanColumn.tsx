import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import { useMemo, useCallback, useState } from 'react';

import type { Column as ColumnType, Card as CardType } from '../../types/kanban';
import { KanbanCard } from './KanbanCard';
import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import * as columnService from '../../services/columns';
import styles from './KanbanColumn.module.css';

interface ColumnProps {
  column: ColumnType;
  isOverlay?: boolean;
  isHidden?: boolean; 
}

export function KanbanColumn({ column, isOverlay = false, isHidden = false }: ColumnProps) {
  const { openModal } = useModal();
  const { deleteColumn: deleteColumnFromState } = useBoard();
  const [isDeleting, setIsDeleting] = useState(false);
  
  const cardsIds = useMemo(() => 
    column.cards.map((card: CardType) => card.id), 
    [column.cards]
  );

  const visibleCards = useMemo(() => 
    isOverlay ? column.cards.slice(0, 3) : column.cards,
    [column.cards, isOverlay]
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
    disabled: isOverlay, 
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const handleDeleteColumn = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isDeleting) return;
    
    if (column.cards.length > 0) {
      toast.error("Não é possível excluir colunas que contêm tarefas.", {
        duration: 4000,
      });
      return;
    }

    toast((t) => (
      <div className="toast-content">
        <div className="toast-message">
          Excluir a coluna <strong>"{column.title}"</strong>?
        </div>
        <div className="toast-actions">
          <button 
            className="btn btn-danger"
            disabled={isDeleting}
            onClick={async () => {
              toast.dismiss(t.id);
              setIsDeleting(true);
              
              try {
                await columnService.deleteColumn(column.id);
                deleteColumnFromState(column.id);
                toast.success("Coluna excluída com sucesso!", {
                  duration: 3000,
                });
              } catch (error: any) {
                console.error('Erro ao excluir coluna:', error);
                toast.error(error.message || "Falha ao excluir a coluna.", {
                  duration: 4000,
                });
              } finally {
                setIsDeleting(false);
              }
            }}
          >
            {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => toast.dismiss(t.id)}
            disabled={isDeleting}
          >
            Cancelar
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,
      style: {
        minWidth: '300px',
      }
    });
  }, [column.id, column.title, column.cards.length, deleteColumnFromState, isDeleting]);

  const handleAddTask = useCallback(() => {
    openModal('task', { columnId: column.id });
  }, [openModal, column.id]);

  const columnClasses = useMemo(() => [
    styles.column,
    isDragging && styles.dragging,
    isOverlay && styles.isOverlay,
    isHidden && styles.hidden
  ].filter(Boolean).join(' '), [isDragging, isOverlay, isHidden]);

  const finalStyle = isOverlay ? {} : style;

  const EmptyState = () => (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateIcon}>
        <i className="fas fa-inbox"></i>
      </div>
      <div className={styles.emptyStateText}>
        Nenhuma tarefa ainda
      </div>
    </div>
  );

  return (
    <div 
      ref={setNodeRef} 
      style={finalStyle}
      className={columnClasses}
      {...(isOverlay ? {} : attributes)} 
      {...(isOverlay ? {} : listeners)} 
      role="region"
      aria-label={`Coluna ${column.title}`}
    >
      <header className={styles.columnHeader}>
        <div className={styles.columnTitle} title={column.title}>
          <span 
            className={styles.columnTitleText}
            style={{ color: column.color }}
          >
            {column.title}
          </span>
          <span className={styles.columnCount} aria-label={`${cardsIds.length} tarefas`}>
            {cardsIds.length}
          </span>
        </div>
        
        {!isOverlay && (
          <div className={styles.columnActions}>
            <button 
              className={styles.deleteColumnBtn} 
              onClick={handleDeleteColumn} 
              title="Excluir Coluna"
              aria-label={`Excluir coluna ${column.title}`}
              disabled={isDeleting}
            >
              <i className="fas fa-times"></i>
            </button>
            
            <button 
              className={styles.addTaskBtn} 
              onClick={handleAddTask} 
              title="Adicionar Tarefa"
              aria-label={`Adicionar tarefa à coluna ${column.title}`}
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
        )}
      </header>
      
      <div 
        className={styles.taskList}
        role="list"
        aria-label={`Lista de tarefas da coluna ${column.title}`}
      >
        {!isOverlay ? (
          <>
            {cardsIds.length === 0 ? (
              <EmptyState />
            ) : (
              <SortableContext items={cardsIds} strategy={verticalListSortingStrategy}>
                {column.cards.map((card: CardType) => (
                  <KanbanCard 
                    key={card.id} 
                    card={card} 
                  />
                ))}
              </SortableContext>
            )}
          </>
        ) : (
          <>
            {visibleCards.map((card: CardType) => (
              <KanbanCard 
                key={card.id} 
                card={card} 
                isOverlay 
              />
            ))}
            {column.cards.length > 3 && (
              <div 
                className={styles.moreCardsIndicator}
                aria-label={`Mais ${column.cards.length - 3} tarefas`}
              >
                +{column.cards.length - 3} tarefa{column.cards.length - 3 !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}