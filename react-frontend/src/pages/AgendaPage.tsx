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

type CalendarGridCell = { 
    day: Date; 
    events: AgendaEvent[] 
} | null;

const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
};

export function AgendaPage() {
    const { openModal } = useModal();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<AgendaEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
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

    const calendarGrid = useMemo((): CalendarGridCell[] => {
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
              <p className="agenda-toast-message">Tem certeza que deseja excluir este evento?</p>
              <div className="agenda-toast-buttons">
                <button
                  className="agenda-btn agenda-btn-danger"
                  onClick={() => {
                    toast.dismiss(t.id);
                    performDelete(eventId);
                  }}
                >
                  Excluir
                </button>
                <button className="agenda-btn agenda-btn-secondary" onClick={() => toast.dismiss(t.id)}>
                  Cancelar
                </button>
              </div>
            </div>
          ), {
            id: `agenda-confirm-delete-${eventId}`,
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

    const navigateToPreviousMonth = useCallback(() => {
        setCurrentDate(prev => subMonths(prev, 1));
    }, []);

    const navigateToNextMonth = useCallback(() => {
        setCurrentDate(prev => addMonths(prev, 1));
    }, []);

    const handleAddEventToday = useCallback(() => {
        const today = new Date();
        const formattedDate = format(today, 'yyyy-MM-dd');
        openModal('agendaEvent', { 
            date: formattedDate, 
            onSave: () => fetchEvents(currentDate) 
        });
    }, [openModal, currentDate, fetchEvents]);

if (isLoading) {
        return (
            <div className="agenda-page">
                <div className="agenda-loading-wrapper">
                    <div className="agenda-spinner">
                        <div className="agenda-dot1"></div>
                        <div className="agenda-dot2"></div>
                        <div className="agenda-dot3"></div>
                    </div>
                    <p>Carregando eventos...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="agenda-page">
                <div className="page-header">
                    <div className="header-content">
                        <div className="header-title">
                            <h1>
                                <i className="fas fa-calendar-day"></i>
                                Agenda Diária
                            </h1>
                            <p>Escala diária do setor</p>
                        </div>
                        <div className="header-actions">
                            <div className="header-count">
                                {events.length} evento{events.length !== 1 ? 's' : ''} este mês
                            </div>
                            <button
                                className="btn btn-primary btn-create"
                                onClick={handleAddEventToday}
                            >
                                <i className="fas fa-plus"></i>
                                <span>Novo Evento Hoje</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="agenda-main-container">
                    <div className="agenda-calendar-header">
                        <button
                            onClick={navigateToPreviousMonth}
                            className="agenda-btn agenda-btn-secondary agenda-calendar-nav-btn"
                            title="Mês anterior"
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>

                        <div className="agenda-calendar-title">
                            <h3>
                                {format(currentDate, "MMMM", { locale: ptBR })}
                            </h3>
                            <span className="agenda-calendar-subtitle">
                                {format(currentDate, "yyyy", { locale: ptBR })}
                            </span>
                        </div>

                        <button
                            onClick={navigateToNextMonth}
                            className="agenda-btn agenda-btn-secondary agenda-calendar-nav-btn"
                            title="Próximo mês"
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>

                    <div className="agenda-grid-days">
                        <div className="agenda-calendar-grid">
                            {weekDays.map(day => (
                                <div key={day} className="agenda-weekday-header">
                                    {day}
                                </div>
                            ))}

                            {calendarGrid.map((dayData, index) => (
                                <div
                                    key={index}
                                    className={`agenda-day-cell ${!dayData ? 'agenda-disabled' : ''} ${dayData && isToday(dayData.day) ? 'agenda-today' : ''}`}
                                >
                                    {dayData && (
                                        <>
                                            <div className="agenda-day-header">
                                                <div className="agenda-day-number">{format(dayData.day, 'd')}</div>
                                                <button
                                                    className="agenda-add-event-btn"
                                                    onClick={() => handleAddEvent(dayData.day)}
                                                    title="Adicionar evento"
                                                >
                                                    <i className="fas fa-plus"></i>
                                                </button>
                                            </div>

                                            <div className="agenda-events-container">
                                                {dayData.events.length > 0 ? (
                                                    dayData.events.map(event => (
                                                        <div
                                                            key={event.id}
                                                            className="agenda-event-item"
                                                            style={{ backgroundColor: event.color ? `${event.color}BF` : 'var(--accent-blue)', borderColor: event.color || 'var(--accent-blue)' }}
                                                            onClick={() => handleEditEvent(event)}
                                                            title={`${event.title}${event.description ? ' - ' + event.description : ''}`}
                                                        >
                                                            <div className="agenda-event-content">
                                                                <i className="fas fa-circle agenda-event-dot" style={{ color: event.color || 'var(--text-primary)' }}></i>
                                                                <span className="agenda-event-title">{truncateText(event.title, 21)}</span>
                                                            </div>
                                                            <button
                                                                className="agenda-delete-event-btn"
                                                                onClick={(e) => handleDeleteEvent(e, event.id)}
                                                                title="Excluir evento"
                                                            >
                                                                <i className="fas fa-times"></i>
                                                            </button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="agenda-no-events">
                                                        <i className="far fa-calendar-plus agenda-empty-icon"></i>
                                                        <span>Adicionar</span>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
