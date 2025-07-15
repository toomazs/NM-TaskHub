import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    FaExclamationTriangle, FaSearch, FaSort, FaChevronLeft, FaChevronRight,
    FaClock, FaCalendarCheck, FaPhoneSlash, FaTimesCircle,
    FaUserPlus, FaTimes, FaMapMarkerAlt, FaBan, FaPhoneAlt,
    FaSortUp, FaSortDown, FaCopy
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useModal } from '../contexts/ModalContext';
import { useAuth } from '../contexts/AuthContext';
import { useBoard } from '../contexts/BoardContext';
import { ClienteSinalAlto, ClienteSinalAltoComStatus, StatusKey, User } from '../types/sinal';
import * as contatosService from '../services/contatos';
import styles from './ContatosPage.module.css';
import { userDisplayNameMap } from '../api/config';
import { AssigneeSelector } from '../components/kanban/AssigneeSelector';




// controle mock
import mockDataFromFile from '../assets/sinal_fora_padrao.json';

const USE_MOCK_DATA = true;

const mockClientes: ClienteSinalAltoComStatus[] = (mockDataFromFile as ClienteSinalAlto[]).map(cliente => ({
    ...cliente,
    status: 'pendente',
    anotacao: undefined,
    assigned_to: undefined,
}));
// controle mock




const FaArrowDown = (props: any) => <svg {...props} stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M413.1 222.5l22.2 22.2c9.4 9.4 9.4 24.6 0 33.9L241 473c-9.4 9.4-24.6 9.4-33.9 0L12.7 278.6c-9.4-9.4-9.4-24.6 0-33.9l22.2-22.2c9.5-9.5 25-9.3 34.3.4L184 343.4V40c0-13.3 10.7-24 24-24h32c13.3 0 24 10.7 24 24v303.4l114.9-120.5c9.3-9.8 24.8-10 34.3-.4z"></path></svg>;
const FaArrowUp = (props: any) => <svg {...props} stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M34.9 289.5l-22.2-22.2c-9.4-9.4-9.4-24.6 0-33.9L207 39c9.4-9.4 24.6-9.4 33.9 0l194.3 194.3c9.4 9.4 9.4 24.6 0 33.9L413 289.4c-9.5 9.5-25 9.3-34.3-.4L264 168.6V472c0 13.3-10.7 24-24 24h-32c-13.3 0-24-10.7-24-24V168.6L69.2 289.1c-9.3 9.8-24.8 10-34.3-.4z"></path></svg>;

export function ContatosPage() {
    const { openModal, closeModal } = useModal();
    const { user } = useAuth();
    const { users } = useBoard();

    const [clientes, setClientes] = useState<ClienteSinalAltoComStatus[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ClienteSinalAlto; direction: 'asc' | 'desc' } | null>({ key: 'rx', direction: 'asc' });
    const [selectedUser, setSelectedUser] = useState<string>('');

    const ITEMS_PER_PAGE = 15;

    const usersMap = useMemo(() => {
        if (!users || users.length === 0) return new Map<string, User>();
        return new Map(users.map(u => [u.id, u]));
    }, [users]);

    const fetchAndMergeData = useCallback(async () => {
        if (!USE_MOCK_DATA && usersMap.size === 0) return;
        setLoading(true);
        try {
            let finalClientes: ClienteSinalAltoComStatus[];
            if (USE_MOCK_DATA) {
                finalClientes = mockClientes;
            } else {
                const [sinaisData, statusData] = await Promise.all([
                    contatosService.getSinais(),
                    contatosService.getContatosStatus()
                ]);
                const statusMap = new Map(statusData.map(s => [s.contato_id, s]));
                finalClientes = (sinaisData.data as ClienteSinalAlto[]).map(c => ({
                    ...c,
                    status: statusMap.get(c.id)?.status ?? 'pendente',
                    anotacao: statusMap.get(c.id)?.anotacao,
                    assigned_to: statusMap.get(c.id)?.assigned_to,
                }));
            }
            setClientes(finalClientes);
        } catch (error) {
            console.error("Erro final na página de contatos:", error);
            toast.error("Não foi possível carregar os dados. A API pode estar offline.");
        } finally {
            setLoading(false);
        }
    }, [usersMap]);

    useEffect(() => {
        fetchAndMergeData();
    }, [fetchAndMergeData]);

    const updateClienteState = useCallback((clienteId: string, updates: Partial<ClienteSinalAltoComStatus>) => {
        setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, ...updates } : c));
    }, []);

    const handleSaveResolution = useCallback(async (clienteId: string, status: StatusKey, resolucao: string) => {
        if (USE_MOCK_DATA) {
            updateClienteState(clienteId, { status, anotacao: resolucao });
            toast.success(`(Mock) Status de ${clienteId} alterado para ${status}`);
            return;
        }

        const loadingToast = toast.loading("Salvando alteração...");
        try {
            await contatosService.setContatoStatus({ contato_id: clienteId, status, anotacao: resolucao });
            updateClienteState(clienteId, { status, anotacao: resolucao });
            toast.success("Status atualizado com sucesso!", { id: loadingToast });
        } catch (error: any) {
            toast.error(error.message || "Falha ao salvar alteração.", { id: loadingToast });
        }
    }, [updateClienteState]);

    const handleAssignTask = useCallback(async (clienteId: string) => {
        if (!user) return;
        
        if (USE_MOCK_DATA) {
            updateClienteState(clienteId, { assigned_to: user.id });
            toast.success(`(Mock) Você assumiu o cliente!`);
            return;
        }

        const loadingToast = toast.loading("Assumindo tarefa...");
        try {
            const result = await contatosService.assignContato(clienteId);
            updateClienteState(clienteId, { assigned_to: result.assigned_to });
            toast.success(`Você assumiu o cliente!`, { id: loadingToast });
        } catch (error: any) {
            toast.error(error.message || "Falha ao assumir a tarefa.", { id: loadingToast });
        }
    }, [user, updateClienteState]);

    const handleUnassignTask = useCallback(async (clienteId: string) => {
        if (USE_MOCK_DATA) {
            updateClienteState(clienteId, { assigned_to: undefined });
            toast.success(`(Mock) Tarefa desassociada.`);
            return;
        }

        const loadingToast = toast.loading("Removendo associação...");
        try {
            await contatosService.unassignContato(clienteId);
            updateClienteState(clienteId, { assigned_to: undefined });
            toast.success(`Desassociado desta tarefa.`, { id: loadingToast });
        } catch (error: any) {
            toast.error(error.message || "Falha ao remover associação.", { id: loadingToast });
        }
    }, [updateClienteState]);
    
    const handleAdminAssignTask = useCallback(async (clienteId: string, assigneeId: string) => {
        if (USE_MOCK_DATA) {
            updateClienteState(clienteId, { assigned_to: assigneeId });
            const userAssigned = users.find(u => u.id === assigneeId);
            const userName = userAssigned ? (userDisplayNameMap[userAssigned.email] || userAssigned.username) : 'desconhecido';
            toast.success(`(Mock) Tarefa atribuída para ${userName}`);
            return;
        }
        
        try {
            const result = await contatosService.adminAssignContato(clienteId, assigneeId);
            updateClienteState(clienteId, { assigned_to: result.assigned_to });
        } catch (error: any) {
            throw new Error(error.message || "Falha ao atribuir tarefa.");
        }
    }, [users, updateClienteState]);

    const handleOpenContatoModal = (cliente: ClienteSinalAltoComStatus) => {
        openModal('contato', { cliente, onSave: handleSaveResolution, onAssign: handleAssignTask, onUnassign: handleUnassignTask, onAdminAssign: handleAdminAssignTask });
    };
    
    const handleOpenAdminAssign = (cliente: ClienteSinalAltoComStatus) => {
        const handleSelectAndClose = async (assigneeId: string | null) => {
            closeModal(); 

            if (assigneeId === cliente.assigned_to) return; 

            const loadingToast = toast.loading("Atualizando atribuição...");

            try {
                if (assigneeId) {
                    await handleAdminAssignTask(cliente.id, assigneeId);
                    const userAssigned = users.find(u => u.id === assigneeId);
                    const userName = userAssigned ? (userDisplayNameMap[userAssigned.email] || userAssigned.username) : 'desconhecido';
                    toast.success(`Tarefa atribuída para ${userName}`, { id: loadingToast });
                } else {
                    await handleUnassignTask(cliente.id);
                    toast.dismiss(loadingToast);
                }
            } catch (error: any) {
                toast.error(error.message || "Falha ao atualizar atribuição.", { id: loadingToast });
            }
        };

        openModal('component', {
            title: `Atribuir: ${cliente.login || 'N/A'}`,
            children: (
                <AssigneeSelector
                    users={users}
                    onSelect={handleSelectAndClose}
                    currentSelection={cliente.assigned_to}
                    valueType="id"
                    allowUnassign={true}
                    unassignText="Desatribuir"
                />
            )
        });
    };

    const handleOpenStatsModal = (status: StatusKey) => {
        const statusConfig = {
            'pendente': { title: 'Clientes Pendentes de Contato', icon: FaClock },
            'Agendado O.S.': { title: 'Clientes com O.S. Agendada', icon: FaCalendarCheck },
            'Nao conseguido contato': { title: 'Clientes Não Contatados', icon: FaPhoneSlash },
            'Nao solucionado': { title: 'Contatos Não Solucionados', icon: FaTimesCircle },
            'Cancelados': { title: 'Contatos Cancelados', icon: FaBan }
        };
        const config = statusConfig[status];
        openModal('contatoStats', {
            title: config.title, Icon: config.icon, clientes: clientes.filter(c => c.status === status), 
            onSave: handleSaveResolution,
            onAssign: handleAssignTask,
            onUnassign: handleUnassignTask,
            onAdminAssign: handleAdminAssignTask,
            openModal: openModal,
        });
    };
    
    const clientesPendentes = useMemo(() => {
        let items = clientes.filter(c => c.status === 'pendente');
        if (selectedUser) {
            items = items.filter(item => item.assigned_to === selectedUser);
        }
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            items = items.filter(item =>
                (item.login && item.login.toLowerCase().includes(lowercasedFilter)) ||
                (item.olt && item.olt.toLowerCase().includes(lowercasedFilter)) ||
                (item.ponid && item.ponid.toLowerCase().includes(lowercasedFilter)) ||
                (item.endereco?.rua && item.endereco.rua.toLowerCase().includes(lowercasedFilter)) ||
                (item.endereco?.bairro && item.endereco.bairro.toLowerCase().includes(lowercasedFilter))
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
    }, [clientes, searchTerm, sortConfig, selectedUser]);

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

    const handleCopyToClipboard = (text: string, e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (text) {
            navigator.clipboard.writeText(text).then(() => {
                toast.success('Telefone copiado!');
            }, (err) => {
                console.error('Falha ao copiar: ', err);
                toast.error('Não foi possível copiar o telefone.');
            });
        } else {
            toast.error('Nenhum telefone para copiar.');
        }
    };

    const SortIcon = ({ field }: { field: keyof ClienteSinalAlto }) => {
        if (sortConfig?.key !== field) {
            return <FaSort />;
        }
        if (sortConfig.direction === 'asc') {
            return <FaSortUp />;
        }
        return <FaSortDown />;
    };

    const PaginationControls = () => (
        <nav className={styles.contatosPagination} aria-label="Navegação de páginas">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className={styles.contatosPaginationBtn} aria-label="Página anterior">
                <FaChevronLeft /> Anterior
            </button>
            <span className={styles.contatosPaginationInfo}>
                Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
            </span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className={styles.contatosPaginationBtn} aria-label="Próxima página">
                Próximo <FaChevronRight />
            </button>
        </nav>
    );

    const ClienteCard = ({ cliente }: { cliente: ClienteSinalAltoComStatus }) => {
        const isCurrentUserAssigned = user?.id === cliente.assigned_to;
        const isAdmin = user?.user_metadata?.is_admin;
        const cardClasses = [ styles.contatosClienteCard, cliente.assigned_to ? styles.contatosClienteCardAssigned : '', isCurrentUserAssigned ? styles.currentUserAssigned : '' ].filter(Boolean).join(' ');
        const assignedUser = cliente.assigned_to ? usersMap.get(cliente.assigned_to) : null;
    
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
    
                <div className={styles.contatosClienteDetails}>
                    <div className={styles.detailItem}>
                        <div className={styles.detailItemContent}>
                           <FaPhoneAlt className={styles.detailIcon} />
                           <span>{cliente.contatos.fone}</span>
                        </div>
                        <button 
                            className={styles.copyButton} 
                            onClick={(e) => handleCopyToClipboard(cliente.contatos.fone, e)}
                            title="Copiar telefone"
                            aria-label="Copiar número de telefone"
                        >
                            <FaCopy />
                        </button>
                    </div>
                </div>
    
                <footer className={styles.contatosClienteCardFooter}>
                    <span className={styles.contatosPonInfo}>PON: {cliente.ponid}</span>
                    <div className={styles.contatosCardActions}>
                        {cliente.assigned_to ? (
                            <div className={styles.contatosAvatarWrapper} title={`Assumido por ${assignedUser ? (userDisplayNameMap[assignedUser.email] || assignedUser.username) : 'desconhecido'}`}>
                                <div className={styles.contatosAvatar}>
                                    {assignedUser?.avatar ? (
                                        <img src={assignedUser.avatar} alt={assignedUser.username || ''} className={styles.contatosAvatarImage}/>
                                    ) : (
                                        <span className={styles.contatosAvatarInitial}>
                                            {(assignedUser ? (userDisplayNameMap[assignedUser.email] || assignedUser.username) : '').charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                {(isCurrentUserAssigned || isAdmin) && (
                                    <button className={styles.contatosUnassignBtn} title="Desassociar tarefa" onClick={(e) => { e.stopPropagation(); handleUnassignTask(cliente.id); }}>
                                        <FaTimes />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button 
                                className={styles.contatosAssignBtn} 
                                title={isAdmin ? "Atribuir para..." : "Assumir esta tarefa"} 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (isAdmin) {
                                        handleOpenAdminAssign(cliente);
                                    } else {
                                        handleAssignTask(cliente.id);
                                    }
                                }}
                            >
                                <FaUserPlus />
                            </button>
                        )}
                        <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); handleOpenContatoModal(cliente); }}>
                            <i className="fa-solid fa-file-lines"></i> Detalhes
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
                    <h1><i className="fa-solid fa-house-signal"></i> Contatos Preventivos </h1>
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
                    <div className={styles.contatosStatsLabel}><FaPhoneSlash className={styles.contatosStatsIcon} />Não Conseguido Contato</div>
                </div>
                <div className={`${styles.contatosStatsItem} ${styles.contatosStatsItemNaoSolucionado}`} onClick={() => handleOpenStatsModal('Nao solucionado')}>
                    <div className={styles.contatosStatsNumber}>{statusCounts['Nao solucionado'] || 0}</div>
                    <div className={styles.contatosStatsLabel}><FaTimesCircle className={styles.contatosStatsIcon} />Não Solucionado</div>
                </div>
                <div className={`${styles.contatosStatsItem} ${styles.contatosStatsItemCancelado}`} onClick={() => handleOpenStatsModal('Cancelados')}>
                    <div className={styles.contatosStatsNumber}>{statusCounts['Cancelados'] || 0}</div>
                    <div className={styles.contatosStatsLabel}><FaBan className={styles.contatosStatsIcon} />Cancelados</div>
                </div>
            </section>

            <section className={styles.contatosControls} aria-label="Controles de busca e ordenação">
                <div className={styles.contatosSearch}>
                    <FaSearch className={styles.contatosSearchIcon} />
                    <input type="text" placeholder="Buscar por Login, OLT, PON, Endereço..." className={styles.contatosSearchInput} value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
                <div className={styles.contatosSortControls}>
                    <select
                        className={styles.contatosUserFilter}
                        value={selectedUser}
                        onChange={(e) => {
                            setSelectedUser(e.target.value);
                            setCurrentPage(1);
                        }}
                    >
                        <option value="">Todos os Colaboradores</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>
                                {userDisplayNameMap[u.email] || u.username}
                            </option>
                        ))}
                    </select>
                    
                    <button onClick={() => handleSort('rx')} className={styles.contatosSortBtn}>
                        <SortIcon field="rx" /> Ordenar por RX
                    </button>
                    <button onClick={() => handleSort('tx')} className={styles.contatosSortBtn}>
                        <SortIcon field="tx" /> Ordenar por TX
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
                                <p className={styles.contatosEmptyStateMessage}>Verifique seus filtros ou se existem clientes pendentes.</p>
                            </div>
                        )}
                        {totalPages > 1 && <PaginationControls />}
                    </>
                )}
            </section>
        </main>
    );
}