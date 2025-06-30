import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useBoard } from '../../contexts/BoardContext';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import * as boardService from '../../services/boards';
import { userDisplayNameMap } from '../../api/config';
import styles from './KanbanHeader.module.css';

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
    <header className={styles.kanbanHeader}>
      <div className={styles.headerLeft}>
        {!board.is_public && (
          <button 
            className={styles.btnBack} 
            onClick={() => navigate('/private-boards')}
            title="Voltar aos quadros privados"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
        )}
        
        <div className={styles.boardInfo}>
          <div className={styles.boardTitle}>
            <div className={styles.boardIcon}>
              <i className={board.is_public ? "fas fa-headset" : "fas fa-user-lock"}></i>
            </div>
            <h1>{board.title}</h1>
            <div className={styles.boardTypeBadge}>
              {board.is_public ? 'Público' : 'Privado'}
            </div>
          </div>
          
          {board.description && (
            <p className={styles.boardDescription}>{board.description}</p>
          )}
        </div>
      </div>

      <div className={styles.headerRight}>
        {board.is_public ? (
          <div className={styles.statsContainer}>
            <div 
              className={`${styles.statCard} ${styles.statPending}`} 
              onClick={() => openModal('stats', { status: 'pendente' })}
              title="Ver tickets pendentes"
            >
              <div className={styles.statIcon}>
                <i className="fa-solid fa-clock"></i>
              </div>
              <div className={styles.statContent}>
                <div className={styles.statNumber}>{pending}</div>
                <div className={styles.statLabel}>Pendentes</div>
              </div>
            </div>
            
            <div 
              className={`${styles.statCard} ${styles.statCompleted}`} 
              onClick={() => openModal('stats', { status: 'solucionado' })}
              title="Ver tickets solucionados"
            >
              <div className={styles.statIcon}>
                <i className="fas fa-check-circle"></i>
              </div>
              <div className={styles.statContent}>
                <div className={styles.statNumber}>{completed}</div>
                <div className={styles.statLabel}>Solucionados</div>
              </div>
            </div>
            
            <div 
              className={`${styles.statCard} ${styles.statFailed}`}
              onClick={() => openModal('stats', { status: 'nao-solucionado' })}
              title="Ver tickets não solucionados"
            >
              <div className={styles.statIcon}>
                <i className="fas fa-times-circle"></i>
              </div>
              <div className={styles.statContent}>
                <div className={styles.statNumber}>{failed}</div>
                <div className={styles.statLabel}>Não Solucionados</div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.privateBoardActions}>
            <div 
              className={styles.boardMembers} 
              onClick={() => openModal('manageMembers')} 
              title="Gerenciar membros do quadro"
            >
              <div className={styles.membersAvatars}>
                {boardMembers.slice(0, 3).map(member => {
                  const displayName = userDisplayNameMap[member.email] || member.username;
                  return (
                    <div 
                      key={member.id} 
                      className={`${styles.memberAvatar} ${member.is_owner ? styles.owner : ''}`}
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
                  <div className={`${styles.memberAvatar} ${styles.moreMembers}`}>
                    +{boardMembers.length - 3}
                  </div>
                )}
              </div>
              <span className={styles.membersCount}>{boardMembers.length} membro{boardMembers.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className={styles.actionButtons}>
              {isOwner && (
                <button 
                  className={`btn ${styles.btnInvite}`} 
                  onClick={() => openModal('inviteUser')}
                  title="Convidar usuário"
                >
                  <i className="fas fa-user-plus"></i>
                  <span>Convidar</span>
                </button>
              )}
              
              {!isOwner && (
                <button 
                  className={`btn ${styles.btnLeave}`} 
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