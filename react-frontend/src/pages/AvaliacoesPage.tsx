import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useModal } from '../contexts/ModalContext';
import * as avaliacaoService from '../services/avaliacoes';
import { Avaliacao, User } from '../types/kanban';
import { useBoard } from '../contexts/BoardContext';
import { Loader } from '../components/ui/Loader';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { userDisplayNameMap } from '../api/config';


const formatUTCDate = (isoDateString: string | null | undefined): string => {
    if (!isoDateString) {
        return 'N/A';
    }
    const date = new Date(isoDateString);

    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    const pad = (num: number) => String(num).padStart(2, '0');

    return `${pad(day)}/${pad(month)}/${year}`;
}


const StatusBadge = ({ status }: { status: Avaliacao['status'] }) => {
    const styleMap = {
        Pendente: { background: 'var(--accent-blue)', text: 'Pendente' },
        'Em Tratamento': { background: 'var(--priority-media)', text: 'Em Tratamento' },
        Resolvido: { background: 'var(--accent-green)', text: 'Resolvido' },
        Ignorado: { background: 'var(--text-muted)', text: 'Ignorado' },
    };
    return <span className="status-badge" style={{backgroundColor: `${styleMap[status].background}30`, color: styleMap[status].background}}>{styleMap[status].text}</span>;
};

const RatingStars = ({ rating }: { rating?: number }) => {
    if (!rating) return <span style={{color: 'var(--text-muted)'}}>N/A</span>;
    return <div className="rating-stars">{Array.from({length: 5}, (_, i) => <i key={i} className={`fas fa-star ${i < rating ? 'filled' : ''}`}></i>)}</div>;
};

export function AvaliacoesPage() {
    const { openModal } = useModal();
    const { users } = useBoard();
    const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState({ status: 'Todos', source: 'Todos' });

    const fetchAvaliacoes = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await avaliacaoService.getAvaliacoes();
            setAvaliacoes(data);
        } catch (error) {
            toast.error("Falha ao carregar avaliações.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAvaliacoes();
    }, [fetchAvaliacoes]);

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation(); 
        toast.promise(
            avaliacaoService.deleteAvaliacao(id).then(() => {
                setAvaliacoes(prev => prev.filter(a => a.id !== id));
            }),
            {
                loading: 'Excluindo...',
                success: 'Avaliação excluída!',
                error: 'Falha ao excluir.',
            }
        );
    };

    const filteredAvaliacoes = useMemo(() => {
        return avaliacoes.filter(a => 
            (filters.status === 'Todos' || a.status === filters.status) &&
            (filters.source === 'Todos' || a.source === filters.source)
        );
    }, [avaliacoes, filters]);

    if (isLoading) return <Loader fullScreen={false} />;

    return (
        <div className="content-section" style={{display: 'block'}}>
            <div className="content-header">
                <h2><i className="fas fa-star-half-alt"></i> Avaliações Negativas</h2>
                <p>Avaliações que necessitam de observação ou retorno.</p>
            </div>
            <div className="content-body">
                <div className="dashboard-filters">
                    <select className="form-select" value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))}>
                        <option value="Todos">Todos os Status</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Em Tratamento">Em Tratamento</option>
                        <option value="Resolvido">Resolvido</option>
                    </select>
                    <select className="form-select" value={filters.source} onChange={e => setFilters(f => ({...f, source: e.target.value}))}>
                        <option value="Todos">Todas as Fontes</option>
                        <option>Google</option><option>ReclameAqui</option><option>Procon</option>
                        <option>Anatel</option><option>Outros</option>
                    </select>
                    <button className="btn btn-primary" onClick={() => openModal('avaliacao', { onSave: fetchAvaliacoes })}>
                        <i className="fas fa-plus"></i> Registrar Avaliação
                    </button>
                </div>
                <div className="table-container" style={{marginTop: '2rem'}}>
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th>Fonte</th><th>Cliente</th><th>Nota</th><th>Status</th><th>Responsável</th><th>Data</th><th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAvaliacoes.map(avaliacao => (
                                <tr key={avaliacao.id} onClick={() => openModal('avaliacao', { avaliacao, onSave: fetchAvaliacoes })} style={{cursor: 'pointer'}}>
                                    <td>{avaliacao.source}</td>
                                    <td>{avaliacao.customer_name}</td>
                                    <td><RatingStars rating={avaliacao.rating} /></td>
                                    <td><StatusBadge status={avaliacao.status} /></td>
                                    <td>
                                        {(() => {
                                            const user = users.find(u => u.id === avaliacao.assigned_to);
                                            return user ? (userDisplayNameMap[user.email] || user.username) : 'N/A';
                                        })()}
                                    </td>
                                    
                                    <td>{formatUTCDate(avaliacao.review_date)}</td>
                                    
                                    <td>
                                        <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'center'}}>
                                            <a href={avaliacao.review_url || '#'} target="_blank" rel="noopener noreferrer" className={`btn btn-secondary btn-sm ${!avaliacao.review_url ? 'disabled' : ''}`} onClick={e => e.stopPropagation()}>
                                                <i className="fas fa-external-link-alt"></i>
                                            </a>
                                            <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(e, avaliacao.id)}>
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!isLoading && filteredAvaliacoes.length === 0 && <p style={{textAlign: 'center', padding: '2rem'}}>Nenhuma avaliação encontrada.</p>}
            </div>
        </div>
    );
}