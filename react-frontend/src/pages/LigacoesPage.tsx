import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useModal } from '../contexts/ModalContext';
import * as ligacaoService from '../services/ligacoes';
import { Ligacao } from '../types/kanban';
import { Loader } from '../components/ui/Loader';
import toast from 'react-hot-toast';

export function LigacoesPage() {
    const { openModal } = useModal();
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
                <div className="toast-header">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>Confirmar exclusão</span>
                </div>
                <p>Tem certeza que deseja excluir a ligação <strong>{ligacao?.name}</strong>?</p>
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
                        {isDeleting === id ? <i className="fas fa-spinner fa-spin"></i> : 'Excluir'}
                    </button>
                    <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        ), {
            duration: Infinity,
            style: {
                maxWidth: '400px',
                padding: '0',
                background: 'transparent',
                boxShadow: 'none'
            }
        });
    };

    const handleBulkDelete = async () => {
        if (selectedLigacoes.length === 0) return;
        
        toast((t) => (
            <div className="toast-confirmation">
                <div className="toast-header">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>Confirmar exclusão em lote</span>
                </div>
                <p>Excluir {selectedLigacoes.length} ligação(ões) selecionada(s)?</p>
                <div className="toast-actions">
                    <button 
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                await Promise.all(
                                    selectedLigacoes.map(id => ligacaoService.deleteLigacao(id))
                                );
                                await fetchLigacoes();
                                setSelectedLigacoes([]);
                                toast.success(`${selectedLigacoes.length} ligações excluídas.`);
                            } catch (error) {
                                toast.error("Erro ao excluir algumas ligações.");
                            }
                        }}
                    >
                        Excluir Todas
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

    const toggleSelection = (id: number) => {
        setSelectedLigacoes(prev => 
            prev.includes(id) 
                ? prev.filter(selectedId => selectedId !== id)
                : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        setSelectedLigacoes(prev => 
            prev.length === filteredLigacoes.length 
                ? [] 
                : filteredLigacoes.map(l => l.id)
        );
    };

    const sortedAndFilteredLigacoes = useMemo(() => {
        if (!ligacoes.length) return [];
        
        let filtered = ligacoes.filter(l => {
            const nameMatch = l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
            const addressMatch = l.address?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
            const matchesSearch = searchTerm === '' || nameMatch || addressMatch;
            const matchesFilter = filterTipo === 'Todos' || l.type === filterTipo;
            return matchesSearch && matchesFilter;
        });

        filtered.sort((a, b) => {
            let compareValue = 0;
            
            switch (sortBy) {
                case 'name':
                    compareValue = (a.name || '').localeCompare(b.name || '');
                    break;
                case 'date':
                    const dateA = a.end_date ? new Date(a.end_date).getTime() : 0;
                    const dateB = b.end_date ? new Date(b.end_date).getTime() : 0;
                    compareValue = dateA - dateB;
                    break;
                case 'type':
                    compareValue = (a.type || '').localeCompare(b.type || '');
                    break;
            }
            
            return sortOrder === 'asc' ? compareValue : -compareValue;
        });

        return filtered;
    }, [ligacoes, searchTerm, filterTipo, sortBy, sortOrder]);

    const filteredLigacoes = sortedAndFilteredLigacoes;

    const handleSort = (field: 'name' | 'date' | 'type') => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    const getSortIcon = (field: 'name' | 'date' | 'type') => {
        if (sortBy !== field) return 'fas fa-sort';
        return sortOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    };

    if (isLoading) return <Loader fullScreen={false} />;

    return (
        <div className="ligacoes-page">
            <div className="page-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1>
                            <i className="fas fa-phone-volume"></i>
                            Ligações Ativas
                        </h1>
                        <p>Gerencie ligações ativas para condomínios e bairros</p>
                    </div>
                    <div className="header-actions">
                        <button 
                            className="btn btn-primary btn-create" 
                            onClick={() => openModal('ligacao', { onSave: fetchLigacoes })}
                        >
                            <i className="fas fa-plus"></i>
                            <span>Nova Ligação Ativa</span>
                        </button>
                    </div>
                </div>
                
                {selectedLigacoes.length > 0 && (
                    <div className="bulk-actions">
                        <span className="selected-count">
                            {selectedLigacoes.length} selecionada(s)
                        </span>
                        <button 
                            className="btn btn-danger btn-sm"
                            onClick={handleBulkDelete}
                        >
                            <i className="fas fa-trash"></i> Excluir Selecionadas
                        </button>
                        <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedLigacoes([])}
                        >
                            Cancelar
                        </button>
                    </div>
                )}
            </div>

            <div className="content-body">
                <div className="dashboard-filters">
                    <div className="filter-group">
                        <div className="search-wrapper">
                            <i className="fas fa-search search-icon"></i>
                            <input 
                                type="text" 
                                placeholder="Buscar..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                className="form-input search-input"
                            />
                            {searchTerm && (
                                <button 
                                    className="clear-search"
                                    onClick={() => setSearchTerm('')}
                                    title="Limpar busca"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>

                        <select 
                            value={filterTipo} 
                            onChange={(e) => setFilterTipo(e.target.value)} 
                            className="form-select"
                        >
                            <option value="Todos">Assuntos</option>
                            <option value="Condomínio">Condomínio</option>
                            <option value="Bairro">Bairro</option>
                            <option value="Outros">Outros</option>
                        </select>
                    </div>

                    <div className="sort-controls">
                        <span className="sort-label">Ordenar por:</span>
                        <button 
                            className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
                            onClick={() => handleSort('name')}
                        >
                            <i className={getSortIcon('name')}></i> Nome
                        </button>
                        <button 
                            className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`}
                            onClick={() => handleSort('date')}
                        >
                            <i className={getSortIcon('date')}></i> Data
                        </button>
                        <button 
                            className={`sort-btn ${sortBy === 'type' ? 'active' : ''}`}
                            onClick={() => handleSort('type')}
                        >
                            <i className={getSortIcon('type')}></i> Tipo
                        </button>
                    </div>

                    <div className="action-controls">
                        {filteredLigacoes.length > 0 && (
                            <button 
                                className="btn btn-outline btn-sm"
                                onClick={toggleSelectAll}
                                title={selectedLigacoes.length === filteredLigacoes.length ? 'Desmarcar todas' : 'Selecionar todas'}
                            >
                                <i className={`fas ${selectedLigacoes.length === filteredLigacoes.length ? 'fa-check-square' : 'fa-square'}`}></i>
                                {selectedLigacoes.length === filteredLigacoes.length ? 'Desmarcar' : 'Selecionar'} Todas
                            </button>
                        )}
                    </div>
                </div>
                
                {filteredLigacoes.length === 0 ? (
                    <div className="ligacoes-empty-state">
                        {searchTerm || filterTipo !== 'Todos' ? (
                            <>
                                <div className="empty-icon">
                                    <i className="fas fa-search"></i>
                                </div>
                                <h3>Nenhuma ligação encontrada</h3>
                                <p>Tente ajustar os filtros de busca ou criar uma nova ligação.</p>
                                <button 
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterTipo('Todos');
                                    }}
                                >
                                    Limpar Filtros
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="empty-icon">
                                    <i className="fas fa-phone-volume"></i>
                                </div>
                                <h3>Nenhuma ligação cadastrada</h3>
                                <p>Comece criando sua primeira ligação ativa.</p>
                                <button 
                                    className="btn btn-primary"
                                    onClick={() => openModal('ligacao', { onSave: fetchLigacoes })}
                                >
                                    <i className="fas fa-plus"></i> Criar Primeira Ligação
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="ligacao-card-grid">
                        {filteredLigacoes.map((ligacao) => (
                            <div 
                                key={ligacao.id} 
                                className={`ligacao-card ${selectedLigacoes.includes(ligacao.id) ? 'selected' : ''} ${isDeleting === ligacao.id ? 'deleting' : ''}`}
                                onClick={() => openModal('ligacao', { ligacao, onSave: fetchLigacoes })}
                            >
                                <div className="ligacao-card-selection">
                                    <input
                                        type="checkbox"
                                        checked={selectedLigacoes.includes(ligacao.id)}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            toggleSelection(ligacao.id);
                                        }}
                                        className="selection-checkbox"
                                    />
                                </div>

                                <div 
                                    className="ligacao-card-image" 
                                    style={{
                                        backgroundImage: ligacao.image_url ? `url(${ligacao.image_url})` : 'none'
                                    }}
                                >
                                    {!ligacao.image_url && (
                                        <div className="image-placeholder">
                                            <i className="fas fa-image"></i>
                                        </div>
                                    )}
                                </div>

                                <div className="ligacao-card-content">
                                    <div className="ligacao-card-header">
                                        <h3 title={ligacao.name}>{ligacao.name}</h3>
                                        <button 
                                            className="delete-ligacao-btn" 
                                            onClick={(e) => handleDelete(e, ligacao.id)} 
                                            title="Excluir Ligação"
                                            disabled={isDeleting === ligacao.id}
                                        >
                                            {isDeleting === ligacao.id ? (
                                                <i className="fas fa-spinner fa-spin"></i>
                                            ) : (
                                                <i className="fas fa-trash"></i>
                                            )}
                                        </button>
                                    </div>
                                    
                                    <span 
                                        className="ligacao-card-type" 
                                        data-type={ligacao.type}
                                    >
                                        {ligacao.type}
                                    </span>
                                    
                                    <div className="ligacao-card-info">
                                        <p className="ligacao-card-address">
                                            <i className="fas fa-map-marker-alt"></i>
                                            {ligacao.address || 'Endereço não informado'}
                                        </p>
                                        
                                        {ligacao.end_date && (
                                            <p className="ligacao-card-date">
                                                <i className="fas fa-calendar"></i>
                                                {new Date(ligacao.end_date).toLocaleDateString('pt-BR', { 
                                                    timeZone: 'UTC',
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric'
                                                })}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (ligacao.spreadsheet_url) {
                                                window.open(ligacao.spreadsheet_url, '_blank');
                                            } else {
                                                toast.error('Nenhuma planilha vinculada a esta ligação.');
                                            }
                                        }}
                                        className={`btn btn-primary ligacao-card-planilha-btn ${!ligacao.spreadsheet_url ? 'disabled' : ''}`}
                                        disabled={!ligacao.spreadsheet_url}
                                        title={ligacao.spreadsheet_url ? 'Abrir planilha' : 'Nenhuma planilha vinculada'}
                                    >
                                        <i className="fas fa-table"></i> 
                                        {ligacao.spreadsheet_url ? 'Abrir Planilha' : 'Sem Planilha'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}