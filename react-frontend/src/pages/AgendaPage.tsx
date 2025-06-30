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

import { useAuth } from '../contexts/AuthContext'; 
import * as agendaService from '../services/agenda';
import { AgendaEvent } from '../types/kanban';
import { useModal } from '../contexts/ModalContext';
import styles from './AgendaPage.module.css';

type CalendarGridCell = {
    day: Date;
    events: AgendaEvent[]
} | null;

const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

export function AgendaPage() {
    const { openModal } = useModal();
    const { user } = useAuth();
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
            if (!isSameMonth(day, currentDate)) return null;

            const dayString = format(day, 'yyyy-MM-dd');
            const dayEvents = events.filter(event => event.event_date?.startsWith(dayString));

            return { day, events: dayEvents };
        });
    }, [currentDate, events]);

    const weekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    const handleAddEvent = useCallback((day: Date) => {
        const formattedDate = format(day, 'yyyy-MM-dd');
        openModal('agendaEvent', { date: formattedDate, onSave: () => fetchEvents(currentDate) });
    }, [openModal, currentDate, fetchEvents]);

    const handleEditEvent = useCallback((event: AgendaEvent) => {
        openModal('agendaEvent', {
            event,
            onSave: () => fetchEvents(currentDate),
            isReadOnly: !user?.user_metadata?.is_admin
        });
    }, [openModal, currentDate, fetchEvents, user]);

    const performDelete = async (eventId: number) => {
        try {
            await toast.promise(
                agendaService.deleteAgendaEvent(eventId),
                { loading: 'Excluindo evento...', success: 'Evento excluído com sucesso!', error: 'Falha ao excluir evento.' }
            );
            setEvents(prev => prev.filter(e => e.id !== eventId));
        } catch (error) { console.error('Erro ao excluir evento:', error); }
    };

    const handleDeleteEvent = useCallback((e: React.MouseEvent, eventId: number) => {
        e.stopPropagation();
        toast((t) => (
            <div>
              <p className={styles.agendaToastMessage}>Tem certeza que deseja excluir este evento?</p>
              <div className={styles.agendaToastButtons}>
                <button className={`${styles.agendaBtn} ${styles.agendaBtnDanger}`} onClick={() => { toast.dismiss(t.id); performDelete(eventId); }}>Excluir</button>
                <button className={`${styles.agendaBtn} ${styles.agendaBtnSecondary}`} onClick={() => toast.dismiss(t.id)}>Cancelar</button>
              </div>
            </div>
        ), { id: `agenda-confirm-delete-${eventId}` });
    }, []);

    const navigateToPreviousMonth = useCallback(() => setCurrentDate(prev => subMonths(prev, 1)), []);
    const navigateToNextMonth = useCallback(() => setCurrentDate(prev => addMonths(prev, 1)), []);
    const handleAddEventToday = useCallback(() => {
        openModal('agendaEvent', { date: format(new Date(), 'yyyy-MM-dd'), onSave: () => fetchEvents(currentDate) });
    }, [openModal, currentDate, fetchEvents]);

    if (isLoading) {
        return (
            <div className={styles.agendaPage}>
                <div className={styles.agendaLoadingWrapper}>
                    <div className={styles.agendaSpinner}>
                        <div className={styles.agendaDot1}></div><div className={styles.agendaDot2}></div><div className={styles.agendaDot3}></div>
                    </div>
                    <p>Carregando eventos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.agendaPage}>
            <div className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.headerTitle}><h1><i className="fas fa-calendar-day"></i>Agenda Diária</h1><p>Escala mensal do setor atual.</p></div>
                    <div className={styles.headerActions}>
                        <div className={styles.headerCount}>{events.length} evento{events.length !== 1 ? 's' : ''} este mês</div>
                        {user?.user_metadata?.is_admin && (
                            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnCreate}`} onClick={handleAddEventToday}><i className="fas fa-plus"></i><span>Novo Evento Hoje</span></button>
                        )}
                    </div>
                </div>
            </div>
            <div className={styles.agendaMainContainer}>
                <div className={styles.agendaCalendarHeader}>
                    <button onClick={navigateToPreviousMonth} className={styles.agendaCalendarNavBtn} title="Mês anterior"><i className="fas fa-chevron-left"></i></button>
                    <div className={styles.agendaCalendarTitle}>
                        <h3>{format(currentDate, "MMMM", { locale: ptBR })}</h3>
                        <span className={styles.agendaCalendarSubtitle}>{format(currentDate, "yyyy", { locale: ptBR })}</span>
                    </div>
                    <button onClick={navigateToNextMonth} className={styles.agendaCalendarNavBtn} title="Próximo mês"><i className="fas fa-chevron-right"></i></button>
                </div>
                <div className={styles.agendaCalendarGrid}>
                    {weekDays.map(day => (<div key={day} className={styles.agendaWeekdayHeader}>{day}</div>))}
                    {calendarGrid.map((dayData, index) => (
                        <div
    key={index}
    className={`${styles.agendaDayCell} ${!dayData ? styles.agendaDisabled : ''} ${dayData && isToday(dayData.day) ? styles.agendaToday : ''}`}
    data-weekday={dayData ? weekDays[dayData.day.getDay()] : ''}
>                            {dayData && (
                                <>
                                    <div className={styles.agendaDayHeader}>
                                        <div className={styles.agendaDayNumber}>{format(dayData.day, 'd')}</div>
                                        {user?.user_metadata?.is_admin && (
                                            <button className={styles.agendaAddEventBtn} onClick={() => handleAddEvent(dayData.day)} title="Adicionar evento"><i className="fas fa-plus"></i></button>
                                        )}
                                    </div>
                                    <div className={styles.agendaEventsContainer}>
                                        {dayData.events.length > 0 ? (
                                            dayData.events.map(event => (
                                                <div key={event.id} className={styles.agendaEventItem} style={{ backgroundColor: event.color ? `${event.color}BF` : 'var(--accent-blue)', borderColor: event.color || 'var(--accent-blue)' }} onClick={() => handleEditEvent(event)} title={`${event.title}${event.description ? ' - ' + event.description : ''}`}>
                                                    <div className={styles.agendaEventContent}>
                                                        <i className={`fas fa-circle ${styles.agendaEventDot}`} style={{ color: event.color || 'var(--text-primary)' }}></i>
                                                        <span className={styles.agendaEventTitle}>{truncateText(event.title, 21)}</span>
                                                    </div>
                                                    {user?.user_metadata?.is_admin && (
                                                        <button className={styles.agendaDeleteEventBtn} onClick={(e) => handleDeleteEvent(e, event.id)} title="Excluir evento"><i className="fas fa-times"></i></button>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className={styles.agendaNoEvents} onClick={ user?.user_metadata?.is_admin ? () => handleAddEvent(dayData.day) : undefined} style={{ cursor: user?.user_metadata?.is_admin ? 'pointer' : 'default' }}>

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
    );
}