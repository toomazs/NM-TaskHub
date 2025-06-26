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
    const [filter, setFilter] = useState<'all' | 'owned' | 'shared'>('all');
    
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
            <div className="delete-confirmation-toast">

                <div className="toast-message">
                    Tem certeza que deseja excluir o quadro <strong>"{boardTitle}"</strong>?
                    <br />
                    <small>Esta ação não pode ser desfeita.</small>
                </div>
                <div className="toast-actions">
                    <button
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const loadingToast = toast.loading("Excluindo quadro...");
                            try {
                                await boardService.deleteBoard(boardId);
                                toast.success(`Quadro "${boardTitle}" excluído com sucesso.`);
                                setBoards(prevBoards => prevBoards.filter(b => b.id !== boardId));
                            } catch (error) {
                                toast.error("Falha ao excluir o quadro.");
                            } finally {
                                toast.dismiss(loadingToast);
                            }
                        }}
                    >
                        <i className="fas fa-trash"></i>
                        Excluir
                    </button>
                    <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        ), { duration: Infinity });
    };

    const filteredBoards = boards.filter(board => {
        if (filter === 'owned') return board.owner_id === user?.id;
        if (filter === 'shared') return board.owner_id !== user?.id;
        return true;
    });

    const ownedCount = boards.filter(board => board.owner_id === user?.id).length;
    const sharedCount = boards.filter(board => board.owner_id !== user?.id).length;

    if (isLoading) {
        return <Loader fullScreen />;
    }

    return (
        <div className="private-boards-page">
            <div className="page-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1>
                            <i className="fas fa-user-lock"></i>
                            Meus Quadros Privados
                        </h1>
                        <p>Gerencie seus quadros pessoais e colaborativos</p>
                    </div>
                    <button className="btn btn-primary btn-create" onClick={handleCreateBoard}>
                        <i className="fas fa-plus"></i>
                        <span>Novo Quadro Privado</span>
                    </button>
                </div>

                {boards.length > 0 && (
                    <div className="boards-stats">
                        <div className="stat-item">
                            <span className="stat-number">{boards.length}</span>
                            <span className="stat-label">Total</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{ownedCount}</span>
                            <span className="stat-label">Próprios</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{sharedCount}</span>
                            <span className="stat-label">Compartilhados</span>
                        </div>
                    </div>
                )}
            </div>

            {boards.length > 0 && (
                <div className="filter-section">
                    <div className="filter-tabs">
                        <button 
                            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            <i className="fas fa-th-large"></i>
                            Todos ({boards.length})
                        </button>
                        <button 
                            className={`filter-tab ${filter === 'owned' ? 'active' : ''}`}
                            onClick={() => setFilter('owned')}
                        >
                            <i className="fas fa-crown"></i>
                            Meus Quadros ({ownedCount})
                        </button>
                        <button 
                            className={`filter-tab ${filter === 'shared' ? 'active' : ''}`}
                            onClick={() => setFilter('shared')}
                        >
                            <i className="fas fa-users"></i>
                            Compartilhados ({sharedCount})
                        </button>
                    </div>
                </div>
            )}

            <div className="boards-content">
                {filteredBoards.length > 0 ? (
                    <div className="boards-grid">
                        {filteredBoards.map(board => {
                            const isOwner = board.owner_id === user?.id;
                            return (
                                <div 
                                    key={board.id} 
                                    className={`board-card ${isOwner ? 'owned' : 'shared'}`}
                                    onClick={() => handleSelectBoard(board.id)}
                                >
                                    <div className="card-header">
                                        <div className="board-icon" style={{ backgroundColor: board.color || '#3498db' }}>
                                            <i className="fas fa-user-lock"></i>
                                        </div>
                                        <div className="board-status">
                                            {isOwner ? (
                                                <span className="status-badge owner">
                                                    <i className="fas fa-crown"></i>
                                                    ﾠProprietário
                                                </span>
                                            ) : (
                                                <span className="status-badge shared">
                                                    <i className="fas fa-users"></i>
                                                    ﾠCompartilhado
                                                </span>
                                            )}
                                        </div>
                                        {isOwner && (
                                            <button 
                                                className="delete-btn"
                                                onClick={(e) => handleDeleteBoard(e, board.id, board.title)}
                                                title="Excluir quadro"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        )}
                                    </div>

                                    <div className="card-content">
                                        <h3 className="board-title">{board.title}</h3>
                                        <p className="board-description">
                                            {board.description || "Sem descrição disponível."}
                                        </p>
                                    </div>

                                    <div className="card-footer">
                                        {!isOwner && board.owner_name && (
                                            <div className="owner-info">
                                                <i className="fas fa-user"></i>
                                                <span>Por {board.owner_name}</span>
                                            </div>
                                        )}
                                        <div className="access-btn">
                                            <i className="fas fa-arrow-right"></i>
                                            <span>Acessar</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : boards.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <i className="fas fa-clipboard"></i>
                        </div>
                        <h3>Nenhum quadro encontrado</h3>
                        <p>Você ainda não possui quadros privados. Comece criando seu primeiro quadro!</p>
                        <button className="btn btn-primary" onClick={handleCreateBoard}>
                            <i className="fas fa-plus"></i>
                            Criar Primeiro Quadro
                        </button>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <i className="fas fa-filter"></i>
                        </div>
                        <h3>Nenhum quadro nesta categoria</h3>
                        <p>Tente alterar o filtro para ver outros quadros.</p>
                    </div>
                )}
            </div>
        </div>
    );
}