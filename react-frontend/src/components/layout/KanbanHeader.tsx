import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useBoard } from '../../contexts/BoardContext';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import * as boardService from '../../services/boards';
import { userDisplayNameMap } from '../../api/config';

export function KanbanHeader() {
  const { board, boardMembers, solucionadoId, naoSolucionadoId, columns } = useBoard();
  const { user } = useAuth();
  const { openModal } = useModal();
  const navigate = useNavigate();

  if (!board) return null; 

  const isOwner = board.owner_id === user?.id;

  const cards = columns.flatMap(c => c.cards);
  const completed = cards.filter(c => c.column_id === solucionadoId).length;
  const failed = cards.filter(c => c.column_id === naoSolucionadoId).length;
  const pending = cards.length - completed - failed;

  const handleLeaveBoard = () => {
    toast((t) => (
        <div className="toast-confirmation">
            <div className="toast-message">
                Tem certeza que deseja sair do quadro <strong>"{board.title}"</strong>?
            </div>
            <div className="toast-actions">
                <button
                    className="btn btn-danger btn-sm"
                    onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                           await boardService.leaveBoard(board.id);
                           toast.success("Você saiu do quadro.");
                           navigate('/private-boards');
                        } catch (error) { 
                           toast.error("Falha ao sair do quadro."); 
                        }
                    }}
                >
                    Sim, Sair
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

  return (
    <header className="kanban-header">
      <div className="header-left">
        {!board.is_public && (
          <button 
            className="btn btn-ghost btn-back" 
            onClick={() => navigate('/private-boards')}
            title="Voltar aos quadros privados"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
        )}
        
        <div className="board-info">
          <div className="board-title">
            <div className="board-icon">
              <i className={board.is_public ? "fas fa-headset" : "fas fa-user-lock"}></i>
            </div>
            <h1>{board.title}</h1>
            <div className="board-type-badge">
              {board.is_public ? 'Público' : 'Privado'}
            </div>
          </div>
          
          {board.description && (
            <p className="board-description">{board.description}</p>
          )}
        </div>
      </div>

      <div className="header-right">
        {board.is_public ? (
          <div className="stats-container">
            <div 
              className="stat-card stat-pending" 
              onClick={() => openModal('stats', { status: 'pendente' })}
              title="Ver tickets pendentes"
            >
              <div className="stat-icon">
                <i className="fa-solid fa-clock"></i>
              </div>
              <div className="stat-content">
                <div className="stat-number">{pending}</div>
                <div className="stat-label">Pendentes</div>
              </div>
            </div>
            
            <div 
              className="stat-card stat-completed" 
              onClick={() => openModal('stats', { status: 'solucionado' })}
              title="Ver tickets solucionados"
            >
              <div className="stat-icon">
                <i className="fas fa-check-circle"></i>
              </div>
              <div className="stat-content">
                <div className="stat-number">{completed}</div>
                <div className="stat-label">Solucionados</div>
              </div>
            </div>
            
            <div 
              className="stat-card stat-failed" 
              onClick={() => openModal('stats', { status: 'nao-solucionado' })}
              title="Ver tickets não solucionados"
            >
              <div className="stat-icon">
                <i className="fas fa-times-circle"></i>
              </div>
              <div className="stat-content">
                <div className="stat-number">{failed}</div>
                <div className="stat-label">Não Solucionados</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="private-board-actions">
            <div 
              className="board-members" 
              onClick={() => openModal('manageMembers')} 
              title="Gerenciar membros do quadro"
            >
              <div className="members-avatars">
                {boardMembers.slice(0, 3).map(member => {
                  const displayName = userDisplayNameMap[member.email] || member.username;
                  return (
                    <div 
                      key={member.id} 
                      className={`member-avatar ${member.is_owner ? 'owner' : ''}`}
                      title={`${displayName} ${member.is_owner ? '(Proprietário)' : ''}`}
                      style={{ 
                        backgroundImage: member.avatar ? `url(${member.avatar})` : 'none'
                      }}
                    >
                      {!member.avatar && displayName.charAt(0).toUpperCase()}
                    </div>
                  );
                })}
                {boardMembers.length > 3 && (
                  <div className="member-avatar more-members">
                    +{boardMembers.length - 3}
                  </div>
                )}
              </div>
              <span className="members-count">{boardMembers.length} membro{boardMembers.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="action-buttons">
              {isOwner && (
                <button 
                  className="btn btn-primary btn-invite" 
                  onClick={() => openModal('inviteUser')}
                  title="Convidar usuário"
                >
                  <i className="fas fa-user-plus"></i>
                  <span>Convidar</span>
                </button>
              )}
              
              {!isOwner && (
                <button 
                  className="btn btn-danger btn-leave" 
                  onClick={handleLeaveBoard}
                  title="Sair do quadro"
                >
                  <i className="fas fa-sign-out-alt"></i>
                  <span>Sair</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}