import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    FaExclamationTriangle, FaSearch, FaSort, FaChevronLeft, FaChevronRight,
    FaClock, FaCalendarCheck, FaPhoneSlash, FaTimesCircle,
    FaUserPlus, FaTimes, FaUserEdit
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useModal } from '../contexts/ModalContext';
import { useAuth } from '../contexts/AuthContext';
import { useBoard } from '../contexts/BoardContext';
import { ClienteSinalAlto, ClienteSinalAltoComStatus, StatusKey } from '../types/sinal';
import * as contatosService from '../services/contatos';
import styles from './ContatosPage.module.css';

// controle dev fora de rede interna
const USE_MOCK_DATA = false;

const mockClientes: ClienteSinalAltoComStatus[] = [
    {
      id: '1', login: 'cliente_mock_1', olt: 'OLT-1', ponid: '1/1/1', rx: -28.5, tx: 2.1, status: 'pendente',
      mac: ''
    },
    {
      id: '2', login: 'cliente_mock_2', olt: 'OLT-1', ponid: '1/1/2', rx: -29.2, tx: 2.3, status: 'pendente',
      mac: ''
    },
    {
      id: '3', login: 'cliente_atribuido_admin', olt: 'OLT-2', ponid: '2/1/1', rx: -27.8, tx: 1.9, status: 'pendente', assigned_to: 'ID_DO_ADMIN', assigned_to_name: 'Admin User', assigned_to_avatar: undefined,
      mac: ''
    },
    {
      id: '4', login: 'cliente_com_os', olt: 'OLT-2', ponid: '2/1/2', rx: -30.1, tx: 2.5, status: 'Agendado O.S.', anotacao: 'OS agendada para amanhã.',
      mac: ''
    },
    {
      id: '5', login: 'cliente_nao_contatado', olt: 'OLT-3', ponid: '3/1/1', rx: -28.1, tx: 2.0, status: 'Nao conseguido contato', anotacao: 'Tentei ligar 3 vezes.',
      mac: ''
    },
];


const FaArrowDown = (props: any) => <svg {...props} stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M413.1 222.5l22.2 22.2c9.4 9.4 9.4 24.6 0 33.9L241 473c-9.4 9.4-24.6 9.4-33.9 0L12.7 278.6c-9.4-9.4-9.4-24.6 0-33.9l22.2-22.2c9.5-9.5 25-9.3 34.3.4L184 343.4V40c0-13.3 10.7-24 24-24h32c13.3 0 24 10.7 24 24v303.4l114.9-120.5c9.3-9.8 24.8-10 34.3-.4z"></path></svg>;
const FaArrowUp = (props: any) => <svg {...props} stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M34.9 289.5l-22.2-22.2c-9.4-9.4-9.4-24.6 0-33.9L207 39c9.4-9.4 24.6-9.4 33.9 0l194.3 194.3c9.4 9.4 9.4 24.6 0 33.9L413 289.4c-9.5 9.5-25 9.3-34.3-.4L264 168.6V472c0 13.3-10.7 24-24 24h-32c-13.3 0-24-10.7-24-24V168.6L69.2 289.1c-9.3 9.8-24.8 10-34.3-.4z"></path></svg>;

export function ContatosPage() {
    const { openModal } = useModal();
    const { user } = useAuth();
    const { users } = useBoard(); 

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
            toast.error("Não foi possível carregar os dados. A API de sinais pode estar offline.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (USE_MOCK_DATA) {
            setClientes(mockClientes);
            setLoading(false);
        } else {
            fetchAndMergeData();
        }
    }, [fetchAndMergeData]);

    const updateClienteState = (clienteId: string, updates: Partial<ClienteSinalAltoComStatus>) => {
        setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, ...updates } : c));
    };
    
    const handleSaveResolution = useCallback(async (clienteId: string, status: StatusKey, resolucao: string) => {
        const loadingToast = toast.loading("Salvando alteração...");
        try {
            await contatosService.setContatoStatus({
                contato_id: clienteId,
                status,
                anotacao: resolucao
            });
            updateClienteState(clienteId, { status, anotacao: resolucao });
            toast.success("Status atualizado com sucesso!", { id: loadingToast });
        } catch (error) {
            toast.error("Falha ao salvar alteração.", { id: loadingToast });
        }
    }, []);
    
    const handleAssignTask = useCallback(async (clienteId: string) => {
        if (!user) return;
        const loadingToast = toast.loading("Assumindo tarefa...");
        try {
            const result = await contatosService.assignContato(clienteId);
            updateClienteState(clienteId, { 
                assigned_to: result.assigned_to, 
                assigned_to_name: result.assigned_to_name,
                assigned_to_avatar: result.assigned_to_avatar,
            });
            toast.success(`Você assumiu o cliente!`, { id: loadingToast });
        } catch (error: any) {
            toast.error(error.message || "Falha ao assumir a tarefa.", { id: loadingToast });
        }
    }, [user]);

    const handleUnassignTask = useCallback(async (clienteId: string) => {
        const loadingToast = toast.loading("Removendo associação...");
        try {
            await contatosService.unassignContato(clienteId);
            updateClienteState(clienteId, {
                assigned_to: undefined, 
                assigned_to_name: undefined,
                assigned_to_avatar: undefined,
            });
            toast.success(`Desassociado desta tarefa.`, { id: loadingToast });
        } catch (error: any) {
            toast.error(error.message || "Falha ao remover associação.", { id: loadingToast });
        }
    }, []);

    const handleAdminAssignTask = useCallback(async (clienteId: string, assigneeId: string) => {
        try {
            const result = await contatosService.adminAssignContato(clienteId, assigneeId);
            updateClienteState(clienteId, {
                assigned_to: result.assigned_to,
                assigned_to_name: result.assigned_to_name,
                assigned_to_avatar: result.assigned_to_avatar,
            });
        } catch (error: any) {
            throw new Error(error.message || "Falha ao atribuir tarefa.");
        }
    }, []);
    
    const handleOpenContatoModal = (cliente: ClienteSinalAltoComStatus) => {
        openModal('contato', { 
            cliente, 
            onSave: handleSaveResolution,
            onAssign: handleAssignTask,
            onUnassign: handleUnassignTask,
            onAdminAssign: handleAdminAssignTask,
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
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
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
        }, {} as Record<string, number>);
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
        if (value <= -29) return styles.contatosSignalDanger;
        if (value > -29 && value <= -27) return styles.contatosSignalWarning;
        return styles.contatosSignalGood;
    };

    const PaginationControls = () => (
        <nav className={styles.contatosPagination} aria-label="Navegação de páginas">
            <button 
                onClick={() => handlePageChange(currentPage - 1)} 
                disabled={currentPage === 1} 
                className={styles.contatosPaginationBtn}
                aria-label="Página anterior"
            >
                <FaChevronLeft /> Anterior
            </button>
            <span className={styles.contatosPaginationInfo}>
                Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
            </span>
            <button 
                onClick={() => handlePageChange(currentPage + 1)} 
                disabled={currentPage === totalPages} 
                className={styles.contatosPaginationBtn}
                aria-label="Próxima página"
            >
                Próximo <FaChevronRight />
            </button>
        </nav>
    );

    const ClienteCard = ({ cliente }: { cliente: ClienteSinalAltoComStatus }) => {
        const isCurrentUserAssigned = user?.id === cliente.assigned_to;
        const isAdmin = user?.user_metadata?.is_admin;
        const cardClasses = [
            styles.contatosClienteCard,
            cliente.assigned_to ? styles.contatosClienteCardAssigned : '',
            isCurrentUserAssigned ? styles.currentUserAssigned : ''
        ].filter(Boolean).join(' ');
    
        return (
            <article className={cardClasses} onClick={() => handleOpenContatoModal(cliente)}>
                <header className={styles.contatosClienteCardHeader}>
                    <h4 className={styles.contatosClienteCardTitle}>{cliente.login || 'N/A'}</h4>
                    <span className={styles.contatosClienteCardOlt}>{cliente.olt}</span>
                </header>
                
                <div className={styles.contatosClienteCardBody}>
                    <div className={`${styles.contatosSignalInfo} ${getSignalClass(cliente.rx)}`}>
                        <FaArrowDown className={styles.contatosSignalInfoIcon} title="RX" />
                        <span className={styles.contatosSignalInfoValue}>RX: {cliente.rx.toFixed(2)} dBm</span>
                    </div>
                    <div className={`${styles.contatosSignalInfo} ${getSignalClass(cliente.tx)}`}>
                        <FaArrowUp className={styles.contatosSignalInfoIcon} title="TX" />
                        <span className={styles.contatosSignalInfoValue}>TX: {cliente.tx.toFixed(2)} dBm</span>
                    </div>
                </div>
                
                <footer className={styles.contatosClienteCardFooter}>
                    <span className={styles.contatosPonInfo}>PON: {cliente.ponid}</span>
                    <div className={styles.contatosCardActions}>
                        {cliente.assigned_to ? (
                            <div className={styles.contatosAvatarWrapper} title={`Assumido por ${cliente.assigned_to_name}`}>
                                <div className={styles.contatosAvatar} style={{ backgroundColor: cliente.assigned_to_avatar ? 'transparent' : (cliente.assigned_to_name || '') }}>
                                    {cliente.assigned_to_avatar ? (
                                        <img 
                                            src={cliente.assigned_to_avatar} 
                                            alt={cliente.assigned_to_name || ''} 
                                            className={styles.contatosAvatarImage}
                                        />
                                    ) : (
                                        <span className={styles.contatosAvatarInitial}>
                                            {cliente.assigned_to_name?.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                {(isCurrentUserAssigned || isAdmin) && (
                                    <button 
                                        className={styles.contatosUnassignBtn} 
                                        title="Desassociar tarefa"
                                        onClick={(e) => { e.stopPropagation(); handleUnassignTask(cliente.id); }}
                                    >
                                        <FaTimes />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button 
                                className={styles.contatosAssignBtn} 
                                title="Assumir esta tarefa"
                                onClick={(e) => { e.stopPropagation(); handleAssignTask(cliente.id); }}
                            >
                                <FaUserPlus />
                            </button>
                        )}
                        <button 
                            className="btn btn-primary"
                            onClick={() => handleOpenContatoModal(cliente)}
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
        <main className={styles.contatosPage} id="contatos-preventivos-page">
            <header className={styles.contatosHeader}>
                <div className={styles.contatosHeaderTitle}>
                    <h1><i className="fa-solid fa-house-signal"></i> Sinais Atenuados</h1>
                    <p>Gerencie clientes com sinal fora do padrão e registre ações de contato.</p>
                </div>
            </header>

            <section className={styles.contatosStats} aria-label="Estatísticas de contatos por status">
                <div className={`${styles.contatosStatsItem} ${styles.contatosStatsItemPendente}`} onClick={() => handleOpenStatsModal('pendente')}>
                    <div className={styles.contatosStatsNumber}>{statusCounts['pendente'] || 0}</div>
                    <div className={styles.contatosStatsLabel}><FaClock className={styles.contatosStatsIcon} />Pendentes</div>
                </div>
                <div className={`${styles.contatosStatsItem} ${styles.contatosStatsItemAgendado}`} onClick={() => handleOpenStatsModal('Agendado O.S.')}>
                    <div className={styles.contatosStatsNumber}>{statusCounts['Agendado O.S.'] || 0}</div>
                    <div className={styles.contatosStatsLabel}><FaCalendarCheck className={styles.contatosStatsIcon} />Agendado O.S.</div>
                </div>
                <div className={`${styles.contatosStatsItem} ${styles.contatosStatsItemNaoContatado}`} onClick={() => handleOpenStatsModal('Nao conseguido contato')}>
                    <div className={styles.contatosStatsNumber}>{statusCounts['Nao conseguido contato'] || 0}</div>
                    <div className={styles.contatosStatsLabel}><FaPhoneSlash className={styles.contatosStatsIcon} />Não Contatado</div>
                </div>
                <div className={`${styles.contatosStatsItem} ${styles.contatosStatsItemNaoSolucionado}`} onClick={() => handleOpenStatsModal('Nao solucionado')}>
                    <div className={styles.contatosStatsNumber}>{statusCounts['Nao solucionado'] || 0}</div>
                    <div className={styles.contatosStatsLabel}><FaTimesCircle className={styles.contatosStatsIcon} />Não Solucionado</div>
                </div>
            </section>
            
            <section className={styles.contatosControls} aria-label="Controles de busca e ordenação">
                <div className={styles.contatosSearch}>
                    <FaSearch className={styles.contatosSearchIcon} />
                    <input
                        type="text"
                        placeholder="Buscar por Login, OLT ou PON..."
                        className={styles.contatosSearchInput}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
                
                <div className={styles.contatosSortControls}>
                    <button onClick={() => handleSort('rx')} className={styles.contatosSortBtn}>
                        <FaSort /> Ordenar por RX {sortConfig?.key === 'rx' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </button>
                    <button onClick={() => handleSort('tx')} className={styles.contatosSortBtn}>
                        <FaSort /> Ordenar por TX {sortConfig?.key === 'tx' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                    </button>
                </div>
            </section>

            <section className={styles.contatosContent} aria-label="Lista de clientes">
                {loading ? (
                    <div className={styles.contatosLoader}>
                        <div className={styles.contatosSpinner}>
                            <div></div><div></div><div></div>
                        </div>
                    </div>
                ) : (
                    <>
                        {paginatedClientes.length > 0 ? (
                            <div className={styles.contatosGrid}>
                                {paginatedClientes.map(cliente => (
                                    <ClienteCard key={cliente.id} cliente={cliente} />
                                ))}
                            </div>
                        ) : (
                            <div className={styles.contatosEmptyState}>
                                <FaExclamationTriangle className={styles.contatosEmptyStateIcon} />
                                <h3 className={styles.contatosEmptyStateTitle}>Nenhum cliente encontrado!</h3>
                                <p className={styles.contatosEmptyStateMessage}>Verifique se a API de sinais está respondendo ou se há filtros aplicados.</p>
                            </div>
                        )}
                        {totalPages > 1 && <PaginationControls />}
                    </>
                )}
            </section>
        </main>
    );
}