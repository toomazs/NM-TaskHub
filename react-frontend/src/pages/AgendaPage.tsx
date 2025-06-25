import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameMonth, 
    isToday, 
    addMonths, 
    subMonths 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

import * as agendaService from '../services/agenda'; 
import { AgendaEvent } from '../types/kanban'; 
import { useModal } from '../contexts/ModalContext'; 
import { Loader } from '../components/ui/Loader'; 
type GridCellData = { 
    day: Date; 
    events: AgendaEvent[] 
} | null;

export function AgendaPage() {
    const { openModal } = useModal();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<AgendaEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

    const fetchEvents = useCallback(async (date: Date) => {
        setIsLoading(true);
        try {
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const data = await agendaService.getAgendaEvents(month, year);
            setEvents(data || []);
        } catch (error) {
            console.error('Erro ao carregar eventos:', error);
            toast.error("Falha ao carregar eventos da agenda.");
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEvents(currentDate);
    }, [currentDate, fetchEvents]);

    const calendarGrid = useMemo((): GridCellData[] => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); 
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

        const daysInGrid = eachDayOfInterval({ start: gridStart, end: gridEnd });
        
        return daysInGrid.map(day => {
            if (!isSameMonth(day, currentDate)) {
                return null;
            }
            
            const dayString = format(day, 'yyyy-MM-dd');
            const dayEvents = events.filter(event => {
                if (!event.event_date) return false;
                return event.event_date.startsWith(dayString);
            });
            
            return { day, events: dayEvents };
        });
    }, [currentDate, events]);

    const weekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    const handleAddEvent = useCallback((day: Date) => {
        const formattedDate = format(day, 'yyyy-MM-dd');
        openModal('agendaEvent', { 
            date: formattedDate, 
            onSave: () => fetchEvents(currentDate) 
        });
    }, [openModal, currentDate, fetchEvents]);
    
    const handleEditEvent = useCallback((event: AgendaEvent) => {
        openModal('agendaEvent', { 
            event, 
            onSave: () => fetchEvents(currentDate) 
        });
    }, [openModal, currentDate, fetchEvents]);
    
    const handleDeleteEvent = useCallback(async (e: React.MouseEvent, eventId: number) => {
        e.stopPropagation();
        
        toast((t) => (
            <div>
              <p className="toast-message">Tem certeza que deseja excluir este evento?</p>
              <div className="toast-buttons">
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    toast.dismiss(t.id);
                    performDelete(eventId);
                  }}
                >
                  Excluir
                </button>
                <button className="btn btn-secondary" onClick={() => toast.dismiss(t.id)}>
                  Cancelar
                </button>
              </div>
            </div>
          ), {
            id: `confirm-delete-${eventId}`,
          });
    }, []);

    const performDelete = async (eventId: number) => {
        try {
            await toast.promise(
                agendaService.deleteAgendaEvent(eventId),
                {
                    loading: 'Excluindo evento...',
                    success: 'Evento excluído com sucesso!',
                    error: 'Falha ao excluir evento.',
                }
            );
            setEvents(prev => prev.filter(e => e.id !== eventId));
        } catch (error) {
            console.error('Erro ao excluir evento:', error);
        }
    };

    const goToToday = useCallback(() => {
        const today = new Date();
        if (!isSameMonth(today, currentDate)) {
            fetchEvents(today);
        }
        setCurrentDate(today);
    }, [currentDate, fetchEvents]);

    const navigateToPreviousMonth = useCallback(() => {
        setCurrentDate(prev => subMonths(prev, 1));
    }, []);

    const navigateToNextMonth = useCallback(() => {
        setCurrentDate(prev => addMonths(prev, 1));
    }, []);

    if (isLoading) {
        return (
            <div className="content-section agenda-page" style={{ display: 'block' }}>
                <div className="calendar-loading">
                    <div className="spinner">
                        <div className="dot1"></div>
                        <div className="dot2"></div>
                        <div className="dot3"></div>
                    </div>
                    <p>Carregando eventos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="content-section agenda-page" style={{ display: 'block' }}>
            <div className="content-header">
                <h2><i className="fas fa-calendar"></i> Agenda Diária</h2>
                <p>Escala diária do Suporte.</p>
            </div>
            <div className="content-body" style={{ padding: 0 }}>
                <div className="calendar-header">
                    <button 
                        onClick={navigateToPreviousMonth} 
                        className="btn btn-secondary calendar-nav-btn"
                        title="Mês anterior"
                    >
                        <i className="fas fa-chevron-left"></i>
                    </button>
                    
                    <div className="calendar-title">
                        <h3>
                            {format(currentDate, "MMMM", { locale: ptBR })}
                        </h3>
                        <span className="calendar-subtitle">
                            {format(currentDate, "yyyy", { locale: ptBR })}
                        </span>
                    </div>
                    
                    <button 
                        onClick={navigateToNextMonth} 
                        className="btn btn-secondary calendar-nav-btn"
                        title="Próximo mês"
                    >
                        <i className="fas fa-chevron-right"></i>
                    </button>
                </div>

                <div className="calendar-grid">
                    {weekDays.map(day => (
                        <div key={day} className="weekday-header">
                            {day}
                        </div>
                    ))}
                    
                    {calendarGrid.map((dayData, index) => (
                        <div 
                            key={index} 
                            className={`day-cell ${!dayData ? 'disabled' : ''} ${dayData && isToday(dayData.day) ? 'today' : ''}`}
                        >
                            {dayData && (
                                <>
                                    <div className="day-header">
                                        <div className="day-number">                                            {format(dayData.day, 'd')}
                                        </div>
                                        <button 
                                            className="add-event-btn" 
                                            onClick={() => handleAddEvent(dayData.day)}
                                            title="Adicionar evento"
                                        >
                                            <i className="fas fa-plus"></i>
                                        </button>
                                    </div>

                                    <div className="events-container">
                                        {dayData.events.length > 0 ? (
                                            dayData.events.map(event => (
                                                <div 
                                                    key={event.id} 
                                                    className="event-item" 
                                                    style={{ backgroundColor: event.color ? `${event.color}BF` : 'var(--accent-blue)', borderColor: event.color || 'var(--accent-blue)' }} 
                                                    onClick={() => handleEditEvent(event)}
                                                    title={`${event.title}${event.description ? ' - ' + event.description : ''}`}
                                                >
                                                    <div className="event-content">
                                                        <i className="fas fa-circle event-dot" style={{ color: event.color || 'var(--text-primary)'}}></i>
                                                        <span className="event-title">{event.title}</span>
                                                    </div>
                                                    <button 
                                                        className="delete-event-btn" 
                                                        onClick={(e) => handleDeleteEvent(e, event.id)}
                                                        title="Excluir evento"
                                                    >
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="no-events">
                                                <i className="far fa-calendar-plus empty-icon"></i>
                                                <span>Adicionar</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {events.length === 0 && !isLoading && (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <i className="fas fa-calendar-times"></i>
                        </div>
                        <h3>Nenhum evento para este mês</h3>
                        <p>Parece que sua agenda está livre. Adicione um novo evento clicando no botão "+" em um dos dias.</p>
                        <button 
                            className="btn btn-primary"
                            onClick={() => handleAddEvent(startOfMonth(currentDate))}
                        >
                            <i className="fas fa-plus"></i>
                            Criar Primeiro Evento
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}