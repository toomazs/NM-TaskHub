import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import { useMemo } from 'react';

import type { Column as ColumnType, Card as CardType } from '../../types/kanban';
import { KanbanCard } from './KanbanCard';
import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import * as columnService from '../../services/columns';

interface ColumnProps {
  column: ColumnType;
  isOverlay?: boolean;
  isHidden?: boolean; 
}

export function KanbanColumn({ column, isOverlay, isHidden }: ColumnProps) {
  const { openModal } = useModal();
  const { deleteColumn: deleteColumnFromState, isColumnDragging } = useBoard();
  
  const cardsIds = useMemo(() => column.cards.map((c: CardType) => c.id), [column.cards]);

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

  const handleDeleteColumn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (column.cards.length > 0) {
      toast.error("Não é possível excluir colunas que contêm tarefas.");
      return;
    }
    toast((t) => (
        <span>
            Excluir a coluna <strong>"{column.title}"</strong>?
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                <button className="btn btn-danger" style={{flex: 1}}
                    onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                            await columnService.deleteColumn(column.id);
                            deleteColumnFromState(column.id);
                            toast.success("Coluna excluída!");
                        } catch (error: any) {
                            toast.error(error.message || "Falha ao excluir a coluna.");
                        }
                    }}>
                    Sim, excluir
                </button>
                <button className="btn btn-secondary" style={{flex: 1}} onClick={() => toast.dismiss(t.id)}>Não</button>
            </div>
        </span>
    ));
  };

  const columnClasses = [
    'column',
    isDragging ? 'dragging' : '',
    isOverlay ? 'is-overlay' : '',
    isHidden ? 'hidden' : ''
  ].filter(Boolean).join(' ');

  const finalStyle = isOverlay ? {} : style;

  return (
    <div 
      ref={setNodeRef} 
      style={finalStyle}
      {...(isOverlay ? {} : attributes)} 
      {...(isOverlay ? {} : listeners)} 
      className={columnClasses}
    >
      <div className="column-header">
        <div className="column-title" title={column.title}>
            <span style={{ color: column.color, fontWeight: 'bold' }}>{column.title}</span>
            <span className="column-count">{cardsIds.length}</span>
            {!isOverlay && (
              <button className="delete-column-btn" onClick={handleDeleteColumn} title="Excluir Coluna">
                  <i className="fas fa-times"></i>
              </button>
            )}
        </div>
        {!isOverlay && (
          <button className="add-task-btn" onClick={() => openModal('task', { columnId: column.id })} title="Adicionar Tarefa">
              <i className="fas fa-plus"></i>
          </button>
        )}
      </div>
      
      <div className="task-list">
        {!isOverlay ? (
          <SortableContext items={cardsIds} strategy={verticalListSortingStrategy}>
            {column.cards.map((card: CardType) => (
              <KanbanCard key={card.id} card={card} />
            ))}
          </SortableContext>
        ) : (
          column.cards.slice(0, 3).map((card: CardType) => (
            <KanbanCard key={card.id} card={card} isOverlay />
          ))
        )}
        {isOverlay && column.cards.length > 3 && (
          <div className="more-cards-indicator">
            +{column.cards.length - 3} tarefas
          </div>
        )}
      </div>
    </div>
  );
}