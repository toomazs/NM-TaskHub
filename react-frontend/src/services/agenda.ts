
import { api } from '../api/api';
import { AgendaEvent } from '../types/kanban'; 

export async function getAgendaEvents(month: number, year: number): Promise<AgendaEvent[]> {
    const response = await api(`/agenda/events?month=${month}&year=${year}`);
    if (!response.ok) throw new Error('Falha ao buscar eventos da agenda');
    return response.json();
}

export async function createAgendaEvent(data: Partial<AgendaEvent>): Promise<AgendaEvent> {
    const response = await api('/agenda/events', { method: 'POST', body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Falha ao criar evento');
    return response.json();
}

export async function updateAgendaEvent(id: number, data: Partial<AgendaEvent>): Promise<AgendaEvent> {
    const response = await api(`/agenda/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Falha ao atualizar evento');
    return response.json();
}

export async function deleteAgendaEvent(id: number): Promise<void> {
    const response = await api(`/agenda/events/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Falha ao deletar evento');
}