import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    FaExclamationTriangle, FaSearch, FaSort, FaChevronLeft, FaChevronRight, 
    FaClock, FaCalendarCheck, FaPhoneSlash, FaTimesCircle,
    FaUserPlus, 
    FaUser,
    FaTimes
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useModal } from '../contexts/ModalContext';
import { useAuth } from '../contexts/AuthContext';
import { ClienteSinalAlto, ClienteSinalAltoComStatus, StatusKey } from '../types/sinal';
import * as contatosService from '../services/contatos';

const FaArrowDown = (props: any) => <svg {...props} stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M413.1 222.5l22.2 22.2c9.4 9.4 9.4 24.6 0 33.9L241 473c-9.4 9.4-24.6 9.4-33.9 0L12.7 278.6c-9.4-9.4-9.4-24.6 0-33.9l22.2-22.2c9.5-9.5 25-9.3 34.3.4L184 343.4V40c0-13.3 10.7-24 24-24h32c13.3 0 24 10.7 24 24v303.4l114.9-120.5c9.3-9.8 24.8-10 34.3-.4z"></path></svg>;
const FaArrowUp = (props: any) => <svg {...props} stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M34.9 289.5l-22.2-22.2c-9.4-9.4-9.4-24.6 0-33.9L207 39c9.4-9.4 24.6-9.4 33.9 0l194.3 194.3c9.4 9.4 9.4 24.6 0 33.9L413 289.4c-9.5 9.5-25 9.3-34.3-.4L264 168.6V472c0 13.3-10.7 24-24 24h-32c-13.3 0-24-10.7-24-24V168.6L69.2 289.1c-9.3 9.8-24.8 10-34.3-.4z"></path></svg>;

export function ContatosPage() {
  const { openModal } = useModal();
  const { user } = useAuth();

  const [clientes, setClientes] = useState<ClienteSinalAltoComStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof ClienteSinalAlto; direction: 'asc' | 'desc' } | null>({ key: 'rx', direction: 'asc' });
  
  const ITEMS_PER_PAGE = 15;

  const fetchAndMergeData = useCallback(async () => {
    try {
        setLoading(true);

        const [sinaisData, statusData] = await Promise.all([
            contatosService.getSinais(),
            contatosService.getContatosStatus()
        ]);
        
        const statusMap = new Map(statusData.map(s => [s.contato_id, s]));
        
        const clientesComStatus = (sinaisData.data as ClienteSinalAlto[]).map(c => {
            const statusInfo = statusMap.get(c.id);
            return {
                ...c,
                status: statusInfo?.status ?? 'pendente', 
                anotacao: statusInfo?.anotacao ?? undefined,
                assigned_to: statusInfo?.assigned_to ?? undefined,
                assigned_to_name: statusInfo?.assigned_to_name ?? undefined,
                assigned_to_avatar: statusInfo?.assigned_to_avatar ?? undefined,
            };
        });

        setClientes(clientesComStatus);
    } catch (error) {
        console.error("Erro final na página de contatos:", error);
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndMergeData();
  }, [fetchAndMergeData]);
  
  
  const handleSaveResolution = useCallback(async (clienteId: string, status: StatusKey, resolucao: string) => {
    const loadingToast = toast.loading("Salvando alteração...");
    try {
        await contatosService.setContatoStatus({
            contato_id: clienteId,
            status,
            anotacao: resolucao
        });
        
        setClientes(prev => prev.map(c => 
            c.id === clienteId ? { ...c, status, anotacao: resolucao } : c
        ));

        toast.dismiss(loadingToast);
        toast.success("Status atualizado com sucesso!");

    } catch (error) {
        toast.dismiss(loadingToast);
        toast.error("Falha ao salvar alteração.");
    }
  }, []);
  
  const handleAssignTask = useCallback(async (clienteId: string) => {
    if (!user) {
        toast.error("Você precisa estar logado para assumir uma tarefa.");
        return;
    }
    const loadingToast = toast.loading("Assumindo tarefa...");
    try {
        const result = await contatosService.assignContato(clienteId);
        
        setClientes(prev => prev.map(c => 
            c.id === clienteId 
                ? { ...c, 
                    assigned_to: result.assigned_to, 
                    assigned_to_name: result.assigned_to_name,
                    assigned_to_avatar: result.assigned_to_avatar,
                  } 
                : c
        ));

        toast.dismiss(loadingToast);
        toast.success(`Você assumiu o cliente!`);
    } catch (error: any) {
        toast.dismiss(loadingToast);
        toast.error(error.message || "Falha ao assumir a tarefa.");
    }
  }, [user]);

  const handleUnassignTask = useCallback(async (clienteId: string) => {
    const loadingToast = toast.loading("Removendo associação...");
    try {
        await contatosService.unassignContato(clienteId);
        
        setClientes(prev => prev.map(c => 
            c.id === clienteId 
                ? { ...c, 
                    assigned_to: undefined, 
                    assigned_to_name: undefined,
                    assigned_to_avatar: undefined,
                  } 
                : c
        ));

        toast.dismiss(loadingToast);
        toast.success(`Você não está mais associado a esta tarefa.`);
    } catch (error: any) {
        toast.dismiss(loadingToast);
        toast.error(error.message || "Falha ao remover associação.");
    }
  }, []);
  
  const handleOpenContatoModal = (cliente: ClienteSinalAltoComStatus) => {
    openModal('contato', { 
      cliente, 
      onSave: handleSaveResolution,
      onAssign: handleAssignTask,
      onUnassign: handleUnassignTask 
    });
  };

  const handleOpenStatsModal = (status: StatusKey) => {
    const statusConfig = {
        'pendente': { title: 'Clientes Pendentes de Contato', icon: 'fa-clock' },
        'Agendado O.S.': { title: 'Clientes com O.S. Agendada', icon: 'fa-calendar-check' },
        'Nao conseguido contato': { title: 'Clientes Não Contatados', icon: 'fa-phone-slash' },
        'Nao solucionado': { title: 'Contatos Não Solucionados', icon: 'fa-times-circle' }
    };
    openModal('contatoStats', {
        ...statusConfig[status],
        clientes: clientes.filter(c => c.status === status),
        onSave: handleSaveResolution,
    });
  };
  
  const clientesPendentes = useMemo(() => {
    let items = clientes.filter(c => c.status === 'pendente');
    
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      items = items.filter(item =>
        item.login.toLowerCase().includes(lowercasedFilter) ||
        item.olt.toLowerCase().includes(lowercasedFilter) ||
        item.ponid.toLowerCase().includes(lowercasedFilter)
      );
    }
    if (sortConfig !== null) {
      items.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [clientes, searchTerm, sortConfig]);

  const totalPages = Math.ceil(clientesPendentes.length / ITEMS_PER_PAGE);
  const paginatedClientes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return clientesPendentes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, clientesPendentes]);
  
  const statusCounts = useMemo(() => {
    return clientes.reduce((acc, cliente) => {
      acc[cliente.status] = (acc[cliente.status] || 0) + 1;
      return acc;
    }, {} as Record<StatusKey, number>);
  }, [clientes]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
    }
  }

  const handleSort = (key: keyof ClienteSinalAlto) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const getSignalClass = (value: number) => {
    if (value <= -29) return 'contatos-signal--danger';
    if (value > -29 && value <= -27) return 'contatos-signal--warning';
    return 'contatos-signal--good';
  };

  const PaginationControls = () => (
    <nav className="contatos-pagination" aria-label="Navegação de páginas">
      <button 
        onClick={() => handlePageChange(currentPage - 1)} 
        disabled={currentPage === 1} 
        className="contatos-pagination__btn contatos-pagination__btn--prev"
        aria-label="Página anterior"
      >
        <FaChevronLeft /> Anterior
      </button>
      <span className="contatos-pagination__info">
        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
      </span>
      <button 
        onClick={() => handlePageChange(currentPage + 1)} 
        disabled={currentPage === totalPages} 
        className="contatos-pagination__btn contatos-pagination__btn--next"
        aria-label="Próxima página"
      >
        Próximo <FaChevronRight />
      </button>
    </nav>
  );

  const ClienteCard = ({ cliente }: { cliente: ClienteSinalAltoComStatus }) => {
    const isCurrentUserAssigned = user?.id === cliente.assigned_to;

    return (
      <article className={`contatos-cliente-card ${cliente.assigned_to ? 'contatos-cliente-card--assigned' : ''}`}>
        <header className="contatos-cliente-card__header">
          <h4 className="contatos-cliente-card__title">{cliente.login || 'N/A'}</h4>
          <span className="contatos-cliente-card__olt">{cliente.olt}</span>
        </header>
        
        <div className="contatos-cliente-card__body">
          <div className={`contatos-signal-info ${getSignalClass(cliente.rx)}`}>
            <FaArrowDown className="contatos-signal-info__icon" title="RX" />
            <span className="contatos-signal-info__value">RX: {cliente.rx.toFixed(2)} dBm</span>
          </div>
          <div className={`contatos-signal-info ${getSignalClass(cliente.tx)}`}>
            <FaArrowUp className="contatos-signal-info__icon" title="TX" />
            <span className="contatos-signal-info__value">TX: {cliente.tx.toFixed(2)} dBm</span>
          </div>
        </div>
        
        <footer className="contatos-cliente-card__footer">
          <span className="contatos-pon-info">PON: {cliente.ponid}</span>
          <div className="contatos-card-actions">
            {cliente.assigned_to ? (
                <div className="contatos-avatar-wrapper" title={`Assumido por ${cliente.assigned_to_name}`}>
                    <div className="contatos-avatar" style={{ backgroundColor: cliente.assigned_to_avatar ? 'transparent' : (cliente.assigned_to_name || '') }}>
                        {cliente.assigned_to_avatar ? (
                            <img 
                              src={cliente.assigned_to_avatar} 
                              alt={cliente.assigned_to_name || ''} 
                              className="contatos-avatar__image"
                            />
                        ) : (
                            <span className="contatos-avatar__initial">
                              {cliente.assigned_to_name?.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    {isCurrentUserAssigned && (
                        <button 
                            className="contatos-unassign-btn" 
                            title="Desassociar tarefa"
                            onClick={(e) => { e.stopPropagation(); handleUnassignTask(cliente.id); }}
                            aria-label={`Desassociar tarefa do cliente ${cliente.login}`}
                        >
                            <FaTimes />
                        </button>
                    )}
                </div>
            ) : (
                <button 
                    className="contatos-assign-btn" 
                    title="Assumir esta tarefa"
                    onClick={(e) => { e.stopPropagation(); handleAssignTask(cliente.id); }}
                    aria-label={`Assumir tarefa do cliente ${cliente.login}`}
                >
                    <FaUserPlus />
                </button>
            )}
            <button 
              className="btn btn-primary" 
              onClick={() => handleOpenContatoModal(cliente)}
              aria-label={`Ver detalhes do cliente ${cliente.login}`}
            >
              <i className="fa-solid fa-file-lines"></i>
              Detalhes
            </button>
          </div>
        </footer>
      </article>
    );
  };
  
  return (
    <main className="contatos-page" id="contatos-preventivos-page">
      <section className="contatos-stats" aria-label="Estatísticas de contatos por status">
        <div 
          className="contatos-stats__item contatos-stats__item--pendente" 
          onClick={() => handleOpenStatsModal('pendente')}
          role="button"
          tabIndex={0}
          aria-label={`${statusCounts['pendente'] || 0} clientes pendentes`}
        >
          <div className="contatos-stats__number">{statusCounts['pendente'] || 0}</div>
          <div className="contatos-stats__label">
            <FaClock className="contatos-stats__icon" />
            Pendentes
          </div>
        </div>
        
        <div 
          className="contatos-stats__item contatos-stats__item--agendado" 
          onClick={() => handleOpenStatsModal('Agendado O.S.')}
          role="button"
          tabIndex={0}
          aria-label={`${statusCounts['Agendado O.S.'] || 0} clientes com O.S. agendada`}
        >
          <div className="contatos-stats__number">{statusCounts['Agendado O.S.'] || 0}</div>
          <div className="contatos-stats__label">
            <FaCalendarCheck className="contatos-stats__icon" />
            Agendado O.S.
          </div>
        </div>
        
        <div 
          className="contatos-stats__item contatos-stats__item--nao-contatado" 
          onClick={() => handleOpenStatsModal('Nao conseguido contato')}
          role="button"
          tabIndex={0}
          aria-label={`${statusCounts['Nao conseguido contato'] || 0} clientes não contatados`}
        >
          <div className="contatos-stats__number">{statusCounts['Nao conseguido contato'] || 0}</div>
          <div className="contatos-stats__label">
            <FaPhoneSlash className="contatos-stats__icon" />
            Não Contatado
          </div>
        </div>
        
        <div 
          className="contatos-stats__item contatos-stats__item--nao-solucionado" 
          onClick={() => handleOpenStatsModal('Nao solucionado')}
          role="button"
          tabIndex={0}
          aria-label={`${statusCounts['Nao solucionado'] || 0} contatos não solucionados`}
        >
          <div className="contatos-stats__number">{statusCounts['Nao solucionado'] || 0}</div>
          <div className="contatos-stats__label">
            <FaTimesCircle className="contatos-stats__icon" />
            Não Solucionado
          </div>
        </div>
      </section>
      
      <section className="contatos-controls" aria-label="Controles de busca e ordenação">
        <div className="contatos-search">
            <FaSearch className="contatos-search__icon" />
            <input
                type="text"
                placeholder="Buscar por Login, OLT ou PON..."
                className="contatos-search__input"
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                }}
                aria-label="Campo de busca"
            />
        </div>
        
        <div className="contatos-sort-controls">
            <button 
              onClick={() => handleSort('rx')} 
              className="contatos-sort-btn"
              aria-label={`Ordenar por RX ${sortConfig?.key === 'rx' ? (sortConfig.direction === 'asc' ? 'crescente' : 'decrescente') : ''}`}
            >
                <FaSort /> Ordenar por RX {sortConfig?.key === 'rx' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
            </button>
            <button 
              onClick={() => handleSort('tx')} 
              className="contatos-sort-btn"
              aria-label={`Ordenar por TX ${sortConfig?.key === 'tx' ? (sortConfig.direction === 'asc' ? 'crescente' : 'decrescente') : ''}`}
            >
                <FaSort /> Ordenar por TX {sortConfig?.key === 'tx' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
            </button>
        </div>
      </section>

      <section className="contatos-content" aria-label="Lista de clientes">
        {loading ? (
          <div className="contatos-loader" role="status" aria-live="polite">
            <div className="contatos-spinner">
              <div></div><div></div><div></div>
            </div>
            <span className="sr-only">Carregando contatos...</span>
          </div>
        ) : (
          <>
            {paginatedClientes.length > 0 ? (
              <div className="contatos-grid" role="list">
                {paginatedClientes.map(cliente => (
                  <ClienteCard key={cliente.id} cliente={cliente} />
                ))}
              </div>
            ) : (
              <div className="contatos-empty-state" role="status">
                <FaExclamationTriangle className="contatos-empty-state__icon" />
                <h3 className="contatos-empty-state__title">Nenhum cliente encontrado!</h3>
                <p className="contatos-empty-state__message">Verifique se a API de sinais está respondendo ou se há filtros aplicados.</p>
              </div>
            )}
            {totalPages > 1 && <PaginationControls />}
          </>
        )}
      </section>
    </main>
  );
}