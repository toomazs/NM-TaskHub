import React, { useState, useMemo } from 'react';
import { 
    FaTimes, FaCommentDots, FaChevronLeft, FaChevronRight, 
    FaUsers, FaExclamationCircle, FaSitemap
} from 'react-icons/fa';
import { useModal } from '../../contexts/ModalContext';
import { ClienteSinalAltoComStatus, StatusKey, Comment } from '../../types/sinal';
import styles from './ContatoStatsModal.module.css';

const ITEMS_PER_PAGE = 8;

const getFinalResolution = (annotation: any): string => {
  if (typeof annotation !== 'string' || !annotation.trim().startsWith('{')) {
    return '';
  }

  try {
    const parsedData = JSON.parse(annotation);
    const resolution = parsedData.resolucao;

    if (Array.isArray(resolution) && resolution.length > 0) {
      const lastResolutionItem = resolution[resolution.length - 1];
      
      if (typeof lastResolutionItem === 'object' && lastResolutionItem !== null && lastResolutionItem.text) {
        return lastResolutionItem.text;
      }
      
      return String(lastResolutionItem);
    }

    if (typeof resolution === 'string') {
      return resolution;
    }

    return '';
  } catch (error) {
    console.warn('Não foi possível interpretar a anotação JSON no ContatoStatsModal:', annotation, error);
    return '';
  }
};


export function ContatoStatsModal() {
  const { closeModal, openModal, modalProps, isClosing } = useModal();
  const [currentPage, setCurrentPage] = useState(1);
  
  if (!modalProps || !modalProps.clientes) {
    return null; 
  }

  const { title, Icon, clientes, onSave, onAssign, onUnassign, onAdminAssign } = modalProps as {
    title: string;
    Icon: React.ElementType;
    clientes: ClienteSinalAltoComStatus[];
    onSave: (clientId: string, status: StatusKey, anotacao: string) => void;
    onAssign: (clienteId: string) => void;
    onUnassign: (clienteId: string) => void;
    onAdminAssign: (clienteId: string, assigneeId: string) => void;
  };
  
  const totalPages = Math.ceil(clientes.length / ITEMS_PER_PAGE);
  const paginatedClientes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return clientes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [clientes, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
    }
  }

  const handleCardClick = (cliente: ClienteSinalAltoComStatus) => {
    closeModal();
    setTimeout(() => {
        openModal('contato', { 
            cliente, 
            isEditing: true,
            onSave: (status: StatusKey, anotacao: string) => {
                onSave(cliente.id, status, anotacao);
            },
            onAssign,
            onUnassign,
            onAdminAssign
        });
    }, 350); 
  };

  return (
    <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={closeModal}>
      <div className={`${styles.modalContent}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>
            {Icon && <Icon />}
            {title} 
            <span className={styles.statsCount}>
              <FaUsers /> {clientes.length}
            </span>
          </h2>
          <button className={styles.modalClose} onClick={closeModal}>
            <FaTimes />
          </button>
        </div>
        
        <div className={styles.statsBody}>
          {clientes.length === 0 ? (
            <div className={styles.emptyState}>
              <FaExclamationCircle className={styles.emptyIcon} />
              <p>Nenhum cliente neste status.</p>
            </div>
          ) : (
            <>
              <div className={styles.statsSummary}>
                <div className={styles.summaryItem}>
                  <i className="fas fa-list"></i>
                  <span>Total: <strong>{clientes.length}</strong></span>
                </div>
                <div className={styles.summaryItem}>
                  <i className="fas fa-eye"></i>
                  <span>Exibindo: <strong>{paginatedClientes.length}</strong></span>
                </div>
              </div>

            <div className={styles.statsList}>
                {paginatedClientes.map((cliente) => {
                  const finalResolution = getFinalResolution(cliente.anotacao);

                  return (
                    <div key={cliente.id} className={styles.statsListItem} onClick={() => handleCardClick(cliente)}>
                      <div className={styles.itemHeader}>
                        <div className={styles.taskTitle}>
                          <i className="fas fa-user"></i> {cliente.login}
                        </div>
                        <div className={styles.itemActions}> <i className="fa-solid fa-pen-to-square"></i></div>
                      </div>
                      <div className={styles.taskMeta}>
                        {cliente.assigned_to_name && (
                              <div 
                                className={styles.avatarBubble} 
                                style={{ backgroundColor: cliente.assigned_to_avatar ? 'transparent' : '#3fb950' }}
                                title={`Assumido por ${cliente.assigned_to_name}`}
                              >
                                  {cliente.assigned_to_avatar ? (
                                      <img src={cliente.assigned_to_avatar} alt={cliente.assigned_to_name || ''} />
                                  ) : (
                                      <span>{cliente.assigned_to_name?.charAt(0).toUpperCase()}</span>
                                  )}
                              </div>
                          )}
                        <div className={styles.metaItem}>
                          <i className="fa-solid fa-globe"></i>
                          <span>{cliente.olt}</span>
                        </div>
                        <div className={styles.metaItemSeparator}>•</div>
                        <div className={styles.metaItem}><FaSitemap /><span>{cliente.ponid}</span></div>
                        
                        {finalResolution && (
                          <>
                              <div className={styles.metaItemSeparator}>•</div>
                              <div className={`${styles.metaItem} ${styles.annotation}`}>
                                  <FaCommentDots />
                                  <span title={finalResolution}>
                                      {finalResolution.length > 50 ? `${finalResolution.substring(0, 50)}...` : finalResolution}
                                  </span>
                              </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {totalPages > 1 && (
                <div className={styles.paginationContainer}>
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className={styles.paginationBtn}> <FaChevronLeft /> Anterior </button>
                  <div className={styles.paginationInfo}><span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span></div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className={styles.paginationBtn}> Próxima <FaChevronRight /> </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}