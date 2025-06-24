import { useMemo, useState, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { useBoard } from '../contexts/BoardContext';
import { Card } from '../types/kanban';
import { userDisplayNameMap } from '../api/config';
import { Loader } from '../components/ui/Loader';

const PALETTE = {
    pendente: 'var(--accent-blue)',
    solucionado: 'var(--accent-green)',
    naoSolucionado: 'var(--accent-red)',
    prioridade_baixa: 'var(--priority-baixa)',
    prioridade_media: 'var(--priority-media)',
    prioridade_alta: 'var(--priority-alta)',
    texto: 'var(--text-secondary)',
    grid: 'var(--border-color)',
} as const;

const PRIORITY_LABELS = {
    baixa: 'Baixa',
    media: 'Média',
    alta: 'Alta'
} as const;

const STATUS_LABELS = {
    pendente: 'Pendentes',
    solucionado: 'Solucionados',
    naoSolucionado: 'Não Solucionados'
} as const;

interface FilterState {
    colaborador: string;
    prioridade: string;
    periodo: string;
}

interface CollaboratorStats {
    name: string;
    pendentes: number;
    solucionados: number;
    naoSolucionados: number;
    total: number;
    eficiencia: number;
    produtividade: number;
}

interface DashboardStats {
    statusData: Array<{ name: string; value: number; fill: string }>;
    priorityData: Array<{ name: string; value: number; fill: string }>;
    colaboradorData: CollaboratorStats[];
    timelineData: Array<{ data: string; Solucionados: number; Criados: number; Pendentes: number }>;
    total: number;
    metrics: {
        taxaSolucao: number;
        produtividade: number;
        pendentes: number;
        tempoMedioResolucao: number;
        crescimentoSemanal: number;
    };
}

const useFilters = () => {
    const [filters, setFilters] = useState<FilterState>({
        colaborador: 'todos',
        prioridade: 'todas',
        periodo: '7'
    });

    const updateFilter = useCallback((key: keyof FilterState, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    return { filters, updateFilter };
};

const calculateEfficiency = (solved: number, failed: number): number => {
    const total = solved + failed;
    return total > 0 ? Math.round((solved / total) * 100) : 0;
};

const filterCards = (cards: Card[], filters: FilterState): Card[] => {
    return cards.filter(card => {
        if (filters.colaborador !== 'todos' && card.assigned_to !== filters.colaborador) {
            return false;
        }
        if (filters.prioridade !== 'todas' && card.priority !== filters.prioridade) {
            return false;
        }
        return true;
    });
};

const MetricCard = ({
    label, value, icon, color, trend, iconBackgroundStyle
}: {
    label: string;
    value: string | number;
    icon: string;
    color: string;
    trend?: { value: number; isPositive: boolean };
    iconBackgroundStyle?: React.CSSProperties; 
}) => (
    <div className="dashboard-widget">
        <div className="metric-card-content">
            <div className="metric-card-text">
                <p className="label">{label}</p>
                <p className="value">{value}</p>
                {trend && (
                    <p className={`trend ${trend.isPositive ? 'positive' : 'negative'}`}>
                        <i className={`fas fa-arrow-${trend.isPositive ? 'up' : 'down'}`}></i>
                        {Math.abs(trend.value)}%
                    </p>
                )}
            </div>
            {/* O "style" deste div agora usa a nova prop */}
            <div className="metric-card-icon" style={iconBackgroundStyle}>
                <i className={icon} style={{ color }}></i>
            </div>
        </div>
    </div>
);


const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="chart-tooltip">
            <p className="label">{label}</p>
            {payload.map((entry: any, index: number) => (
                <p key={`item-${index}`} style={{ color: entry.stroke || entry.payload.fill || entry.color }}>
                    {entry.name}: {entry.value}
                </p>
            ))}
        </div>
    );
};

const FilterSection = ({
    filters, updateFilter, colaboradores
}: {
    filters: FilterState;
    updateFilter: (key: keyof FilterState, value: string) => void;
    colaboradores: Array<{ value: string; label: string }>;
}) => (
    <div className="dashboard-filters">
        <div className="dashboard-filter-group">
            <label>Colaborador</label>
            <select className="form-select" value={filters.colaborador} onChange={(e) => updateFilter('colaborador', e.target.value)}>
                <option value="todos">Todos</option>
                {colaboradores.map(c => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
        </div>
        <div className="dashboard-filter-group">
            <label>Prioridade</label>
            <select className="form-select" value={filters.prioridade} onChange={(e) => updateFilter('prioridade', e.target.value)}>
                <option value="todas">Todas</option>
                {Object.entries(PRIORITY_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
            </select>
        </div>
        <div className="dashboard-filter-group">
            <label>Período</label>
            <select className="form-select" value={filters.periodo} onChange={(e) => updateFilter('periodo', e.target.value)}>
                <option value="7">Últimos 7 dias</option>
                <option value="14">Últimos 14 dias</option>
                <option value="30">Últimos 30 dias</option>
            </select>
        </div>
    </div>
);

export function DashboardPage() {
    const { columns, solucionadoId, naoSolucionadoId, isLoading } = useBoard();
    const { filters, updateFilter } = useFilters();

    const stats = useMemo((): DashboardStats | null => {
        if (!columns.length) return null;

        const allCards = columns.flatMap(col => col.cards);
        const filteredCards = filterCards(allCards, filters);
        const days = parseInt(filters.periodo, 10);
        const now = new Date();

        const generateRealTimelineData = (cards: Card[], numDays: number) => {
            const timeline: Record<string, { Criados: number; Solucionados: number }> = {};
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            for (let i = 0; i < numDays; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                timeline[formattedDate] = { Criados: 0, Solucionados: 0 };
            }

            cards.forEach(card => {
                if (!card.created_at) return;
                const createdAt = new Date(card.created_at);
                if ((today.getTime() - createdAt.getTime()) / (1000 * 3600 * 24) < numDays) {
                    const formattedCreationDate = createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    if (timeline[formattedCreationDate]) timeline[formattedCreationDate].Criados++;
                }

                const isResolved = card.column_id === solucionadoId || card.column_id === naoSolucionadoId;
                if (isResolved && card.updated_at) {
                    const updatedAt = new Date(card.updated_at);
                    if ((today.getTime() - updatedAt.getTime()) / (1000 * 3600 * 24) < numDays) {
                        const formattedUpdateDate = updatedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        if (timeline[formattedUpdateDate]) timeline[formattedUpdateDate].Solucionados++;
                    }
                }
            });

            let pendingCount = 0;
            return Object.entries(timeline).map(([date, values]) => {
                pendingCount += values.Criados - values.Solucionados;
                return { data: date, Criados: values.Criados, Solucionados: values.Solucionados, Pendentes: Math.max(0, pendingCount) };
            }).reverse();
        };

        if (!filteredCards.length) {
            return {
                statusData: [], priorityData: [], colaboradorData: [], timelineData: [], total: 0,
                metrics: { taxaSolucao: 0, produtividade: 0, pendentes: 0, tempoMedioResolucao: 0, crescimentoSemanal: 0 }
            };
        }

        const completed = filteredCards.filter(c => c.column_id === solucionadoId).length;
        const failed = filteredCards.filter(c => c.column_id === naoSolucionadoId).length;
        const pending = filteredCards.length - completed - failed;

        const statusData = [
            { name: STATUS_LABELS.pendente, value: pending, fill: PALETTE.pendente },
            { name: STATUS_LABELS.solucionado, value: completed, fill: PALETTE.solucionado },
            { name: STATUS_LABELS.naoSolucionado, value: failed, fill: PALETTE.naoSolucionado },
        ];

        const priorityCounts = filteredCards.reduce((acc, card) => {
            const priority = card.priority || 'media';
            acc[priority] = (acc[priority] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const priorityData = Object.entries(PRIORITY_LABELS).map(([key, label]) => ({
            name: label,
            value: priorityCounts[key] || 0,
            fill: PALETTE[`prioridade_${key}` as keyof typeof PALETTE]
        }));

        const colaboradorCounts = filteredCards.reduce((acc, card) => {
            const colaborador = card.assigned_to || 'Não Atribuído';
            const displayName = userDisplayNameMap[colaborador] || colaborador;
            if (!acc[displayName]) {
                acc[displayName] = { pendentes: 0, solucionados: 0, naoSolucionados: 0 };
            }
            if (card.column_id === solucionadoId) acc[displayName].solucionados++;
            else if (card.column_id === naoSolucionadoId) acc[displayName].naoSolucionados++;
            else acc[displayName].pendentes++;
            return acc;
        }, {} as Record<string, { pendentes: number; solucionados: number; naoSolucionados: number }>);

        const colaboradorData: CollaboratorStats[] = Object.entries(colaboradorCounts).map(([nome, dados]) => {
            const total = dados.pendentes + dados.solucionados + dados.naoSolucionados;
            return {
                name: nome, ...dados, total,
                eficiencia: calculateEfficiency(dados.solucionados, dados.naoSolucionados),
                produtividade: Math.round((dados.solucionados + dados.naoSolucionados) / days)
            };
        }).sort((a, b) => b.total - a.total);

        const resolvedCards = filteredCards.filter(
            c => (c.column_id === solucionadoId || c.column_id === naoSolucionadoId) && c.created_at && c.updated_at
        );

        let tempoMedioResolucao = 0;
        if (resolvedCards.length > 0) {
            const totalDurationMillis = resolvedCards.reduce((acc, card) => {
                const creationTime = new Date(card.created_at).getTime();
                const resolutionTime = new Date(card.updated_at).getTime();
                return acc + (resolutionTime - creationTime);
            }, 0);
            const avgMillis = totalDurationMillis / resolvedCards.length;
            tempoMedioResolucao = Math.round(avgMillis / (1000 * 60 * 60)); 
        }

        const timelineData = generateRealTimelineData(allCards, days);

        const lastPeriodCards = timelineData.slice(-days).reduce((sum, day) => sum + day.Criados, 0);
        const previousPeriodCards = generateRealTimelineData(allCards, days * 2).slice(0, days).reduce((sum, day) => sum + day.Criados, 0);
        const crescimentoSemanal = previousPeriodCards > 0
            ? Math.round(((lastPeriodCards - previousPeriodCards) / previousPeriodCards) * 100)
            : (lastPeriodCards > 0 ? 100 : 0);

        const totalResolved = completed + failed;
        const taxaSolucao = totalResolved > 0 ? Math.round((completed / totalResolved) * 100) : 0;
        const produtividade = Math.round(totalResolved / days);

        return {
            statusData, priorityData, colaboradorData, timelineData, total: filteredCards.length,
            metrics: { taxaSolucao, produtividade, pendentes: pending, tempoMedioResolucao, crescimentoSemanal }
        };
    }, [columns, solucionadoId, naoSolucionadoId, filters]);

    const colaboradores = useMemo(() => {
        const uniqueEmails = [...new Set(columns.flatMap(c => c.cards).map(card => card.assigned_to).filter(Boolean))];
        return uniqueEmails.map(email => ({ value: email as string, label: userDisplayNameMap[email as string] || email as string }));
    }, [columns]);

    if (isLoading) return <Loader fullScreen={false} />;
    if (!stats) return (<div className="content-section"><p>Não há dados para exibir.</p></div>);

    return (
        <div className="content-section" style={{ display: 'block' }}>
            <div className="content-header">
                <h2><i className="fas fa-chart-line"></i> Dashboard Analytics</h2>
                <p>Métricas e insights do Suporte</p>
            </div>

            <div className="content-body" style={{ padding: '1rem 0' }}>
                <FilterSection filters={filters} updateFilter={updateFilter} colaboradores={colaboradores} />

                {/* --- ALTERAÇÃO #2: Uso do MetricCard --- */}
                {/* Adicionamos a prop "iconBackgroundStyle" em cada card */}
                <div className="dashboard-metric-grid">
                    <MetricCard
                        label="Total de Tarefas"
                        value={stats.total}
                        icon="fas fa-tasks"
                        color={PALETTE.pendente}
                        trend={{ value: Math.abs(stats.metrics.crescimentoSemanal), isPositive: stats.metrics.crescimentoSemanal >= 0 }}
                        iconBackgroundStyle={{ backgroundColor: '#dbeafe' }}
                    />
                    <MetricCard
                        label="Taxa de Solução"
                        value={`${stats.metrics.taxaSolucao}%`}
                        icon="fas fa-check-circle"
                        color={PALETTE.solucionado}
                        iconBackgroundStyle={{ backgroundColor: '#d1fae5' }}
                    />
                    <MetricCard
                        label="Produtividade"
                        value={`${stats.metrics.produtividade}/dia`}
                        icon="fas fa-bolt"
                        color={PALETTE.prioridade_media}
                        iconBackgroundStyle={{ backgroundColor: '#fef3c7' }}
                    />
                    <MetricCard
                        label="Tempo Médio"
                        value={`${stats.metrics.tempoMedioResolucao}h`}
                        icon="fas fa-clock"
                        color={PALETTE.naoSolucionado}
                        iconBackgroundStyle={{ backgroundColor: '#fee2e2' }}
                    />
                </div>

                <div className="dashboard-chart-grid">
                    <div className="dashboard-widget">
                        <h3>Status das Tarefas</h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.statusData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: PALETTE.texto }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: PALETTE.texto }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(88, 166, 255, 0.1)' }} />
                                    <Bar dataKey="value" name="Tarefas" radius={[4, 4, 0, 0]}>
                                        {stats.statusData.map(entry => (<Cell key={entry.name} fill={entry.fill} />))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="dashboard-widget">
                        <h3>Distribuição por Prioridade</h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                        innerRadius={60} outerRadius={100} paddingAngle={5}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {stats.priorityData.map((entry) => (<Cell key={entry.name} fill={entry.fill} stroke={PALETTE.grid} />))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: "14px", color: PALETTE.texto }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="dashboard-widget" style={{ marginTop: '1.5rem' }}>
                    <h3>Tendência Temporal</h3>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.timelineData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                                <XAxis dataKey="data" tick={{ fontSize: 12, fill: PALETTE.texto }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: PALETTE.texto }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: "14px", color: PALETTE.texto }} />
                                <Line type="monotone" dataKey="Criados" stroke={PALETTE.pendente} strokeWidth={3} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="Solucionados" stroke={PALETTE.solucionado} strokeWidth={3} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="Pendentes" stroke={PALETTE.naoSolucionado} strokeWidth={3} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="dashboard-widget" style={{ marginTop: '1.5rem' }}>
                    <h3>Performance por Colaborador</h3>
                    <div style={{ height: `${Math.max(200, stats.colaboradorData.length * 60)}px` }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.colaboradorData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                                <XAxis type="number" tick={{ fontSize: 12, fill: PALETTE.texto }} allowDecimals={false} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: PALETTE.texto }} width={120} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: "14px", color: PALETTE.texto }} />
                                <Bar dataKey="solucionados" stackId="a" fill={PALETTE.solucionado} name="Solucionados" />
                                <Bar dataKey="pendentes" stackId="a" fill={PALETTE.pendente} name="Pendentes" />
                                <Bar dataKey="naoSolucionados" stackId="a" fill={PALETTE.naoSolucionado} name="Não Solucionados" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="dashboard-widget" style={{ marginTop: '1.5rem' }}>
                    <h3>Detalhamento por Colaborador</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="dashboard-table">
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left' }}>Colaborador</th>
                                    <th>Total</th>
                                    <th>Solucionados</th>
                                    <th>Pendentes</th>
                                    <th>Não Solucionados</th>
                                    <th>Eficiência</th>
                                    <th>Produtividade (dia)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.colaboradorData.map((colab, index) => (
                                    <tr key={index}>
                                        <td className="text-left">{colab.name}</td>
                                        <td>{colab.total}</td>
                                        <td style={{ color: PALETTE.solucionado }}>{colab.solucionados}</td>
                                        <td style={{ color: PALETTE.pendente }}>{colab.pendentes}</td>
                                        <td style={{ color: PALETTE.naoSolucionado }}>{colab.naoSolucionados}</td>
                                        <td>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '99px',
                                                backgroundColor: colab.eficiencia >= 70 ? 'rgba(63, 185, 80, 0.15)' : colab.eficiencia >= 50 ? 'rgba(210, 153, 34, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                                                color: colab.eficiencia >= 70 ? 'var(--accent-green)' : colab.eficiencia >= 50 ? 'var(--priority-media)' : 'var(--accent-red)',
                                                fontSize: '0.875rem', fontWeight: '500'
                                            }}>
                                                {colab.eficiencia}%
                                            </span>
                                        </td>
                                        <td>{colab.produtividade}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}