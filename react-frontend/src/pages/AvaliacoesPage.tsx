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

const sourceImageMap: { [key: string]: string } = {
    'Google': '/img/google.png', 
    'ReclameAqui': '/img/ra.png',
    'Procon': '/img/procon.png',
    'ANATEL': '/img/anatel.png',
};

const SourceLogo = ({ source }: { source: string }) => {
    const imagePath = sourceImageMap[source];

    if (imagePath) {
        return (
            <img 
                src={imagePath} 
                alt={`${source} logo`} 
                title={source}
                style={{ height: '24px', maxWidth: '80px', verticalAlign: 'middle' }} 
            />
        );
    }

    return <span className="source-text">{source}</span>;
};

const StatusBadge = ({ status }: { status: Avaliacao['status'] }) => {
    const styleMap = {
        Pendente: { background: 'var(--accent-blue)', text: 'Pendente' },
        'Em Tratamento': { background: 'var(--priority-media)', text: 'Em Tratamento' },
        Resolvido: { background: 'var(--accent-green)', text: 'Resolvido' },
        Ignorado: { background: 'var(--text-muted)', text: 'Ignorado' },
    };
    return (
        <span 
            className="status-badge" 
            style={{
                backgroundColor: `${styleMap[status].background}30`, 
                color: styleMap[status].background
            }}
        >
            {styleMap[status].text}
        </span>
    );
};

const RatingStars = ({ rating }: { rating?: number }) => {
    if (!rating) return <span style={{color: 'var(--text-muted)'}}>N/A</span>;
    return (
        <div className="rating-stars">
            {Array.from({length: 5}, (_, i) => 
                <i key={i} className={`fas fa-star ${i < rating ? 'filled' : ''}`}></i>
            )}
        </div>
    );
};

const FilterBar = ({ filters, setFilters, onAddNew }: {
    filters: { status: string; source: string },
    setFilters: (filters: any) => void,
    onAddNew: () => void
}) => (
    <div className="filters-bar">
        <div className="filters-group">
            <select 
                className="form-select filter-select" 
                value={filters.status} 
                onChange={e => setFilters((f: any) => ({...f, status: e.target.value}))}
            >
                <option value="Todos">Todos os Status</option>
                <option value="Pendente">Pendente</option>
                <option value="Em Tratamento">Em Tratamento</option>
                <option value="Resolvido">Resolvido</option>
                <option value="Ignorado">Ignorado</option>
            </select>
            
            <select 
                className="form-select filter-select" 
                value={filters.source} 
                onChange={e => setFilters((f: any) => ({...f, source: e.target.value}))}
            >
                <option value="Todos">Todas as Fontes</option>
                <option value="Google">Google</option>
                <option value="ReclameAqui">ReclameAqui</option>
                <option value="Procon">Procon</option>
                <option value="ANATEL">ANATEL</option>
                <option value="Outros">Outros</option>
            </select>
        </div>
    
    </div>
);

const StatsCards = ({ avaliacoes }: { avaliacoes: Avaliacao[] }) => {
    const stats = useMemo(() => {
        const total = avaliacoes.length;
        const pendentes = avaliacoes.filter(a => a.status === 'Pendente').length;
        const resolvidas = avaliacoes.filter(a => a.status === 'Resolvido').length;
        const mediaNotas = avaliacoes.reduce((acc, a) => acc + (a.rating || 0), 0) / total || 0;
        
        return { total, pendentes, resolvidas, mediaNotas };
    }, [avaliacoes]);

    return (
        <div className="stats-cards">
            <div className="stat-card">
                <div className="stat-icon">
                    <i className="fas fa-chart-bar"></i>
                </div>
                <div className="stat-content">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total</div>
                </div>
            </div>
            
            <div className="stat-card warning">
                <div className="stat-icon">
                    <i className="fas fa-clock"></i>
                </div>
                <div className="stat-content">
                    <div className="stat-value">{stats.pendentes}</div>
                    <div className="stat-label">Pendentes</div>
                </div>
            </div>
            
            <div className="stat-card success">
                <div className="stat-icon">
                    <i className="fas fa-check-circle"></i>
                </div>
                <div className="stat-content">
                    <div className="stat-value">{stats.resolvidas}</div>
                    <div className="stat-label">Resolvidas</div>
                </div>
            </div>
            
            <div className="stat-card info">
                <div className="stat-icon">
                    <i className="fas fa-star"></i>
                </div>
                <div className="stat-content">
                    <div className="stat-value">{stats.mediaNotas.toFixed(1)}</div>
                    <div className="stat-label">Média</div>
                </div>
            </div>
        </div>
    );
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

    const handleAddNew = () => {
        openModal('avaliacao', { onSave: fetchAvaliacoes });
    };

    const filteredAvaliacoes = useMemo(() => {
        return avaliacoes.filter(a => 
            (filters.status === 'Todos' || a.status === filters.status) &&
            (filters.source === 'Todos' || a.source === filters.source)
        );
    }, [avaliacoes, filters]);

    if (isLoading) return <Loader fullScreen={false} />;

    return (
        <div className="avaliacoes-page">
            <div className="page-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1>
                            <i className="fas fa-star-half-alt"></i>
                            Avaliações Negativas
                        </h1>
                        <p>Gerencie e acompanhe avaliações que necessitam de atenção</p>
                    </div>
                    <button className="btn btn-primary btn-create" onClick={handleAddNew}>
                        <i className="fas fa-plus"></i>
                        <span>Registrar Avaliação Negativa</span>
                    </button>
                </div>
            </div>

            <StatsCards avaliacoes={avaliacoes} />
            
            <FilterBar 
                filters={filters} 
                setFilters={setFilters} 
                onAddNew={handleAddNew}
            />

            <div className="content-section">
                <div className="table-container">
                    {filteredAvaliacoes.length > 0 ? (
                        <table className="avaliacoes-table">
                            <thead>
                                <tr>
                                    <th>Fonte</th>
                                    <th>Cliente</th>
                                    <th>Avaliação</th>
                                    <th>Status</th>
                                    <th>Responsável</th>
                                    <th>Data</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAvaliacoes.map(avaliacao => (
                                    <tr 
                                        key={avaliacao.id} 
                                        onClick={() => openModal('avaliacao', { avaliacao, onSave: fetchAvaliacoes })} 
                                        className="table-row-clickable"
                                    >
                                        <td>
                                            <SourceLogo source={avaliacao.source} />
                                        </td>
                                        <td className="customer-cell">
                                            <span className="customer-name">{avaliacao.customer_name}</span>
                                        </td>
                                        <td>
                                            <RatingStars rating={avaliacao.rating} />
                                        </td>
                                        <td>
                                            <StatusBadge status={avaliacao.status} />
                                        </td>
                                        <td className="assignee-cell">
                                            {(() => {
                                                const user = users.find(u => u.id === avaliacao.assigned_to);
                                                return user ? (userDisplayNameMap[user.email] || user.username) : 
                                                    <span className="unassigned">Não atribuído</span>;
                                            })()}
                                        </td>
                                        <td className="date-cell">
                                            {formatUTCDate(avaliacao.review_date)}
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className={`btn btn-secondary btn-sm action-btn ${!avaliacao.review_url ? 'disabled' : ''}`}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        if (avaliacao.review_url) {
                                                            window.open(avaliacao.review_url, '_blank');
                                                        }
                                                    }}
                                                    disabled={!avaliacao.review_url}
                                                    title="Ver avaliação original"
                                                >
                                                    <i className="fas fa-external-link-alt"></i>
                                                </button>
                                                <button 
                                                    className="btn btn-danger btn-sm action-btn" 
                                                    onClick={(e) => handleDelete(e, avaliacao.id)}
                                                    title="Excluir avaliação"
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state">
                            <i className="fas fa-star-half-alt"></i>
                            <h3>Nenhuma avaliação encontrada</h3>
                            <p>Nenhuma avaliação corresponde aos filtros selecionados.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}