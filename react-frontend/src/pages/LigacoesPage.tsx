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

    const fetchLigacoes = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await ligacaoService.getLigacoes();
            setLigacoes(data);
        } catch (error) {
            toast.error("Falha ao carregar ligações.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLigacoes();
    }, [fetchLigacoes]);

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        toast((t) => (
            <span>
                Tem certeza que quer excluir esta ligação?
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <button className="btn btn-danger" style={{flex: 1}} onClick={async () => {
                      toast.dismiss(t.id);
                      await ligacaoService.deleteLigacao(id);
                      fetchLigacoes();
                      toast.success("Ligação excluída.");
                  }}>Sim</button>
                  <button className="btn btn-secondary" style={{flex: 1}} onClick={() => toast.dismiss(t.id)}>Não</button>
                </div>
            </span>
        ));
    };
    
    const filteredLigacoes = useMemo(() => {
      if (!ligacoes) return [];
      return ligacoes.filter(l => {
          const nameMatch = l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? true;
          const addressMatch = l.address?.toLowerCase().includes(searchTerm.toLowerCase()) ?? true;
          const matchesSearch = nameMatch || addressMatch;
          const matchesFilter = filterTipo === 'Todos' || l.type === filterTipo;
          return matchesSearch && matchesFilter;
      })
    }, [ligacoes, searchTerm, filterTipo]);

    if (isLoading) return <Loader fullScreen={false} />;

    return (
        <div className="content-section" style={{display: 'block'}}>
            <div className="content-header">
                <h2><i className="fas fa-phone-volume"></i> Ligações Ativas</h2>
                <p>Ligações ativas para condomínios e bairros.</p>
            </div>
            <div className="content-body">
                <div className="dashboard-filters">
                    <input type="text" placeholder="Buscar por nome ou endereço..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-input" style={{flex: 2}}/>
                    <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="form-select" style={{flex: 1}}>
                        <option value="Todos">Todos os Tipos</option>
                        <option value="Condomínio">Condomínio</option>
                        <option value="Bairro">Bairro</option>
                        <option value="Outros">Outros</option>
                    </select>
                    <button className="btn btn-primary" onClick={() => openModal('ligacao', { onSave: fetchLigacoes })}>
                        <i className="fas fa-plus"></i> Nova Ligação Ativa
                    </button>
                </div>
                
                <div className="ligacao-card-grid" style={{marginTop: '2rem'}}>
                    {filteredLigacoes.map((ligacao) => (
                        <div key={ligacao.id} className="ligacao-card" onClick={() => openModal('ligacao', { ligacao, onSave: fetchLigacoes })}>
                            
                            <div 
                                className="ligacao-card-image" 
                                style={{backgroundImage: ligacao.image_url ? `url(${ligacao.image_url})` : 'none'}}
                            >
                            </div>

                            <div className="ligacao-card-content">
                                <div className="ligacao-card-header">
                                    <h3>{ligacao.name}</h3>
                                    <button className="delete-ligacao-btn" onClick={(e) => handleDelete(e, ligacao.id)} title="Excluir Ligação">
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                                <span className="ligacao-card-type">{ligacao.type}</span>
                                <p className="ligacao-card-address">
                                    <i className="fas fa-map-marker-alt"></i>
                                    {ligacao.address || 'Endereço não informado'}
                                </p>
                                
                                {ligacao.end_date && (
                                    <p className="ligacao-card-date">
                                        <i className="fas fa-calendar"></i>
                                        {new Date(ligacao.end_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                    </p>
                                )}

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (ligacao.spreadsheet_url) {
                                            window.open(ligacao.spreadsheet_url, '_blank');
                                        } else {
                                            toast.error('Nenhuma planilha linkada.');
                                        }
                                    }}
                                    className={`btn btn-primary ligacao-card-planilha-btn ${!ligacao.spreadsheet_url ? 'disabled' : ''}`}
                                >
                                    <i className="fas fa-sheet-plastic"></i> Planilha
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                {filteredLigacoes.length === 0 && <p style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>Nenhuma ligação encontrada para os filtros selecionados.</p>}
            </div>
        </div>
    );
}