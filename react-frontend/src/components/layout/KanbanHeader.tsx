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
        <span>
            Tem certeza que deseja sair do quadro <b>"{board.title}"</b>?
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                <button
                    className="btn btn-primary" style={{ flex: 1 }}
                    onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                           await boardService.leaveBoard(board.id);
                           toast.success("Você saiu do quadro.");
                           navigate('/private-boards');
                        } catch (error) { toast.error("Falha ao sair do quadro."); }
                    }}
                >
                    Sim, Sair
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => toast.dismiss(t.id)}>
                    Não
                </button>
            </div>
        </span>
    ));
  };

  return (
    <div className="header">
      <div className="header-main">
        {!board.is_public && (
          <button className="btn btn-secondary" style={{ marginRight: '1.5rem' }} onClick={() => navigate('/private-boards')}>
            <i className="fas fa-arrow-left"></i><span> Voltar</span>
          </button>
        )}
        <h2>
          <i className={board.is_public ? "fas fa-headset" : "fas fa-user-lock"}></i> {board.title}
        </h2>
      </div>

      <div className="header-actions">
        {board.is_public ? (
          <div className="stats">
            <div className="stat-item clickable-stat" onClick={() => openModal('stats', { status: 'pendente' })}>
              <div className="stat-number">{pending}</div>
              <div><i className="fa-solid fa-spinner"></i> Pendentes</div>
            </div>
            <div className="stat-item clickable-stat" onClick={() => openModal('stats', { status: 'solucionado' })}>
              <div className="stat-number">{completed}</div>
              <div><i className="fas fa-check-circle"></i> Solucionados</div>
            </div>
            <div className="stat-item clickable-stat" onClick={() => openModal('stats', { status: 'nao-solucionado' })}>
              <div className="stat-number">{failed}</div>
              <div><i className="fas fa-times-circle"></i> Não Solucionados</div>
            </div>
          </div>
        ) : (
          <>
            <div className="board-members-container" onClick={() => openModal('manageMembers')} title="Gerenciar Membros">
              {boardMembers.map(member => {
                const displayName = userDisplayNameMap[member.email] || member.username;
                return (
                  <div 
                    key={member.id} 
                    className="board-member-avatar" 
                    title={`${displayName} ${member.is_owner ? '(Dono)' : ''}`}
                    style={{ 
                        backgroundImage: member.avatar ? `url(${member.avatar})` : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px',
                     }}
                  >
                    {!member.avatar && displayName.charAt(0).toUpperCase()}
                  </div>
                )
              })}
            </div>
            
            {isOwner && (
              <button className="btn btn-secondary" onClick={() => openModal('inviteUser')}>
                <i className="fas fa-user-plus"></i><span> Convidar</span>
              </button>
            )}
            {!isOwner && (
                <button className="btn btn-danger" onClick={handleLeaveBoard}>
                    <i className="fas fa-sign-out-alt"></i><span> Sair do Quadro</span>
                </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}