import { useMemo, useState, useCallback, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import { useBoard } from '../contexts/BoardContext';
import { Card } from '../types/kanban';
import { userDisplayNameMap } from '../api/config';
import { Loader } from '../components/ui/Loader';

const PALETTE = {
    pendente: '#3b82f6',
    solucionado: '#10b981',
    naoSolucionado: '#ef4444',
    prioridade_baixa: '#22c55e',
    prioridade_media: '#f59e0b',
    prioridade_alta: '#ef4444',
    texto: 'var(--text-secondary)',
    grid: 'var(--border-color)',
    gradient: {
        blue: ['#3b82f6', '#1d4ed8'],
        green: ['#10b981', '#059669'],
        red: ['#ef4444', '#dc2626'],
        orange: ['#f59e0b', '#d97706'],
        purple: ['#8b5cf6', '#7c3aed']
    }
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
        eficienciaMedia: number;
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
                    <strong>{entry.name}:</strong> {entry.value}
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
            <label>
                <i className="fas fa-user"></i>
                Colaborador
            </label>
            <select 
                className="form-select" 
                value={filters.colaborador} 
                onChange={(e) => updateFilter('colaborador', e.target.value)}
            >
                <option value="todos">Todos os Colaboradores</option>
                {colaboradores.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                ))}
            </select>
        </div>
        <div className="dashboard-filter-group">
            <label>
                <i className="fas fa-flag"></i>
                Prioridade
            </label>
            <select 
                className="form-select" 
                value={filters.prioridade} 
                onChange={(e) => updateFilter('prioridade', e.target.value)}
            >
                <option value="todas">Todas as Prioridades</option>
                {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                ))}
            </select>
        </div>
        <div className="dashboard-filter-group">
            <label>
                <i className="fas fa-calendar"></i>
                Período
            </label>
            <select 
                className="form-select" 
                value={filters.periodo} 
                onChange={(e) => updateFilter('periodo', e.target.value)}
            >
                <option value="7">Últimos 7 dias</option>
                <option value="14">Últimos 14 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
            </select>
        </div>
    </div>
);

const EfficiencyBadge = ({ efficiency }: { efficiency: number }) => {
    const getEfficiencyClass = (eff: number) => {
        if (eff >= 70) return 'high';
        if (eff >= 50) return 'medium';
        return 'low';
    };

    return (
        <span className={`efficiency-badge ${getEfficiencyClass(efficiency)}`}>
            {efficiency}%
        </span>
    );
};

export function DashboardPage() {
    const { columns, solucionadoId, naoSolucionadoId, isLoading, fetchBoardData } = useBoard();
    const { filters, updateFilter } = useFilters();

    useEffect(() => {
        if (columns.length === 0) {
            const PUBLIC_BOARD_ID = 8;
            fetchBoardData(PUBLIC_BOARD_ID, false);
        }
    }, [columns, fetchBoardData]); 

    const stats = useMemo((): DashboardStats | null => {
        if (isLoading || !columns.length || !solucionadoId || !naoSolucionadoId) {
            return null;
        }

        const allCards = columns.flatMap(col => col.cards);
        const filteredCards = filterCards(allCards, filters);
        const days = parseInt(filters.periodo, 10);
        
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
                if (card.created_at) {
                    const createdAt = new Date(card.created_at);
                    if ((today.getTime() - createdAt.getTime()) / (1000 * 3600 * 24) < numDays) {
                        const formattedCreationDate = createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        if (timeline[formattedCreationDate]) timeline[formattedCreationDate].Criados++;
                    }
                }
                
                if (card.completed_at && card.column_id === solucionadoId) { 
                    const completionDate = new Date(card.completed_at);
                    if ((today.getTime() - completionDate.getTime()) / (1000 * 3600 * 24) < numDays) {
                        const formattedCompletionDate = completionDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        if (timeline[formattedCompletionDate]) {
                            timeline[formattedCompletionDate].Solucionados++;
                        }
                    }
                }
            });

            let pendingCount = 0;
            const cardTotal = columns.flatMap(c => c.cards).length;
            const initialPending = cardTotal - Object.values(timeline).reduce((acc, val) => acc + val.Criados, 0);
            pendingCount = Math.max(0, initialPending);

            return Object.entries(timeline).map(([date, values]) => {
                pendingCount += values.Criados - values.Solucionados;
                return { 
                    data: date, 
                    Criados: values.Criados, 
                    Solucionados: values.Solucionados, 
                    Pendentes: Math.max(0, pendingCount) 
                };
            }).reverse();
        };

        if (!filteredCards.length) {
            return {
                statusData: [], priorityData: [], colaboradorData: [], timelineData: [], total: 0,
                metrics: { 
                    taxaSolucao: 0, produtividade: 0, pendentes: 0, 
                    tempoMedioResolucao: 0, crescimentoSemanal: 0, eficienciaMedia: 0 
                }
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
            fill: PALETTE[`prioridade_${key as keyof typeof PRIORITY_LABELS}`]
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
    const produtividadeTotal = dados.solucionados + dados.naoSolucionados;

    return {
        name: nome, ...dados, total,
        eficiencia: calculateEfficiency(dados.solucionados, dados.naoSolucionados),
        produtividade: days > 0 ? Math.round(produtividadeTotal / days) : produtividadeTotal
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
const produtividade = days > 0 ? Math.round(totalResolved / days) : totalResolved;
        const eficienciaMedia = colaboradorData.length > 0 
            ? Math.round(colaboradorData.reduce((sum, c) => sum + c.eficiencia, 0) / colaboradorData.length)
            : 0;

        return {
            statusData, priorityData, colaboradorData, timelineData, total: filteredCards.length,
            metrics: { 
                taxaSolucao, produtividade, pendentes: pending, 
                tempoMedioResolucao, crescimentoSemanal, eficienciaMedia 
            }
        };
    }, [columns, solucionadoId, naoSolucionadoId, filters, isLoading]);

    const colaboradores = useMemo(() => {
        if (!columns.length) return [];
        const uniqueEmails = [...new Set(columns.flatMap(c => c.cards).map(card => card.assigned_to).filter(Boolean))];
        return uniqueEmails.map(email => ({ 
            value: email as string, 
            label: userDisplayNameMap[email as string] || email as string 
        }));
    }, [columns]);

    if (isLoading || !solucionadoId || !naoSolucionadoId) {
        return <Loader fullScreen={false} />;
    }
    
    if (!stats) {
        return (
            <div className="content-section">
                <p>Não há dados para exibir.</p>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div className="dashboard-header-content">
                    <div className="dashboard-header-title">
                        <h1>
                            <i className="fas fa-chart-line"></i>
                            Dashboard
                        </h1>
                        <p>Análise completa de métricas e performance do Kanban</p>
                    </div>
                </div>

                <FilterSection 
                    filters={filters} 
                    updateFilter={updateFilter} 
                    colaboradores={colaboradores} 
                />
            </div>

            <div className="dashboard-metric-grid">
                <MetricCard
                    label="Total de Tarefas"
                    value={stats.total}
                    icon="fas fa-tasks"
                    color={PALETTE.pendente}
                    trend={{ 
                        value: Math.abs(stats.metrics.crescimentoSemanal), 
                        isPositive: stats.metrics.crescimentoSemanal >= 0 
                    }}
                    iconBackgroundStyle={{ 
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))'
                    }}
                />
                <MetricCard
                    label="Taxa de Solução"
                    value={`${stats.metrics.taxaSolucao}%`}
                    icon="fas fa-check-circle"
                    color={PALETTE.solucionado}
                    iconBackgroundStyle={{ 
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))'
                    }}
                />
                <MetricCard
                    label="Produtividade"
                    value={`${stats.metrics.produtividade}/dia`}
                    icon="fas fa-bolt"
                    color={PALETTE.prioridade_media}
                    iconBackgroundStyle={{ 
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
                    }}
                />
                <MetricCard
                    label="Eficiência Média"
                    value={`${stats.metrics.eficienciaMedia}%`}
                    icon="fas fa-star"
                    color={PALETTE.prioridade_alta}
                    iconBackgroundStyle={{ 
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))'
                    }}
                />
            </div>

            <div className="dashboard-chart-grid">
                <div className="dashboard-widget">
                    <h3>Status das Tarefas</h3>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={stats.statusData} 
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fontSize: 12, fill: PALETTE.texto }} 
                                />
                                <YAxis 
                                    allowDecimals={false} 
                                    tick={{ fontSize: 12, fill: PALETTE.texto }} 
                                />
                                <Tooltip 
                                    content={<CustomTooltip />} 
                                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} 
                                />
                                <Bar 
                                    dataKey="value" 
                                    name="Tarefas" 
                                    radius={[8, 8, 0, 0]}
                                >
                                    {stats.statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
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
                                    data={stats.priorityData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    label={({ name, percent }) => 
                                        `${name} ${(percent * 100).toFixed(0)}%`
                                    }
                                >
                                    {stats.priorityData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.fill} 
                                            stroke={PALETTE.grid} 
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend 
                                    wrapperStyle={{ 
                                        fontSize: "14px", 
                                        color: PALETTE.texto 
                                    }} 
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="dashboard-widget dashboard-timeline-widget">
                <h3>Tendência Temporal</h3>
                <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart 
                            data={stats.timelineData} 
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                            <XAxis 
                                dataKey="data" 
                                tick={{ fontSize: 12, fill: PALETTE.texto }} 
                            />
                            <YAxis 
                                allowDecimals={false} 
                                tick={{ fontSize: 12, fill: PALETTE.texto }} 
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                                wrapperStyle={{ 
                                    fontSize: "14px", 
                                    color: PALETTE.texto 
                                }} 
                            />
                            <Line 
                                type="monotone" 
                                dataKey="Criados" 
                                stroke={PALETTE.pendente} 
                                strokeWidth={3} 
                                dot={{ r: 5 }}
                                activeDot={{ r: 7 }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="Solucionados" 
                                stroke={PALETTE.solucionado} 
                                strokeWidth={3} 
                                dot={{ r: 5 }}
                                activeDot={{ r: 7 }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="Pendentes" 
                                stroke={PALETTE.naoSolucionado} 
                                strokeWidth={3} 
                                dot={{ r: 5 }}
                                activeDot={{ r: 7 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <br></br>
            <br></br>

            <div className="dashboard-widget dashboard-performance-widget">
                <h3>Performance por Colaborador</h3>
                <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                            data={stats.colaboradorData} 
                            layout="vertical" 
                            margin={{ top: 20, right: 30, left: 120, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.grid} />
                            <XAxis 
                                type="number" 
                                tick={{ fontSize: 12, fill: PALETTE.texto }} 
                                allowDecimals={false} 
                            />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                tick={{ fontSize: 12, fill: PALETTE.texto }} 
                                width={110}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                                wrapperStyle={{ 
                                    fontSize: "14px", 
                                    color: PALETTE.texto 
                                }} 
                            />
                            <Bar 
                                dataKey="solucionados" 
                                stackId="a" 
                                fill={PALETTE.solucionado} 
                                name="Solucionados" 
                            />
                            <Bar 
                                dataKey="pendentes" 
                                stackId="a" 
                                fill={PALETTE.pendente} 
                                name="Pendentes" 
                            />
                            <Bar 
                                dataKey="naoSolucionados" 
                                stackId="a" 
                                fill={PALETTE.naoSolucionado} 
                                name="Não Solucionados" 
                                radius={[0, 4, 4, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <br></br>
            <br></br>

            <div className="dashboard-widget dashboard-detail-widget">
                <h3>Detalhamento por Colaborador</h3>
                <div className="table-container">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left' }}>Colaborador</th>
                                <th>Total</th>
                                <th>Solucionados</th>
                                <th>Pendentes</th>
                                <th>Não Solucionados</th>
                                <th>Eficiência</th>
                                <th>Produtividade/dia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.colaboradorData.map((colab, index) => (
                                <tr key={index}>
                                    <td className="text-left">{colab.name}</td>
                                    <td><strong>{colab.total}</strong></td>
                                    <td style={{ color: PALETTE.solucionado, fontWeight: '600' }}>
                                        {colab.solucionados}
                                    </td>
                                    <td style={{ color: PALETTE.pendente, fontWeight: '600' }}>
                                        {colab.pendentes}
                                    </td>
                                    <td style={{ color: PALETTE.naoSolucionado, fontWeight: '600' }}>
                                        {colab.naoSolucionados}
                                    </td>
                                    <td>
                                        <EfficiencyBadge efficiency={colab.eficiencia} />
                                    </td>
                                    <td><strong>{colab.produtividade}</strong></td>
                                </tr>
                            ))}
                            {stats.colaboradorData.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', color: PALETTE.texto }}>
                                        Nenhum colaborador encontrado
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}