import { useState, useMemo } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, DragStartEvent, DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';

import * as cardService from '../../services/cards';
import * as columnService from '../../services/columns';
import type { Column as ColumnType, Card as CardType } from '../../types/kanban';
import { KanbanColumn } from './KanbanColumn';
import { useBoard } from '../../contexts/BoardContext';
import { useModal } from '../../contexts/ModalContext';
import { KanbanCard } from './KanbanCard';
import styles from './KanbanBoard.module.css'; 

export function KanbanBoard() {
  const { columns, setColumns, board, fetchBoardData, solucionadoId, naoSolucionadoId, setIsColumnDragging } = useBoard();
  const { openModal } = useModal();

  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [activeColumn, setActiveColumn] = useState<ColumnType | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedColumns = useMemo(() => {
    return [...columns].sort((a, b) => a.position - b.position);
  }, [columns]);

  const columnIds = useMemo(() => sortedColumns.map(c => c.id), [sortedColumns]);

  const getCardColumn = (cardId: UniqueIdentifier): ColumnType | undefined => {
    return sortedColumns.find(col => col.cards.some(card => card.id === cardId));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === "Column") {
      setActiveColumn(active.data.current.column);
      setIsColumnDragging(true);
    } else if (active.data.current?.type === "Card") {
      setActiveCard(active.data.current.card);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsColumnDragging(false);
    setActiveColumn(null);
    setActiveCard(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;

    if (activeType === 'Column') {
      const oldIndex = sortedColumns.findIndex(c => c.id === active.id);
      const newIndex = sortedColumns.findIndex(c => c.id === over.id);
      
      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedColumns = arrayMove(sortedColumns, oldIndex, newIndex);
      
      const finalColumnsWithPositions = reorderedColumns.map((col, index) => ({
        ...col,
        position: index
      }));

      setColumns(finalColumnsWithPositions);

      const finalOrderedIds = finalColumnsWithPositions.map(c => c.id);
      if (board) {
        columnService.reorderColumns(board.id, finalOrderedIds).catch(error => {
          console.error('Erro ao reordenar colunas:', error);
          fetchBoardData(board.id, !board.is_public);
        });
      }
    }

    if (activeType === 'Card') {
      const startColumn = getCardColumn(active.id);
      const endColumn = sortedColumns.find(col => col.id === over.id) || getCardColumn(over.id);

      if (!startColumn || !endColumn) return;

      if (startColumn.id === endColumn.id) {
        setColumns(currentColumns => {
          const newColumns = currentColumns.map(col => {
            if (col.id === startColumn.id) {
              const oldCardIndex = col.cards.findIndex(c => c.id === active.id);
              const newCardIndex = col.cards.findIndex(c => c.id === over.id);

              if (oldCardIndex === -1 || newCardIndex === -1) return col;

              const reorderedCards = arrayMove(col.cards, oldCardIndex, newCardIndex);
              
              cardService.moveCard(Number(active.id), startColumn.id, newCardIndex);

              return { ...col, cards: reorderedCards };
            }
            return col;
          });

          return newColumns;
        });
      } else {
        setColumns(currentColumns => {
          const newColumns = currentColumns.map(col => {
            if (col.id === startColumn.id) {
              return {
                ...col,
                cards: col.cards.filter(c => c.id !== active.id)
              };
            } else if (col.id === endColumn.id) {
              const cardToMove = startColumn.cards.find(c => c.id === active.id);
              if (!cardToMove) return col;

              const newCardIndex = over.data.current?.type === 'Card'
                ? col.cards.findIndex(c => c.id === over.id)
                : col.cards.length;

              const newCards = [...col.cards];
              newCards.splice(newCardIndex, 0, cardToMove);

              cardService.moveCard(Number(active.id), endColumn.id, newCardIndex);

              return { ...col, cards: newCards };
            }
            return col;
          });

          return newColumns;
        });
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.kanbanContainer}>
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {sortedColumns.map(col => {
            const isHidden = board?.is_public && (col.id === solucionadoId || col.id === naoSolucionadoId);
            return <KanbanColumn key={col.id} column={col} isHidden={isHidden} />;
          })}
        </SortableContext>
        
        <div className={styles.addColumnPlaceholder}>
          <button className={styles.addColumnBtn} onClick={() => openModal('column')}>
            <i className="fas fa-plus"></i> Adicionar Coluna
          </button>
        </div>
      </div>

      {createPortal(
        <DragOverlay>
            {activeColumn && <KanbanColumn column={activeColumn} isOverlay />}
            {activeCard && <KanbanCard card={activeCard} isOverlay />}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}