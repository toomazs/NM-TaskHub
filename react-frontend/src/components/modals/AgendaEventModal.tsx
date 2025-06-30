import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

import { useModal } from '../../contexts/ModalContext';
import * as agendaService from '../../services/agenda';
import styles from './AgendaEventModal.module.css';

export function AgendaEventModal() {
  const { closeModal, modalProps, isClosing } = useModal();
  const { date, onSave, event: editingEvent, isReadOnly } = modalProps || {};
  const isEditing = !!editingEvent;

  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#58a6ff');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const predefinedColors = [
    { color: '#58a6ff', name: 'Azul' }, { color: '#f85149', name: 'Vermelho' },
    { color: '#3fb950', name: 'Verde' }, { color: '#d29922', name: 'Amarelo' },
    { color: '#bc8cff', name: 'Roxo' }, { color: '#fd7e14', name: 'Laranja' },
    { color: '#20c997', name: 'Ciano' }, { color: '#e83e8c', name: 'Rosa' },
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
    if (isReadOnly) return;
    
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
        title: title.trim(), color, description: description.trim(), event_date: eventDate,
      };

      if (isEditing && editingEvent) {
        await agendaService.updateAgendaEvent(editingEvent.id, eventData);
        toast.success('Evento atualizado com sucesso!', { id: toastId });
      } else {
        await agendaService.createAgendaEvent(eventData);
        toast.success('Evento criado com sucesso!', { id: toastId });
      }
      
      if (onSave) onSave();
      closeModal();
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      toast.error(isEditing ? 'Falha ao atualizar evento.' : 'Falha ao criar evento.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDisplayDate = (dateString: string) => {
    try {
      const dateObj = new Date(dateString + 'T00:00:00');
      return format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch { return dateString; }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) closeModal();
  };

  const displayDate = isEditing && editingEvent 
    ? formatDisplayDate(editingEvent.event_date.split('T')[0])
    : date ? formatDisplayDate(date) : '';

  const modalTitleText = isReadOnly ? 'Visualizar Evento' : (isEditing ? 'Editar Evento' : 'Novo Evento');

  return (
    <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={handleModalClick}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <i className={`fas ${isReadOnly ? 'fa-eye' : (isEditing ? 'fa-edit' : 'fa-calendar-plus')} ${styles.modalIcon}`}></i>
            <div><h2>{modalTitleText}</h2><p className={styles.modalSubtitle}>{displayDate}</p></div>
          </div>
          <button className={styles.modalClose} onClick={closeModal} title="Fechar" disabled={isSubmitting}><i className="fas fa-times"></i></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalMain}>
            <form onSubmit={handleSubmit} className={styles.eventForm}>
              <div className={styles.formSection}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-heading"></i> Título do Evento *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={styles.formInput} 
                    placeholder="Digite o título do evento..." required autoFocus maxLength={100} disabled={isSubmitting || isReadOnly}
                  />
                  {!isReadOnly && <small className={styles.formHint}>{title.length}/100 caracteres</small>}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-align-left"></i> Descrição</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} className={styles.formTextarea}
                    rows={3} placeholder="Adicione uma descrição para o evento (opcional)..." maxLength={500} disabled={isSubmitting || isReadOnly}
                  />
                  {!isReadOnly && <small className={styles.formHint}>{description.length}/500 caracteres</small>}
                </div>
              </div>
              <div className={styles.formSection}>
                <label className={styles.formLabel}><i className="fas fa-palette"></i> Cor do Evento</label>
                <div className={styles.colorSelection}>
                  <div className={styles.predefinedColors}>
                    {predefinedColors.map((colorOption) => (
                      <button type="button" key={colorOption.color} 
                        className={`${styles.colorOption} ${color === colorOption.color ? styles.selected : ''}`}
                        style={{ backgroundColor: colorOption.color }} onClick={() => setColor(colorOption.color)} title={colorOption.name} disabled={isSubmitting || isReadOnly}>
                        {color === colorOption.color && <i className="fas fa-check"></i>}
                      </button>
                    ))}
                  </div>
                  <div className={styles.customColor}>
                    <label className={styles.customColorLabel}><i className="fas fa-eyedropper"></i></label>
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className={styles.formColorInput} disabled={isSubmitting || isReadOnly}/>
                  </div>
                </div>
                <div className={styles.colorPreview}><span className={styles.previewLabel}>Preview:</span>
                  <div className={styles.eventPreview} style={{ backgroundColor: `${color}BF` }}>
                    <i className={`fas fa-circle ${styles.eventDot}`}></i><span>{title || 'Título do evento'}</span>
                  </div>
                </div>
              </div>
              {!isReadOnly && (
                <div className={styles.formActions}>
                  <button type="button" className={`btn ${styles.btnSecondary}`} onClick={closeModal} disabled={isSubmitting}><i className="fas fa-times"></i> Cancelar</button>
                  <button type="submit" className={`btn ${styles.btnPrimary}`} disabled={isSubmitting || !title.trim()}>
                    {isSubmitting ? (<><i className="fas fa-spinner fa-spin"></i> Salvando...</>) : (<><i className={`fas ${isEditing ? 'fa-save' : 'fa-plus'}`}></i> {isEditing ? 'Atualizar Evento' : 'Criar Evento'}</>)}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}