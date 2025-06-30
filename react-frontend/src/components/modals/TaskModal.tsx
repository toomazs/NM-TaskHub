import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { debounce } from 'lodash';

import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Comment } from '../../types/kanban';
import * as cardService from '../../services/cards';
import { userDisplayNameMap } from '../../api/config';

import { AssigneeSelector } from '../kanban/AssigneeSelector';
import { CommentSection } from '../kanban/CommentSection';
import { Loader } from '../ui/Loader';
import styles from './TaskModal.module.css';

export function TaskModal() {
    const { isModalOpen, closeModal, isClosing, editingCard, currentColumnId } = useModal();
    const { board, columns, users, boardMembers, solucionadoId, naoSolucionadoId, fetchBoardData } = useBoard();
    const { user: currentUser } = useAuth();
    
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<'baixa' | 'media' | 'alta'>('media');
    const [dueDate, setDueDate] = useState('');
    const [assignee, setAssignee] = useState<string | null>(null);
    const [initialDescription, setInitialDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    
    const [isIndicatorVisible, setIsIndicatorVisible] = useState(false);
    
    const [observacoes, setObservacoes] = useState<Comment[]>([]);
    const [tentativas, setTentativas] = useState<Comment[]>([]);
    const [resolucao, setResolucao] = useState<Comment[]>([]);
    const [privateComments, setPrivateComments] = useState<Comment[]>([]);

    const isEditing = !!editingCard;

    useEffect(() => {
        if (isEditing && editingCard && board) {
            setTitle(editingCard.title || '');
            setPriority(editingCard.priority || 'media');
            setAssignee(editingCard.assigned_to || null);
            if (editingCard.due_date) {
                const localDate = new Date(editingCard.due_date);
                localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
                setDueDate(localDate.toISOString().slice(0, 16));
            } else {
                setDueDate('');
            }
            
            try {
                const desc = JSON.parse(editingCard.description || '{}');
                if(board.is_public) {
                    setObservacoes(desc.observacoes || []);
                    setTentativas(desc.tentativas || []);
                    setResolucao(desc.resolucao || []);
                } else {
                    setPrivateComments(desc.comments || []);
                }
            } catch {
                const fallbackComment = { text: editingCard.description, author: 'Sistema', timestamp: '' };
                if(board.is_public) setObservacoes([fallbackComment]);
                else setPrivateComments([fallbackComment]);
            }
        } else {
            setTitle(''); setPriority('media'); setDueDate(''); setAssignee(null);
            setInitialDescription(''); setObservacoes([]); setTentativas([]);
            setResolucao([]); setPrivateComments([]);
        }
        setIsDirty(false);
    }, [isModalOpen, editingCard, board]);

    useEffect(() => {
        if (isSaving) {
            setIsIndicatorVisible(true);
        } else {
            const timer = setTimeout(() => {
                setIsIndicatorVisible(false);
            }, 500); 

            return () => clearTimeout(timer);
        }
    }, [isSaving]);
    
    const getAuthorName = useCallback(() => (currentUser && (userDisplayNameMap[currentUser.email!] || currentUser.email!)) || "Usuário", [currentUser]);

    const saveChanges = useCallback(async () => {
        if (!isEditing || !editingCard || !board) return;
        setIsSaving(true);
        const descriptionJson = board.is_public ? JSON.stringify({ observacoes, tentativas, resolucao }) : JSON.stringify({ comments: privateComments });
        const cardData: Partial<Card> = { title, priority, assigned_to: assignee ?? undefined, due_date: dueDate ? new Date(dueDate).toISOString() : null, description: descriptionJson };
        
        try {
            await cardService.updateCard(editingCard.id, cardData);
            setIsDirty(false);
        } catch (error) { toast.error("Falha no salvamento automático.");
        } finally { setIsSaving(false); }
    }, [isEditing, editingCard, board, title, priority, dueDate, assignee, observacoes, tentativas, resolucao, privateComments]);

    const debouncedSave = useCallback(debounce(saveChanges, 2000), [saveChanges]);

    useEffect(() => {
        if (isEditing && isDirty) debouncedSave();
    }, [isEditing, isDirty, title, priority, dueDate, assignee, observacoes, tentativas, resolucao, privateComments, debouncedSave]);
    
    const handleSubmitNewTask = async (e: React.FormEvent) => {
        e.preventDefault();
        const toastId = toast.loading("Criando tarefa...");
        const cardData = {
            title, priority, assigned_to: assignee ?? undefined, due_date: dueDate ? new Date(dueDate).toISOString() : null,
            description: JSON.stringify({
                observacoes: initialDescription ? [{ text: initialDescription, author: getAuthorName(), timestamp: new Date().toLocaleString('pt-BR') }] : [],
                tentativas: [], resolucao: []
            })
        };
        try {
            await cardService.createCard(currentColumnId!, cardData);
            await fetchBoardData(board!.id, !board!.is_public);
            toast.success("Tarefa criada!", { id: toastId });
            closeModal();
        } catch (error) { toast.error("Falha ao criar tarefa.", { id: toastId }); }
    };

    const handleMoveToStatus = async (solved: boolean) => {
        if (!isEditing || !board || !editingCard) return;
        if(isDirty) await saveChanges();
        const targetColumnId = solved ? solucionadoId : naoSolucionadoId;
        if (!targetColumnId) { toast.error("Coluna de status não encontrada."); return; }
        await cardService.moveCard(editingCard.id, targetColumnId, 0);
        await fetchBoardData(board.id, !board.is_public);
        closeModal();
    };

    const handleReturnToBoard = async () => {
        if (!isEditing || !editingCard || !board) return;
        const firstActiveColumn = columns.sort((a, b) => a.position - b.position).find(c => c.id !== solucionadoId && c.id !== naoSolucionadoId);
        if (!firstActiveColumn) { toast.error("Nenhuma coluna de trabalho ativa encontrada."); return; }
        if(isDirty) await saveChanges();
        const toastId = toast.loading("Retornando tarefa para a escala...");
        try {
            await cardService.moveCard(editingCard.id, firstActiveColumn.id, 0);
            await fetchBoardData(board.id, !board.is_public);
            toast.success("Tarefa retornada!", { id: toastId });
            closeModal();
        } catch (error) { toast.error("Falha ao retornar tarefa.", { id: toastId }); }
    };

    const executeDelete = useCallback(async () => {
        if (!isEditing || !editingCard || !board) return;
        const toastId = toast.loading("Excluindo tarefa...");
        try {
            await cardService.deleteCard(editingCard.id);
            toast.success("Tarefa excluída com sucesso!", { id: toastId });
            await fetchBoardData(board.id, !board.is_public);
            closeModal();
        } catch (error) { toast.error("Falha ao excluir a tarefa.", { id: toastId }); }
    }, [editingCard, board, fetchBoardData, closeModal, isEditing]);

    const handleDelete = () => {
        toast((t) => (
            <div className={styles.confirmationToast}>
                <h4>Confirmar Exclusão</h4>
                <p>Você tem certeza? Esta ação não pode ser desfeita.</p>
                <div className={styles.toastButtons}>
                    <button
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                            toast.dismiss(t.id);
                            executeDelete();
                        }}
                    >
                        Sim, Excluir
                    </button>
                    <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        ), {
            duration: Infinity,
            position: 'top-center',
        });
    };
    
    if (!isModalOpen) return null;
    if (!board) return <div className={styles.modal} style={{display:'flex'}}><div className={styles.modalContent} style={{width:'200px',height:'200px'}}><Loader isVisible={true}/></div></div>;

    const userSource = board.is_public ? users : boardMembers;
    const isArchived = editingCard && (editingCard.column_id === solucionadoId || editingCard.column_id === naoSolucionadoId);

    return (
        <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={closeModal}>
            <div className={`${styles.modalContent} ${styles[`priority-${priority}`]}`} onClick={e => e.stopPropagation()}>
                <button className={styles.modalClose} onClick={closeModal}><i className="fas fa-times"></i></button>
                <div className={styles.modalHeader}>
                    <h2 style={{display: 'flex', alignItems: 'center'}}>
                        <i className="fas fa-edit"></i>
                        <span>{isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}</span>
                        
                        {isIndicatorVisible && (
                            <div className={`${styles.autosaveIndicator} ${isSaving ? styles.fadeIn : styles.fadeOut}`}>
                                <i className={`fas fa-spinner ${styles.faSpin}`}></i> Salvando...
                            </div>
                        )}
                    </h2>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.modalMain}>
                        <form id="taskForm" onSubmit={handleSubmitNewTask}>
                            <div className={styles.formSection}>
                                <div className={`${styles.formGroup} ${styles.priorityGroup}`}>
                                    <label className={styles.sectionLabel}><i className="fas fa-flag"></i> Prioridade</label>
                                    <div className={styles.priorityOptions}>
                                        {(['baixa', 'media', 'alta'] as const).map(p => (
                                            <label key={p} className={styles.priorityRadio}><input type="radio" name="priority" value={p} checked={priority === p} onChange={() => { setPriority(p); setIsDirty(true); }} /><span className={`${styles.priorityIndicator} ${styles[`priority-${p}`]}`}></span><span className={styles.priorityText}>{p.charAt(0).toUpperCase() + p.slice(1)}</span></label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.formSection}>
                                <div className={styles.formGroup}><label htmlFor="taskTitle" className={styles.formLabel}><i className="fas fa-user"></i> Titulo do Card</label><input type="text" id="taskTitle" value={title} onChange={e => { setTitle(e.target.value); setIsDirty(true); }} className={styles.formInput} required /></div>
                                <div className={styles.formGroup}><label htmlFor="taskDate" className={styles.formLabel}><i className="fas fa-calendar"></i> Data e Hora de Entrega</label><input type="datetime-local" id="taskDate" value={dueDate} onChange={e => { setDueDate(e.target.value); setIsDirty(true); }} className={styles.formInput} /></div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}><i className="fas fa-user-tag"></i> Colaborador</label>
                                    <AssigneeSelector 
    users={userSource} 
    currentSelection={assignee}
    onSelect={(name: string | null) => { 
        setAssignee(name); 
        setIsDirty(true); 
    }} 
/>
                                </div>
                                {!isEditing && <div className={styles.formGroup}><label htmlFor="taskNewDescription" className={styles.formLabel}><i className="fas fa-comment"></i> Comentário Inicial</label><textarea id="taskNewDescription" value={initialDescription} onChange={e => setInitialDescription(e.target.value)} className={styles.formTextarea} placeholder="Descreva um comentário inicial..." rows={4}></textarea></div>}
                            </div>
                            
                            <div className={styles.formActions}>
                                {isEditing && (
                                    <button type="button" className={`btn ${styles.btnDanger}`} onClick={handleDelete}>
                                        <i className="fas fa-trash-alt"></i>
                                        <span>Excluir</span>
                                    </button>
                                )}
                                <div className={styles.mainActions}>
                                    {isEditing && board.is_public && !isArchived && (
                                        <div className={styles.statusButtons}>
                                            <button type="button" className={`btn ${styles.btnSolved}`} onClick={() => handleMoveToStatus(true)}><i className="fas fa-check"></i><span>Solucionado</span></button>
                                            <button type="button" className={`btn ${styles.btnUnsolved}`} onClick={() => handleMoveToStatus(false)}><i className="fas fa-times"></i><span>Não Solucionado</span></button>
                                        </div>
                                    )}
                                    {isEditing && isArchived && (
                                        <div className={styles.statusButtons}>
                                            <button type="button" className={`btn ${styles.btnPrimary}`} onClick={handleReturnToBoard}>
                                                <i className="fas fa-undo"></i><span>Retornar à Escala</span>
                                            </button>
                                        </div>
                                    )}
                                    {!isEditing && <button type="submit" className={`btn ${styles.btnPrimary}`}><i className="fas fa-check-circle"></i><span>Confirmar</span></button>}
                                </div>
                            </div>
                        </form>
                    </div>
                    {isEditing && (
                        <div className={styles.modalComments}>
                            <div className={styles.commentsHeader}><h3><i className="fas fa-comments"></i> Acompanhamento</h3></div>
                            <div className={styles.commentsContainer}>
                                {board.is_public ? (
                                    <>
                                        <CommentSection title="Observações" icon="fa-eye" comments={observacoes} onCommentsChange={(c) => { setObservacoes(c); setIsDirty(true); }} authorName={getAuthorName()} />
                                        <CommentSection title="Tentativas de Contato" icon="fa-phone" comments={tentativas} onCommentsChange={(c) => { setTentativas(c); setIsDirty(true); }} authorName={getAuthorName()} />
                                        <CommentSection title="Resolução" icon="fa-check-circle" comments={resolucao} onCommentsChange={(c) => { setResolucao(c); setIsDirty(true); }} authorName={getAuthorName()} />
                                    </>
                                ) : (
                                    <CommentSection title="Comentários" icon="fa-comment-dots" comments={privateComments} onCommentsChange={(c) => { setPrivateComments(c); setIsDirty(true); }} authorName={getAuthorName()} />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}