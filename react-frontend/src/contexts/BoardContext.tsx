import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import toast from 'react-hot-toast';

import * as boardService from '../services/boards';
import * as columnService from '../services/columns';
import * as cardService from '../services/cards';
import * as userService from '../services/users';
import type { Board, Column, Card, User } from '../types/kanban';
import { useWebSocket } from '../hooks/useWebSocket';

interface BoardContextType {
  board: Board | null;
  columns: Column[];
  users: User[];
  boardMembers: User[];
  setBoardMembers: React.Dispatch<React.SetStateAction<User[]>>;
  isLoading: boolean;
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
  fetchBoardData: (boardId: number, isPrivate?: boolean) => Promise<void>;
  isColumnDragging: boolean;
  setIsColumnDragging: React.Dispatch<React.SetStateAction<boolean>>;
  solucionadoId: number | null;
  naoSolucionadoId: number | null;
  addColumn: (newColumn: Column) => void;
  updateColumn: (updatedColumn: Column) => void;
  deleteColumn: (columnId: number) => void;
  removeCard: (cardId: number, columnId: number) => void;
}

const BoardContext = createContext<BoardContextType | undefined>(undefined);

export function BoardProvider({ children }: { children: ReactNode }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [isColumnDragging, setIsColumnDragging] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [boardMembers, setBoardMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [solucionadoId, setSolucionadoId] = useState<number | null>(null);
  const [naoSolucionadoId, setNaoSolucionadoId] = useState<number | null>(null);

  const fetchBoardData = useCallback(async (boardId: number, isPrivate = false) => {
    try {
      setIsLoading(true);
      const boardDetailsPromise = (isPrivate ? boardService.getPrivateBoards() : boardService.getPublicBoards())
        .then(boards => {
            const foundBoard = boards.find(b => b.id === boardId);
            if (!foundBoard) throw new Error(`Quadro com ID ${boardId} não encontrado.`);
            return foundBoard;
        });

      const [boardDetails, fetchedColumns, members] = await Promise.all([
        boardDetailsPromise,
        columnService.getColumnsForBoard(boardId),
        isPrivate ? boardService.getBoardMembers(boardId) : Promise.resolve([])
      ]);
      
      setBoardMembers(members || []);
      const columnsWithCards = await Promise.all(
        fetchedColumns.map(async (col) => {
          if(col.title.toLowerCase() === 'solucionado') setSolucionadoId(col.id);
          if(col.title.toLowerCase() === 'não solucionado') setNaoSolucionadoId(col.id);
          const cards = await cardService.getCardsForColumn(col.id);
          return { ...col, cards: cards || [] };
        })
      );
      setBoard(boardDetails);
      setColumns(columnsWithCards);
    } catch (error: any) {
      toast.error(error.message || "Falha ao carregar dados do quadro.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleWebSocketMessage = useCallback((message: { type: string, payload: any }) => {
    switch (message.type) {
      case 'CARD_UPDATED': {
        const updatedCard = message.payload as Card;
        setColumns(prev => prev.map(col => {
            if (col.id === updatedCard.column_id) {
                return { ...col, cards: col.cards.map(c => c.id === updatedCard.id ? updatedCard : c) };
            }
            return col;
        }));
        break;
      }
      case 'CARD_CREATED': {
        const newCard = message.payload as Card;
        setColumns(prev => prev.map(col => col.id === newCard.column_id ? { ...col, cards: [...col.cards, newCard] } : col));
        break;
      }
      case 'CARD_DELETED': {
        const { card_id } = message.payload;
        setColumns(prev => prev.map(col => ({...col, cards: col.cards.filter(c => c.id !== card_id)})));
        break;
      }
      
       case 'CARD_MOVED': {
        const { card, old_column_id } = message.payload as { card: Card, old_column_id: number };

        if (old_column_id === card.column_id) break;

        setColumns(prev => {
          return prev.map(col => {
            const cardsWithoutMovedCard = col.cards.filter(c => c.id !== card.id);

            if (col.id === card.column_id) {
              const newCards = [...cardsWithoutMovedCard];
              
              newCards.splice(card.position, 0, card);
              
              return { ...col, cards: newCards };
            }

            return { ...col, cards: cardsWithoutMovedCard };
          });
        });
        break;
      }
      
      case 'COLUMNS_REORDERED': {
        const { ordered_column_ids } = message.payload;
        if (!Array.isArray(ordered_column_ids) || ordered_column_ids.length === 0) return;

        setColumns(prevColumns => {
          const columnMap = new Map(prevColumns.map(col => [col.id, col]));
          
          const reorderedColumns = ordered_column_ids
            .map((id: number) => columnMap.get(id))
            .filter((col?: Column): col is Column => col !== undefined);

          if (reorderedColumns.length !== prevColumns.length) {
            console.warn('Mismatch na reordenação de colunas, mantendo estado anterior');
            return prevColumns; 
          }
          
          return reorderedColumns.map((col, index) => ({
            ...col,
            position: index,
          }));
        });
        break;
      }

      case 'BOARD_STATE_UPDATED':
      case 'COLUMN_CREATED':
      case 'COLUMN_UPDATED':
      case 'COLUMN_DELETED':
        if (board?.id) { 
          fetchBoardData(board.id, !board.is_public); 
        }
        break;
      default:
        console.log("Mensagem WebSocket não tratada:", message);
    }
  }, [board, fetchBoardData]);

  useWebSocket(board?.id, handleWebSocketMessage);

  useEffect(() => {
    userService.getUsers().then((fetchedUsers) => { if(fetchedUsers) setUsers(fetchedUsers) }).catch(console.error);
  }, []);

  const addColumn = useCallback((newColumn: Column) => { 
    setColumns(prev => [...prev, { ...newColumn, cards: [] }]) 
  }, []);

  const updateColumn = useCallback((updatedColumn: Column) => { 
    setColumns(prev => prev.map(c => c.id === updatedColumn.id ? { ...c, ...updatedColumn } : c))
  }, []);

  const deleteColumn = useCallback((columnId: number) => { 
    setColumns(prev => prev.filter(c => c.id !== columnId))
  }, []);

  const removeCard = useCallback((cardId: number, columnId: number) => {
    setColumns(prev => prev.map(col => col.id === columnId ? { ...col, cards: col.cards.filter(c => c.id !== cardId) } : col));
  }, []);

  const value = { 
    board, 
    columns, 
    users, 
    boardMembers, 
    setBoardMembers, 
    isLoading, 
    setColumns, 
    fetchBoardData, 
    solucionadoId, 
    naoSolucionadoId, 
    addColumn, 
    updateColumn, 
    deleteColumn, 
    removeCard, 
    isColumnDragging, 
    setIsColumnDragging 
  };
  
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard() {
  const context = useContext(BoardContext);
  if (context === undefined) throw new Error('useBoard deve ser usado dentro de um BoardProvider');
  return context;
}