import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

import { useModal } from '../../contexts/ModalContext';
import * as agendaService from '../../services/agenda';
import { AgendaEvent } from '../../types/kanban';

export function AgendaEventModal() {
  const { closeModal, modalProps, isClosing } = useModal();
  const { date, onSave, event: editingEvent } = modalProps || {};
  const isEditing = !!editingEvent;

  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#58a6ff');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const predefinedColors = [
    { color: '#58a6ff', name: 'Azul' }, 
    { color: '#f85149', name: 'Vermelho' },
    { color: '#3fb950', name: 'Verde' }, 
    { color: '#d29922', name: 'Amarelo' },
    { color: '#bc8cff', name: 'Roxo' }, 
    { color: '#fd7e14', name: 'Laranja' },
    { color: '#20c997', name: 'Ciano' }, 
    { color: '#e83e8c', name: 'Rosa' },
  ];
  
  useEffect(() => {
    if (isEditing && editingEvent) {
      setTitle(editingEvent.title || '');
      setColor(editingEvent.color || '#58a6ff');
      setDescription(editingEvent.description || '');
    } else {
      setTitle('');
      setColor('#58a6ff');
      setDescription('');
    }
  }, [editingEvent, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Por favor, insira um título para o evento.');
      return;
    }

    if (!date && !isEditing) {
      toast.error('Data do evento não encontrada.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(isEditing ? 'Atualizando evento...' : 'Criando evento...');
    
    try {
      const eventDate = isEditing && editingEvent ? editingEvent.event_date : `${date}T00:00:00.000Z`;

      const eventData = {
        title: title.trim(),
        color,
        description: description.trim(),
        event_date: eventDate,
      };

      if (isEditing && editingEvent) {
        await agendaService.updateAgendaEvent(editingEvent.id, eventData);
        toast.success('Evento atualizado com sucesso!', { id: toastId });
      } else {
        await agendaService.createAgendaEvent(eventData);
        toast.success('Evento criado com sucesso!', { id: toastId });
      }
      
      if (onSave) {
        onSave();
      }
      closeModal();
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      toast.error(
        isEditing ? 'Falha ao atualizar evento.' : 'Falha ao criar evento.', 
        { id: toastId }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDisplayDate = (dateString: string) => {
    try {
      const dateObj = new Date(dateString + 'T00:00:00');
      return format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      closeModal();
    }
  };

  const displayDate = isEditing && editingEvent 
    ? formatDisplayDate(editingEvent.event_date.split('T')[0])
    : date ? formatDisplayDate(date) : '';

  return (
    <div 
      className={`modal agenda-event-modal ${isClosing ? 'closing' : ''}`} 
      onClick={handleModalClick}
    >
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <i className={`fas ${isEditing ? 'fa-edit' : 'fa-calendar-plus'} modal-icon`}></i>
            <div>
              <h2>{isEditing ? 'Editar Evento' : 'Novo Evento'}</h2>
              <p className="modal-subtitle">
                {displayDate}
              </p>
            </div>
          </div>
          <button 
            className="modal-close" 
            onClick={closeModal} 
            title="Fechar"
            disabled={isSubmitting}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-main">
            <form onSubmit={handleSubmit} className="event-form">
              <div className="form-section">
                <div className="form-group">
                  <label className="form-label">
                    <i className="fas fa-heading"></i> 
                    Título do Evento *
                  </label>
                  <input 
                    type="text" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    className="form-input" 
                    placeholder="Digite o título do evento..." 
                    required 
                    autoFocus 
                    maxLength={100}
                    disabled={isSubmitting}
                  />
                  <small className="form-hint">{title.length}/100 caracteres</small>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <i className="fas fa-align-left"></i> 
                    Descrição
                  </label>
                  <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    className="form-textarea" 
                    rows={3} 
                    placeholder="Adicione uma descrição para o evento (opcional)..." 
                    maxLength={500}
                    disabled={isSubmitting}
                  />
                  <small className="form-hint">{description.length}/500 caracteres</small>
                </div>
              </div>

              <div className="form-section">
                <label className="form-label">
                  <i className="fas fa-palette"></i> 
                  Cor do Evento
                </label>
                <div className="color-selection">
                  <div className="predefined-colors">
                    {predefinedColors.map((colorOption) => (
                      <button 
                        type="button" 
                        key={colorOption.color} 
                        className={`color-option ${color === colorOption.color ? 'selected' : ''}`} 
                        style={{ backgroundColor: colorOption.color }} 
                        onClick={() => setColor(colorOption.color)} 
                        title={colorOption.name}
                        disabled={isSubmitting}
                      >
                        {color === colorOption.color && (
                          <i className="fas fa-check"></i>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="custom-color">
                    <label className="custom-color-label">
                      <i className="fas fa-eyedropper"></i>
                    </label>
                    <input 
                      type="color" 
                      value={color} 
                      onChange={e => setColor(e.target.value)} 
                      className="form-color-input"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="color-preview">
                  <span className="preview-label">Preview:</span>
                  <div 
                    className="event-preview" 
                    style={{ backgroundColor: `${color}BF` }}
                  >
                    <i className="fas fa-circle event-dot"></i>
                    <span>{title || 'Título do evento'}</span>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={closeModal} 
                  disabled={isSubmitting}
                >
                  <i className="fas fa-times"></i> 
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isSubmitting || !title.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> 
                      Salvando...
                    </>
                  ) : (
                    <>
                      <i className={`fas ${isEditing ? 'fa-save' : 'fa-plus'}`}></i> 
                      {isEditing ? 'Atualizar Evento' : 'Criar Evento'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}