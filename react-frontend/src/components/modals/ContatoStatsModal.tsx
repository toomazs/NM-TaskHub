import React, { useState, useMemo } from 'react';
import { 
    FaTimes, FaCommentDots, FaChevronLeft, FaChevronRight, 
    FaUsers, FaExclamationCircle, FaSitemap
} from 'react-icons/fa';
import { useModal } from '../../contexts/ModalContext';
import { ClienteSinalAltoComStatus, StatusKey } from '../../types/sinal';
import styles from './ContatoStatsModal.module.css';

const ITEMS_PER_PAGE = 8;

export function ContatoStatsModal() {
  const { closeModal, openModal, modalProps, isClosing } = useModal();
  const [currentPage, setCurrentPage] = useState(1);
  
  if (!modalProps || !modalProps.clientes) {
    return null; 
  }

  const { title, icon, clientes, onSave } = modalProps as {
    title: string;
    icon: string;
    clientes: ClienteSinalAltoComStatus[];
    onSave: (clientId: string, status: StatusKey, anotacao: string) => void;
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
            onSave: (status: StatusKey, resolucao: string) => {
                onSave(cliente.id, status, resolucao);
            },
        });
    }, 350);
  };

  return (
    <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={closeModal}>
      <div className={`${styles.modalContent}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>
            <i className={`fas ${icon}`}></i> 
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
                {paginatedClientes.map((cliente) => (
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
                      {cliente.anotacao && (
                        <>
                            <div className={styles.metaItemSeparator}>•</div>
                            <div className={`${styles.metaItem} ${styles.annotation}`}>
                                <FaCommentDots />
                                <span title={cliente.anotacao}>
                                    {cliente.anotacao.length > 50 ? `${cliente.anotacao.substring(0, 50)}...` : cliente.anotacao}
                                </span>
                            </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
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