import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useModal } from '../contexts/ModalContext';
import { useAuth } from '../contexts/AuthContext'; 
import * as ligacaoService from '../services/ligacoes';
import { Ligacao } from '../types/kanban';
import { Loader } from '../components/ui/Loader';
import toast from 'react-hot-toast';
import styles from './LigacoesPage.module.css';

export function LigacoesPage() {
    const { openModal } = useModal();
    const { user } = useAuth(); 
    const [ligacoes, setLigacoes] = useState<Ligacao[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState('Todos');
    const [sortBy, setSortBy] = useState<'name' | 'date' | 'type'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedLigacoes, setSelectedLigacoes] = useState<number[]>([]);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);

    const fetchLigacoes = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await ligacaoService.getLigacoes();
            setLigacoes(data);
        } catch (error) {
            console.error('Erro ao carregar ligações:', error);
            toast.error("Falha ao carregar ligações. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLigacoes();
    }, [fetchLigacoes]);

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const ligacao = ligacoes.find(l => l.id === id);
        
        toast((t) => (
            <div className="toast-confirmation">
                <p>Tem certeza que deseja excluir a ligação <strong>{ligacao?.name}</strong>?</p>
                <br></br>
                <div className="toast-actions">
                    <button 
                        className="btn btn-danger btn-sm" 
                        onClick={async () => {
                            toast.dismiss(t.id);
                            setIsDeleting(id);
                            try {
                                await ligacaoService.deleteLigacao(id);
                                await fetchLigacoes();
                                toast.success("Ligação excluída com sucesso.");
                            } catch (error) {
                                console.error('Erro ao excluir:', error);
                                toast.error("Erro ao excluir ligação.");
                            } finally {
                                setIsDeleting(null);
                            }
                        }}
                        disabled={isDeleting === id}
                    >
                        {isDeleting === id ? <i className={`fas fa-spinner ${styles.faSpin}`}></i> : 'Excluir'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => toast.dismiss(t.id)}>Cancelar</button>
                </div>
            </div>
        ), { duration: Infinity, style: { maxWidth: '400px', padding: '0', background: 'transparent', boxShadow: 'none' }});
    };

    const handleBulkDelete = async () => {
        if (selectedLigacoes.length === 0) return;
        
        toast((t) => (
            <div className="toast-confirmation">
                <div className="toast-header"><i className="fas fa-exclamation-triangle"></i><span>Confirmar exclusão em lote</span></div>
                <p>Excluir {selectedLigacoes.length} ligação(ões) selecionada(s)?</p>
                <div className="toast-actions">
                    <button 
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                await Promise.all(selectedLigacoes.map(id => ligacaoService.deleteLigacao(id)));
                                await fetchLigacoes();
                                setSelectedLigacoes([]);
                                toast.success(`${selectedLigacoes.length} ligações excluídas.`);
                            } catch (error) { toast.error("Erro ao excluir algumas ligações."); }
                        }}
                    >Excluir Todas</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => toast.dismiss(t.id)}>Cancelar</button>
                </div>
            </div>
        ), { duration: Infinity });
    };

    const toggleSelection = (id: number) => {
        setSelectedLigacoes(prev => prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        setSelectedLigacoes(prev => prev.length === filteredLigacoes.length ? [] : filteredLigacoes.map(l => l.id));
    };

    const filteredLigacoes = useMemo(() => {
        if (!ligacoes.length) return [];
        let filtered = ligacoes.filter(l => {
            const nameMatch = l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
            const addressMatch = l.address?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
            return (searchTerm === '' || nameMatch || addressMatch) && (filterTipo === 'Todos' || l.type === filterTipo);
        });
        filtered.sort((a, b) => {
            let compareValue = 0;
            switch (sortBy) {
                case 'name': compareValue = (a.name || '').localeCompare(b.name || ''); break;
                case 'date': compareValue = (a.end_date ? new Date(a.end_date).getTime() : 0) - (b.end_date ? new Date(b.end_date).getTime() : 0); break;
                case 'type': compareValue = (a.type || '').localeCompare(b.type || ''); break;
            }
            return sortOrder === 'asc' ? compareValue : -compareValue;
        });
        return filtered;
    }, [ligacoes, searchTerm, filterTipo, sortBy, sortOrder]);

    const handleSort = (field: 'name' | 'date' | 'type') => {
        setSortBy(field);
        setSortOrder(sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc');
    };

    const getSortIcon = (field: 'name' | 'date' | 'type') => {
        if (sortBy !== field) return 'fas fa-sort';
        return sortOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    };

    if (isLoading) return <Loader fullScreen={false} />;

    return (
        <div className={styles.ligacoesPage}>
            <div className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.headerTitle}><h1><i className="fas fa-phone-volume"></i>Ligações Ativas</h1><p>Gerencie ligações ativas para condomínios e bairros.</p></div>
                    {user?.user_metadata?.is_admin && (
                        <div className={styles.headerActions}>
                            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnCreate}`} onClick={() => openModal('ligacao', { onSave: fetchLigacoes })}><i className="fas fa-plus"></i><span>Nova Ligação Ativa</span></button>
                        </div>
                    )}
                </div>
                {user?.user_metadata?.is_admin && selectedLigacoes.length > 0 && (
                    <div className={styles.bulkActions}>
                        <span className={styles.selectedCount}>{selectedLigacoes.length} selecionada(s)</span>
                        <button className={`btn ${styles.btnDanger} ${styles.btnSm}`} onClick={handleBulkDelete}><i className="fas fa-trash"></i> Excluir Selecionadas</button>
                        <button className={`btn ${styles.btnSecondary} ${styles.btnSm}`} onClick={() => setSelectedLigacoes([])}>Cancelar</button>
                    </div>
                )}
            </div>
            <div className="content-body">
                <div className={styles.dashboardFilters}>
                    <div className={styles.filterGroup}>
                        <div className={styles.searchWrapper}>
                            <i className={`fas fa-search ${styles.searchIcon}`}></i>
                            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${styles.formInput} ${styles.searchInput}`} />
                            {searchTerm && (<button className={styles.clearSearch} onClick={() => setSearchTerm('')} title="Limpar busca"><i className="fas fa-times"></i></button>)}
                        </div>
                        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className={styles.formSelect}>
                            <option value="Todos">Assuntos</option><option value="Condomínio">Condomínio</option><option value="Bairro">Bairro</option><option value="Outros">Outros</option>
                        </select>
                    </div>
                    <div className={styles.sortControls}>
                        <span className={styles.sortLabel}>Ordenar por:</span>
                        <button className={`${styles.sortBtn} ${sortBy === 'name' ? styles.active : ''}`} onClick={() => handleSort('name')}><i className={getSortIcon('name')}></i> Nome</button>
                        <button className={`${styles.sortBtn} ${sortBy === 'date' ? styles.active : ''}`} onClick={() => handleSort('date')}><i className={getSortIcon('date')}></i> Data</button>
                        <button className={`${styles.sortBtn} ${sortBy === 'type' ? styles.active : ''}`} onClick={() => handleSort('type')}><i className={getSortIcon('type')}></i> Tipo</button>
                    </div>
                    {user?.user_metadata?.is_admin && (
                        <div className={styles.actionControls}>
                            {filteredLigacoes.length > 0 && (<button className={`btn ${styles.btnOutline} ${styles.btnSm}`} onClick={toggleSelectAll} title={selectedLigacoes.length === filteredLigacoes.length ? 'Desmarcar todas' : 'Selecionar todas'}><i className={`fas ${selectedLigacoes.length === filteredLigacoes.length ? 'fa-check-square' : 'fa-square'}`}></i>{selectedLigacoes.length === filteredLigacoes.length ? 'Desmarcar' : 'Selecionar'} Todas</button>)}
                        </div>
                    )}
                </div>
                {filteredLigacoes.length === 0 ? (
                    <div className={styles.ligacoesEmptyState}>
                        {searchTerm || filterTipo !== 'Todos' ? (
                            <><div className={styles.emptyIcon}><i className="fas fa-search"></i></div><h3>Nenhuma ligação encontrada</h3><p>Tente ajustar os filtros de busca ou criar uma nova ligação.</p><button className={`btn ${styles.btnPrimary}`} onClick={() => { setSearchTerm(''); setFilterTipo('Todos'); }}>Limpar Filtros</button></>
                        ) : (
                            <><div className={styles.emptyIcon}><i className="fas fa-phone-volume"></i></div><h3>Nenhuma ligação cadastrada</h3><p>Comece criando sua primeira ligação ativa.</p>{user?.user_metadata?.is_admin && <button className={`btn ${styles.btnPrimary}`} onClick={() => openModal('ligacao', { onSave: fetchLigacoes })}><i className="fas fa-plus"></i> Criar Primeira Ligação</button>}</>
                        )}
                    </div>
                ) : (
                    <div className={styles.ligacaoCardGrid}>
                        {filteredLigacoes.map((ligacao) => (
                            <div 
                                key={ligacao.id} 
                                className={`${styles.ligacaoCard} ${selectedLigacoes.includes(ligacao.id) ? styles.selected : ''} ${isDeleting === ligacao.id ? styles.deleting : ''}`} 
                                onClick={() => openModal('ligacao', { 
                                    ligacao, 
                                    onSave: fetchLigacoes,
                                    isReadOnly: !user?.user_metadata?.is_admin 
                                })}
                            >
                                {user?.user_metadata?.is_admin && <div className={styles.ligacaoCardSelection}><input type="checkbox" checked={selectedLigacoes.includes(ligacao.id)} onChange={(e) => { e.stopPropagation(); toggleSelection(ligacao.id); }} className={styles.selectionCheckbox} /></div>}
                                <div className={styles.ligacaoCardImage} style={{ backgroundImage: ligacao.image_url ? `url(${ligacao.image_url})` : 'none' }}>{!ligacao.image_url && (<div className={styles.imagePlaceholder}><i className="fas fa-image"></i></div>)}</div>
                                <div className={styles.ligacaoCardContent}>
                                    <div className={styles.ligacaoCardHeader}>
                                        <h3 title={ligacao.name}>{ligacao.name}</h3>
                                        {user?.user_metadata?.is_admin && <button className={styles.deleteLigacaoBtn} onClick={(e) => handleDelete(e, ligacao.id)} title="Excluir Ligação" disabled={isDeleting === ligacao.id}>{isDeleting === ligacao.id ? (<i className={`fas fa-spinner ${styles.faSpin}`}></i>) : (<i className="fas fa-trash"></i>)}</button>}
                                    </div>
                                    <span className={styles.ligacaoCardType} data-type={ligacao.type}>{ligacao.type}</span>
                                    <div className={styles.ligacaoCardInfo}>
                                        <p className={styles.ligacaoCardAddress}><i className="fas fa-map-marker-alt"></i>{ligacao.address || 'Endereço não informado'}</p>
                                        {ligacao.end_date && (<p className={styles.ligacaoCardDate}><i className="fas fa-calendar"></i>{new Date(ligacao.end_date).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>)}
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); if (ligacao.spreadsheet_url) window.open(ligacao.spreadsheet_url, '_blank'); else toast.error('Nenhuma planilha vinculada a esta ligação.'); }} className={`btn ${styles.btnPrimary} ${!ligacao.spreadsheet_url ? styles.disabled : ''}`} disabled={!ligacao.spreadsheet_url} title={ligacao.spreadsheet_url ? 'Abrir planilha' : 'Nenhuma planilha vinculada'}><i className="fas fa-table"></i> {ligacao.spreadsheet_url ? 'Abrir Planilha' : 'Sem Planilha'}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}