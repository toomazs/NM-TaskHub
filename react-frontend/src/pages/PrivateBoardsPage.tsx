import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import * as boardService from '../services/boards';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { Board } from '../types/kanban';
import { Loader } from '../components/ui/Loader';

export function PrivateBoardsPage() {
    const [boards, setBoards] = useState<Board[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const navigate = useNavigate();
    const { user } = useAuth();
    const { openModal } = useModal();

    const fetchBoards = useCallback(async () => {
        setIsLoading(true);
        try {
            const privateBoards = await boardService.getPrivateBoards();
            setBoards(privateBoards);
        } catch (error) {
            toast.error("Falha ao carregar seus quadros privados.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBoards();
    }, [fetchBoards]);

    const handleSelectBoard = (boardId: number) => {
        navigate(`/board/${boardId}`);
    };

    const handleCreateBoard = () => {
        openModal('privateBoard', { onBoardCreated: fetchBoards });
    };

    const handleDeleteBoard = (e: React.MouseEvent, boardId: number, boardTitle: string) => {
        e.stopPropagation();

        toast((t) => (
            <span>
                Tem certeza que deseja excluir <b>"{boardTitle}"</b>?
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <button
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const loadingToast = toast.loading("Excluindo quadro...");
                            try {
                                await boardService.deleteBoard(boardId);
                                toast.success(`Quadro "${boardTitle}" excluído.`);
                                setBoards(prevBoards => prevBoards.filter(b => b.id !== boardId));
                            } catch (error) {
                                toast.error("Falha ao excluir o quadro.");
                            } finally {
                                toast.dismiss(loadingToast);
                            }
                        }}
                    >
                        Sim, Excluir
                    </button>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => toast.dismiss(t.id)}>
                        Não
                    </button>
                </div>
            </span>
        ), { duration: 6000 });
    };

    if (isLoading) {
        return <Loader fullScreen />;
    }

    return (
        <div className="content-section" style={{ display: 'block' }}>
            <div className="content-header">
                <h2><i className="fas fa-user-lock"></i> Meus Quadros Privados</h2>
                <p>Quadros criados por você ou compartilhados com você.</p>
            </div>
            <div className="content-body">
                <div className="private-boards-actions" style={{ marginBottom: '2rem' }}>
                    <button className="btn btn-primary" onClick={handleCreateBoard}>
                        <i className="fas fa-plus"></i> Criar Novo Quadro
                    </button>
                </div>
                <div className="private-boards-container">
                    {boards.length > 0 ? (
                        boards.map(board => {
                            const isOwner = board.owner_id === user?.id;
                            return (
                                <div key={board.id} className="private-board-card">
                                    <div className="private-board-header">
                                        <h3><i className="fas fa-user-lock" style={{ color: board.color || '#3498db' }}></i> {board.title}</h3>
                                    </div>

                                    {!isOwner && board.owner_name && (
                                        <div className="board-owner-tag">
                                            Quadro de {board.owner_name}
                                        </div>
                                    )}

                                    <p>{board.description || "Sem descrição."}</p>
                                    
                                    <div className="private-board-actions">
                                        <button className="btn btn-primary btn-view-board" onClick={() => handleSelectBoard(board.id)}>
                                            <i className="fas fa-arrow-right"></i> Acessar
                                        </button>
                                        {isOwner && (
                                            <button className="btn btn-secondary btn-delete-board" onClick={(e) => handleDeleteBoard(e, board.id, board.title)}>
                                                <i className="fas fa-times"></i> Excluir
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p style={{ color: 'var(--text-muted)' }}>
                            Você ainda não tem quadros privados. Crie um ou aguarde um convite!
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}