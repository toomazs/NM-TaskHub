import React, { useState, useEffect } from 'react';
import { useModal } from '../../contexts/ModalContext';
import * as avaliacaoService from '../../services/avaliacoes';
import { Avaliacao, User } from '../../types/kanban';
import toast from 'react-hot-toast';
import { useBoard } from '../../contexts/BoardContext';
import { userDisplayNameMap } from '../../api/config';
import styles from './AvaliacaoModal.module.css';

export function AvaliacaoModal() {
    const { closeModal, modalProps, isClosing } = useModal();
    const { users } = useBoard();
    const { avaliacao: editingAvaliacao, isReadOnly } = modalProps;
    const isEditing = !!editingAvaliacao;

    const [formData, setFormData] = useState<Partial<Avaliacao>>({});

    useEffect(() => {
        setFormData(isEditing ? editingAvaliacao : {
            source: 'Google',
            status: 'Pendente',
            review_date: new Date().toISOString().split('T')[0]
        });
    }, [editingAvaliacao, isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) return;

        const toastId = toast.loading(isEditing ? 'Atualizando...' : 'Salvando...');
        
        const dataToSend: Partial<Avaliacao> = {
            ...formData,
            rating: Number(formData.rating || 0) || undefined
        };

        if (dataToSend.assigned_to === '') {
            dataToSend.assigned_to = undefined;
        }
        
        if (dataToSend.review_date) {
            if (!dataToSend.review_date.includes('T')) {
                const localDate = new Date(`${dataToSend.review_date}T00:00:00`);
                dataToSend.review_date = localDate.toISOString();
            }
        } else {
            (dataToSend as any).review_date = null;
        }
        
        try {
            if (isEditing) {
                await avaliacaoService.updateAvaliacao((editingAvaliacao as Avaliacao).id, dataToSend);
            } else {
                await avaliacaoService.createAvaliacao(dataToSend);
            }
            toast.success('Salvo com sucesso!', { id: toastId });
            modalProps.onSave();
            closeModal();
        } catch (error) {
            console.error("Falha ao salvar:", error); 
            toast.error('Falha ao salvar.', { id: toastId });
        }
    };

    return (
        <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={closeModal}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <button className={styles.modalClose} onClick={closeModal}><i className="fas fa-times"></i></button>
                <div className={styles.modalHeader}><h2><i className="fas fa-comment-dots"></i> {isReadOnly ? 'Visualizar' : (isEditing ? 'Gerenciar' : 'Nova')} Avaliação</h2></div>
                <div className={styles.modalBody}>
                    <form onSubmit={handleSubmit} className={styles.modalMain}>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}><i className="fas fa-globe"></i> Fonte</label>
                                <select name="source" value={formData.source || 'Google'} onChange={handleChange} className={styles.formSelect} disabled={isReadOnly}>
                                    <option>Google</option><option>ReclameAqui</option><option>Procon</option><option>ANATEL</option><option>Outros</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}><i className="fas fa-info-circle"></i> Status</label>
                                <select name="status" value={formData.status || 'Pendente'} onChange={handleChange} className={styles.formSelect} disabled={isReadOnly}>
                                    <option>Pendente</option><option>Em Tratamento</option><option>Resolvido</option><option>Ignorado</option>
                                </select>
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}><i className="fas fa-user"></i> Nome do Cliente</label>
                                <input type="text" name="customer_name" value={formData.customer_name || ''} onChange={handleChange} className={styles.formInput} required placeholder="Ex: Joãozinho" disabled={isReadOnly}/>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}><i className="fas fa-calendar"></i> Data da Avaliação</label>
                                <input type="date" name="review_date" value={formData.review_date?.split('T')[0] || ''} onChange={handleChange} className={styles.formInput} required disabled={isReadOnly}/>
                            </div>
                        </div>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}><i className="fas fa-star"></i> Nota (1-5)</label>
                                <input type="number" name="rating" value={formData.rating || ''} onChange={handleChange} className={styles.formInput} min="1" max="5" placeholder="Ex: 1" disabled={isReadOnly}/>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}><i className="fas fa-user-tie"></i> Responsável</label>
                                <select name="assigned_to" value={formData.assigned_to || ''} onChange={handleChange} className={styles.formSelect} disabled={isReadOnly}>
                                    <option value="">Ninguém</option>
                                    {users.map(u => ( <option key={u.id} value={u.id}> {userDisplayNameMap[u.username] || u.username} </option> ))}
                                </select>
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}><i className="fas fa-comment"></i> Conteúdo da Avaliação</label>
                            <textarea name="review_content" value={formData.review_content || ''} onChange={handleChange} className={styles.formTextarea} rows={4} required placeholder="Copie e cole o comentário do cliente aqui..." disabled={isReadOnly}></textarea>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}><i className="fas fa-clipboard"></i> Notas da Resolução</label>
                            <textarea name="resolution_notes" value={formData.resolution_notes || ''} onChange={handleChange} className={styles.formTextarea} rows={3} placeholder="Descreva os passos tomados para resolver o problema..." disabled={isReadOnly}></textarea>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}><i className="fas fa-link"></i> Link Original</label>
                            <input type="url" name="review_url" value={formData.review_url || ''} onChange={handleChange} className={styles.formInput} placeholder="https://maps.google.com/review/..." disabled={isReadOnly}/>
                            <div className={styles.inputHelp}><i className="fas fa-lightbulb"></i> Cole o link para a avaliação original (Google, ReclameAqui, etc.)</div>
                        </div>
                        {!isReadOnly && (
                            <div className={styles.formActions}>
                                <button type="submit" className={`btn ${styles.btnPrimary}`}><i className="fas fa-save"></i> Salvar</button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}