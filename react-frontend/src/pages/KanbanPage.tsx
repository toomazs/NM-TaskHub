import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useBoard } from '../contexts/BoardContext';
import { Loader } from '../components/ui/Loader';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { KanbanHeader } from '../components/layout/KanbanHeader';

const PUBLIC_BOARD_ID = 8; 

export function KanbanPage() {
  const { isLoading, fetchBoardData, board } = useBoard();
  const { boardId } = useParams<{ boardId: string }>();

  useEffect(() => {
    const idToFetch = boardId ? parseInt(boardId, 10) : PUBLIC_BOARD_ID;
    const isPrivate = !!boardId; 

    fetchBoardData(idToFetch, isPrivate);

  }, [boardId, fetchBoardData]); 

  if (isLoading || !board) {
    return <Loader fullScreen />;
  }

  return (
    <div id="kanbanSection" style={{ display: 'block' }}>
      <KanbanHeader />
      <KanbanBoard />
    </div>
  );
}