import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { debounce } from 'lodash';

import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Comment } from '../../types/kanban';
import * as cardService from '../../services/cards';
import { userDisplayNameModalMap } from '../../api/config';

import { AssigneeSelector } from '../kanban/AssigneeSelector';
import { CommentSection } from '../kanban/CommentSection';
import { Loader } from '../ui/Loader';

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
    
    const getAuthorName = useCallback(() => (currentUser && (userDisplayNameModalMap[currentUser.email!] || currentUser.email!)) || "Usuário", [currentUser]);

    const saveChanges = useCallback(async () => {
        if (!isEditing || !editingCard || !board) return;
        setIsSaving(true);
        const descriptionJson = board.is_public ? JSON.stringify({ observacoes, tentativas, resolucao }) : JSON.stringify({ comments: privateComments });
        const cardData: Partial<Card> = { title, priority, assigned_to: assignee ?? '', due_date: dueDate ? new Date(dueDate).toISOString() : null, description: descriptionJson };
        
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
            title, priority, assigned_to: assignee ?? '', due_date: dueDate ? new Date(dueDate).toISOString() : null,
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
            <div className="confirmation-toast">
                <h4>Confirmar Exclusão</h4>
                <p>Você tem certeza? Esta ação não pode ser desfeita.</p>
                <div className="toast-buttons">
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
    if (!board) return <div className="modal" style={{display:'flex'}}><div className="modal-content" style={{width:'200px',height:'200px'}}><Loader isVisible={true}/></div></div>;

    const userSource = board.is_public ? users : boardMembers;
    const isArchived = editingCard && (editingCard.column_id === solucionadoId || editingCard.column_id === naoSolucionadoId);

    return (
        <div className={`modal ${isClosing ? 'closing' : ''}`} onClick={closeModal}>
            <div className={`modal-content priority-${priority}`} onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
                <div className="modal-header">
                    <h2 id="modalTitle" style={{display: 'flex', alignItems: 'center'}}>
                        <i className="fas fa-edit"></i>
                        <span>{isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}</span>
                        
                        {/* CORREÇÃO: A renderização agora usa a lógica completa de visibilidade e animação */}
                        {isIndicatorVisible && (
                            <div className={`autosave-indicator ${isSaving ? 'fade-in' : 'fade-out'}`}>
                                <i className="fas fa-spinner fa-spin"></i> Salvando...
                            </div>
                        )}
                    </h2>
                </div>
                <div className="modal-body">
                    <div className="modal-main">
                        <form id="taskForm" onSubmit={handleSubmitNewTask}>
                            <div className="form-section">
                                <div className="form-group priority-group">
                                    <label className="section-label"><i className="fas fa-flag"></i> Prioridade</label>
                                    <div className="priority-options">
                                        {(['baixa', 'media', 'alta'] as const).map(p => (
                                            <label key={p} className="priority-radio"><input type="radio" name="priority" value={p} checked={priority === p} onChange={() => { setPriority(p); setIsDirty(true); }} /><span className={`priority-indicator priority-${p}`}></span><span className="priority-text">{p.charAt(0).toUpperCase() + p.slice(1)}</span></label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="form-section">
                                <div className="form-group"><label htmlFor="taskTitle" className="form-label"><i className="fas fa-user"></i> ID e Nome do Cliente</label><input type="text" id="taskTitle" value={title} onChange={e => { setTitle(e.target.value); setIsDirty(true); }} className="form-input" required /></div>
                                <div className="form-group"><label htmlFor="taskDate" className="form-label"><i className="fas fa-calendar"></i> Data e Hora de Entrega</label><input type="datetime-local" id="taskDate" value={dueDate} onChange={e => { setDueDate(e.target.value); setIsDirty(true); }} className="form-input" /></div>
                                <div className="form-group">
                                    <label className="form-label"><i className="fas fa-user-tag"></i> Colaborador</label>
                                    <AssigneeSelector users={userSource} selectedAssignee={assignee} onSelect={(name) => { setAssignee(name); setIsDirty(true); }} />
                                </div>
                                {!isEditing && <div className="form-group"><label htmlFor="taskNewDescription" className="form-label"><i className="fas fa-comment"></i> Comentário Inicial</label><textarea id="taskNewDescription" value={initialDescription} onChange={e => setInitialDescription(e.target.value)} className="form-textarea" placeholder="Descreva um comentário inicial..." rows={4}></textarea></div>}
                            </div>
                            
                            <div className="form-actions">
                                {isEditing && (
                                    <button type="button" className="btn btn-danger" onClick={handleDelete}>
                                        <i className="fas fa-trash-alt"></i>
                                        <span>Excluir</span>
                                    </button>
                                )}
                                <div className="main-actions">
                                    {isEditing && board.is_public && !isArchived && (
                                        <div className="status-buttons">
                                            <button type="button" className="btn btn-solved" onClick={() => handleMoveToStatus(true)}><i className="fas fa-check"></i><span>Solucionado</span></button>
                                            <button type="button" className="btn btn-unsolved" onClick={() => handleMoveToStatus(false)}><i className="fas fa-times"></i><span>Não Solucionado</span></button>
                                        </div>
                                    )}
                                    {isEditing && isArchived && (
                                        <div className="status-buttons">
                                            <button type="button" className="btn btn-primary" onClick={handleReturnToBoard}>
                                                <i className="fas fa-undo"></i><span>Retornar à Escala</span>
                                            </button>
                                        </div>
                                    )}
                                    {!isEditing && <button type="submit" className="btn btn-primary"><i className="fas fa-check-circle"></i><span>Confirmar</span></button>}
                                </div>
                            </div>
                        </form>
                    </div>
                    {isEditing && (
                        <div className="modal-comments">
                            <div className="comments-header"><h3><i className="fas fa-comments"></i> Acompanhamento</h3></div>
                            <div className="comments-container">
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