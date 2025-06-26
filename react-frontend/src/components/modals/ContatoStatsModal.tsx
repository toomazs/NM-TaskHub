import React, { useState, useMemo } from 'react';
import { 
    FaTimes, 
    FaCommentDots, 
    FaChevronLeft, 
    FaChevronRight, 
    FaUsers, 
    FaExclamationCircle,
    FaEdit,
    FaNetworkWired,
    FaSitemap
} from 'react-icons/fa';
import { useModal } from '../../contexts/ModalContext';
import { ClienteSinalAltoComStatus, StatusKey } from '../../types/sinal';

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
    <div className={`modal ${isClosing ? 'closing' : ''}`} onClick={closeModal}>
      <div className="modal-content stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <i className={`fas ${icon}`}></i> 
            {title} 
            <span className="stats-count">
              <FaUsers /> {clientes.length}
            </span>
          </h2>
          <button className="modal-close" onClick={closeModal}>
            <FaTimes />
          </button>
        </div>
        
        <div className="stats-body">
          {clientes.length === 0 ? (
            <div className="empty-state">
              <FaExclamationCircle className="empty-icon" />
              <p>Nenhum cliente neste status.</p>
            </div>
          ) : (
            <>
              <div className="stats-summary">
                <div className="summary-item">
                  <i className="fas fa-list"></i>
                  <span>Total: <strong>{clientes.length}</strong></span>
                </div>
                <div className="summary-item">
                  <i className="fas fa-eye"></i>
                  <span>Exibindo: <strong>{paginatedClientes.length}</strong></span>
                </div>
              </div>

            <div className="stats-list">
                {paginatedClientes.map((cliente) => (
                  <div key={cliente.id} className="stats-list-item" onClick={() => handleCardClick(cliente)}>
                    <div className="item-header">
                      <div className="task-title">
                        <i className="fas fa-user"></i> {cliente.login}
                      </div>
                      <div className="item-actions"> <i className="fa-solid fa-pen-to-square"></i></div>
                    </div>
                    <div className="task-meta">
                      {cliente.assigned_to && (
                            <div 
                              className="avatar-bubble small" 
                              style={{ backgroundColor: cliente.assigned_to_avatar ? 'transparent' : (cliente.assigned_to_name || '') }}
                              title={`Assumido por ${cliente.assigned_to_name}`}
                            >
                                {cliente.assigned_to_avatar ? (
                                    <img src={cliente.assigned_to_avatar} alt={cliente.assigned_to_name || ''} />
                                ) : (
                                    <span>{cliente.assigned_to_name?.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                        )}
                      <div className="meta-item">•ﾠ
                        <i className="fa-solid fa-globe"></i>
                        <span>{cliente.olt}</span>
                        
                      </div>
                      <div className="meta-item-separator">•</div>
                      <div className="meta-item"><FaSitemap /><span>{cliente.ponid}</span></div>
                      {cliente.anotacao && (
                        <>
                            <div className="meta-item-separator">•</div>
                            <div className="meta-item annotation">
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
                <div className="pagination-container">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="contatos-pagination__btn contatos-pagination__btn--prev"> <FaChevronLeft /> Anterior </button>
                  <div className="pagination-info"><span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span></div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="contatos-pagination__btn contatos-pagination__btn--next"> Próxima <FaChevronRight /> </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}