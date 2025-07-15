import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    FaTimes, FaUndo, FaClipboardList, FaUser, FaCalendarCheck, FaPhoneSlash,
    FaExclamationTriangle, FaUserCheck, FaServer, FaSitemap, FaSpinner,
    FaArrowDown, FaArrowUp, FaPhone, FaCheckCircle, FaBan, FaHome,
    FaMapMarkerAlt, FaWhatsapp, FaMobile, FaPencilAlt, FaTrash, FaPlus, FaCheck
} from 'react-icons/fa';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import { useBoard } from '../../contexts/BoardContext';
import { ClienteSinalAltoComStatus, StatusKey, Comment } from '../../types/sinal';
import { userDisplayNameMap } from '../../api/config';
import * as contatosService from '../../services/contatos';
import { AssigneeSelector } from '../kanban/AssigneeSelector';
import { debounce } from 'lodash';
import toast from 'react-hot-toast';
import styles from './ContatoModal.module.css';

const CommentSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    comments: Comment[];
    onCommentsChange: (comments: Comment[]) => void;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    canComment: boolean;
}> = ({ title, icon, comments, onCommentsChange, authorId, authorName, authorAvatar, canComment }) => {
    const [isInputVisible, setInputVisible] = useState(false);
    const [newCommentText, setNewCommentText] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');

    const handleAddComment = () => {
        if (!newCommentText.trim()) return;
        const comment: Comment = {
            text: newCommentText.trim(),
            author: authorName,
            authorId,
            avatar: authorAvatar,
            timestamp: new Date().toLocaleString('pt-BR'),
        };
        onCommentsChange([...(comments || []), comment]);
        setNewCommentText('');
        setInputVisible(false);
    };

    const handleDeleteComment = (indexToDelete: number) => {
        toast((t) => (
            <span>
                Excluir este comentário?
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <button className={`${styles.btn} ${styles.btnDanger}`} style={{flex: 1}} onClick={() => {
                        onCommentsChange(comments.filter((_, index) => index !== indexToDelete));
                        toast.dismiss(t.id);
                        toast.success("Comentário removido.");
                    }}>Sim</button>
                    <button className={`${styles.btn} ${styles.btnSecondary}`} style={{flex: 1}} onClick={() => toast.dismiss(t.id)}>Não</button>
                </div>
            </span>
        ));
    };

    const handleStartEditing = (index: number, text: string) => {
        setEditingIndex(index);
        setEditingText(text);
    };

    const handleCancelEditing = () => {
        setEditingIndex(null);
        setEditingText('');
    };

    const handleSaveEdit = () => {
        if (editingIndex === null || !editingText.trim()) return;
        const updatedComments = comments.map((comment, index) =>
            index === editingIndex ? { ...comment, text: editingText.trim(), edited: true, timestamp: new Date().toLocaleString('pt-BR') } : comment
        );
        onCommentsChange(updatedComments);
        handleCancelEditing();
        toast.success("Comentário atualizado.");
    };

    return (
        <div className={styles.commentSection}>
            <div className={styles.commentSectionHeader}>
                <h4>{icon}{title}</h4>
                {canComment && <button type="button" className={styles.addCommentBtn} onClick={() => setInputVisible(s => !s)} title="Adicionar Comentário"><FaPlus /></button>}
            </div>
            <div className={styles.commentList}>
                {(!comments || comments.length === 0) && !isInputVisible && (
                     <div className={styles.noCommentsMessage}>Nenhum comentário ainda.</div>
                )}
                {comments && comments.map((comment, index) => {
                    const canEdit = comment.authorId === authorId || (comment.author === authorName && !comment.authorId);

                    if (editingIndex === index && canEdit) {
                        return (
                            <div key={index} className={styles.commentEditContainer}>
                                <textarea className={styles.commentEditTextarea} value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3}></textarea>
                                <div className={styles.commentActions}>
                                    <button type="button" className={styles.btnSave} onClick={handleSaveEdit}><FaCheck /> Salvar</button>
                                    <button type="button" className={`${styles.btn} ${styles.btnCancelEdit}`} onClick={handleCancelEditing}><FaTimes /></button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={index} className={styles.comment}>
                            <div className={styles.commentAvatar}>
                                {comment.avatar ? <img src={comment.avatar} alt={comment.author} /> : <div className={styles.commentAvatarInitial}>{comment.author.charAt(0)}</div>}
                            </div>
                            <div className={styles.commentBody}>
                                <div className={styles.commentHeader}>
                                    <span className={styles.commentAuthor}>{comment.author}</span>
                                    <span className={styles.commentTimestamp}>{comment.timestamp}{comment.edited && ' (editado)'}</span>
                                </div>
                                <p className={styles.commentText}>{comment.text}</p>
                            </div>
                            {canComment && canEdit && (
                                <div className={styles.commentItemActions}>
                                    <button className={styles.editCommentBtn} onClick={() => handleStartEditing(index, comment.text)} title="Editar Comentário"><FaPencilAlt /></button>
                                    <button className={styles.deleteCommentBtn} onClick={() => handleDeleteComment(index)} title="Excluir Comentário"><FaTrash /></button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {isInputVisible && canComment && (
                <div className={styles.commentEditContainer}>
                    <textarea className={styles.commentEditTextarea} placeholder={`Adicionar ${title.toLowerCase().replace('ㅤ', '')}...`} rows={3} value={newCommentText} onChange={e => setNewCommentText(e.target.value)}></textarea>
                    <div className={styles.commentActions}>
                        <button type="button" className={styles.btnSave} onClick={handleAddComment}><FaCheck /> Salvar</button>
                        <button type="button" className={`${styles.btn} ${styles.btnCancelEdit}`} onClick={() => { setInputVisible(false); setNewCommentText(''); }}><FaTimes /></button>
                    </div>
                </div>
            )}
        </div>
    );
};

interface ContatoModalProps {
    cliente: ClienteSinalAltoComStatus;
    onSave: (clienteId: string, status: StatusKey, anotacao: string) => void;
    onAssign?: (clienteId: string) => Promise<string | undefined>;
    onUnassign?: (clienteId: string) => void;
    onAdminAssign?: (clienteId: string, assigneeId: string) => void;
    isEditing?: boolean;
}

export function ContatoModal() {
    const { closeModal, modalProps, isClosing } = useModal();
    const { cliente, onSave, onAssign, onUnassign, onAdminAssign, isEditing } = modalProps as ContatoModalProps;
    const { user } = useAuth();
    const { users } = useBoard();

    const [localCliente, setLocalCliente] = useState<ClienteSinalAltoComStatus | null>(cliente);
    const [tentativas, setTentativas] = useState<Comment[]>([]);
    const [resolucao, setResolucao] = useState<Comment[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [submitAction, setSubmitAction] = useState<string>('');
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => {
        setLocalCliente(cliente);
    }, [cliente]);

    useEffect(() => {
        if (localCliente?.anotacao) {
            try {
                const data = JSON.parse(localCliente.anotacao);
                 const upgradeToCommentArray = (arr: any[] | undefined): Comment[] => {
                    if (!Array.isArray(arr)) return [];
                    return arr.map(item => {
                        if (typeof item === 'string') {
                            return { text: item, author: 'Sistema (Dado Antigo)', authorId: 'system-migrated', timestamp: '' };
                        }
                        return item;
                    }).filter(Boolean);
                };
                setTentativas(upgradeToCommentArray(data.tentativas));
                setResolucao(upgradeToCommentArray(data.resolucao));

            } catch (e) {
                setTentativas([{ text: localCliente.anotacao, author: 'Sistema (Dado Antigo)', authorId: 'system-fallback', timestamp: '' }]);
                setResolucao([]);
            }
        } else {
            setTentativas([]);
            setResolucao([]);
        }
        setIsDirty(false);
    }, [localCliente]);

     const saveChanges = useCallback(async (currentTentativas: Comment[], currentResolucao: Comment[]) => {
        if (!localCliente) return;
        setIsSaving(true);
        const anotacaoString = JSON.stringify({
            tentativas: currentTentativas,
            resolucao: currentResolucao
        });

        try {
            await contatosService.updateContatoAnotacao(localCliente.id, anotacaoString);
            setIsDirty(false);
        } catch (error) {
            toast.error("Falha no salvamento automático.");
        } finally {
            setIsSaving(false);
        }
    }, [localCliente]);

    const debouncedSave = useMemo(
        () => debounce((currentTentativas: Comment[], currentResolucao: Comment[]) => {
            saveChanges(currentTentativas, currentResolucao);
        }, 1500),
        [saveChanges]
    );

     useEffect(() => {
        if (isDirty) {
            debouncedSave(tentativas, resolucao);
        }
        return () => {
            debouncedSave.cancel();
        };
    }, [tentativas, resolucao, isDirty, debouncedSave]);

    const handleSave = useCallback(async (status: StatusKey, actionLabel: string) => {
        if (!onSave || !localCliente) return;
        setIsSubmitting(true);
        setSubmitAction(actionLabel);

        debouncedSave.cancel();

        if (isDirty) {
            await saveChanges(tentativas, resolucao);
        }

        const finalAnotacao = JSON.stringify({ tentativas, resolucao });
        await onSave(localCliente.id, status, finalAnotacao);

        toast.success(`${actionLabel} registrada com sucesso!`, { duration: 3000 });
        setTimeout(() => closeModal(), 500);
    }, [onSave, closeModal, localCliente, isDirty, saveChanges, tentativas, resolucao, debouncedSave]);


    const handleClose = useCallback(() => {
        if (isDirty && !isSubmitting) {
            toast((t) => (
                <span>
                    Você tem alterações não salvas. Sair mesmo assim?
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                        <button className={`${styles.btn} ${styles.btnDanger}`} style={{flex: 1}} onClick={() => {
                            closeModal();
                            toast.dismiss(t.id);
                        }}>Sim</button>
                        <button className={`${styles.btn} ${styles.btnSecondary}`} style={{flex: 1}} onClick={() => toast.dismiss(t.id)}>Não</button>
                    </div>
                </span>
            ));
            return;
        }
        closeModal();
    }, [closeModal, isDirty, isSubmitting]);

    const handleModalContentClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

    const handleAdminAssignSelect = async (selectedValue: string | null) => {
        if (!localCliente) return;
        const loadingToast = toast.loading("Processando atribuição...");
        try {
            if (selectedValue === null) {
                if (onUnassign) await onUnassign(localCliente.id);
                setLocalCliente(prev => prev ? { ...prev, assigned_to: undefined } : null);
                toast.success("Tarefa desatribuída!", { id: loadingToast });
            } else {
                if (onAdminAssign) await onAdminAssign(localCliente.id, selectedValue);
                setLocalCliente(prev => prev ? { ...prev, assigned_to: selectedValue } : null);
                toast.success("Tarefa atribuída!", { id: loadingToast });
            }
        } catch (error: any) {
            toast.error(error.message || "Falha ao processar a atribuição.", { id: loadingToast });
        }
    };

    const handleAssignClick = async () => {
        if (!onAssign || !localCliente) return;
        setIsAssigning(true);
        try {
            const newAssigneeId = await onAssign(localCliente.id);
            if (newAssigneeId) {
                setLocalCliente(prev => prev ? { ...prev, assigned_to: newAssigneeId } : null);
                toast.success("Tarefa assumida com sucesso!");
            } else {
                 toast.error("Não foi possível obter o responsável.");
            }
        } catch (error) {
            toast.error("Falha ao assumir a tarefa.");
        } finally {
            setIsAssigning(false);
        }
    };

    if (!localCliente) return null;

    const authorName = user ? (userDisplayNameMap[user.email!] || user.email!) : 'Usuário';

    const isAdmin = !!user?.user_metadata?.is_admin;
    const isAssignedToCurrentUser = localCliente.assigned_to === user?.id;
    const isUnassigned = !localCliente.assigned_to;

    const canComment = isAssignedToCurrentUser || isAdmin;
    const canRegisterAction = (isAssignedToCurrentUser || isAdmin) && !isUnassigned;

    const assignee = users.find(u => u.id === localCliente.assigned_to);
    const assigneeName = assignee ? (userDisplayNameMap[assignee.email] || assignee.username) : 'Desconhecido';

    const statusOptions = [
        { key: 'Agendado O.S.' as StatusKey, label: 'Agendar O.S.', icon: <FaCalendarCheck/>, className: styles.btnPrimaryButton, description: 'Ordem de serviço foi agendada', actionLabel: 'Agendamento de O.S.' },
        { key: 'Nao conseguido contato' as StatusKey, label: 'Não Consegui Contato', icon: <FaPhoneSlash/>, className: styles.btnSecondary, description: 'Cliente não atendeu ou não foi localizado', actionLabel: 'Registro de contato' },
        { key: 'Nao solucionado' as StatusKey, label: 'Não Solucionado', icon: <FaExclamationTriangle/>, className: styles.btnDanger, description: 'Problema não foi resolvido', actionLabel: 'Marcação como não solucionado' },
        { key: 'Cancelados' as StatusKey, label: 'Cancelar Contato', icon: <FaBan/>, className: styles.btnCancel, description: 'Cancela este contato preventivo', actionLabel: 'Contato Cancelado' }
    ];

    return (
        <div
            className={`${styles.modal} ${isClosing ? styles.closing : ''}`}
            onClick={handleClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className={styles.modalContent} onClick={handleModalContentClick}>
                <div className={styles.modalHeader}>
                    <h2 id="modal-title">
                        <FaClipboardList />
                        Registrar Ação de Contato
                    </h2>
                    <div className={styles.headerIndicators}>
                        {isDirty && !isSaving && (
                            <span className={styles.dirtyIndicator}>Alterações não salvas</span>
                        )}
                        {isSaving && (
                            <span className={styles.savingIndicator}>
                                <FaSpinner className="fa-spin" /> Salvando...
                            </span>
                        )}
                    </div>
                    <button
                        className={styles.modalClose}
                        onClick={handleClose}
                        aria-label="Fechar modal"
                        disabled={isSubmitting || isAssigning}
                    >
                        <FaTimes />
                    </button>
                </div>

                <div className={styles.modalBody}>
                    <div className={styles.clientInfoColumn}>
                       <div className={styles.clientInfo}>
                            <h3 className={styles.sectionTitle}>
                                <FaUser /> Informações do Cliente
                            </h3>
                            <div className={styles.clientLoginContainer}>
                                <div className={styles.clientLogin}>
                                    Login: <strong>{localCliente.login}</strong>
                                </div>
                                {localCliente.assigned_to ? (
                                    <div className={styles.assignedToIndicator}>
                                        Cliente de <strong>{assigneeName}</strong>
                                    </div>
                                ) : (
                                    <div className={styles.assignedToIndicator} style={{backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.2)'}}>
                                        Cliente não atribuído
                                    </div>
                                )}
                                <div className={styles.addressItem}>
                                    <FaMapMarkerAlt />
                                    <div className={styles.addressItem}>
                                    <div>
                                        <span>{localCliente.endereco?.rua || 'N/A'} </span>
                                        <span className={styles.addressNumber}>
                                        {localCliente.endereco?.numero || 'N/A'},
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <span>{localCliente.endereco?.bairro || 'N/A'}  </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.technicalDetails}>
                            <h3 className={styles.sectionTitle}>
                                <FaServer /> Detalhes Técnicos
                            </h3>
                            <div className={styles.detailsGrid}>
                                <div className={styles.detailItem}>
                                    <FaArrowDown />
                                    <strong>RX:</strong>
                                    <span>{localCliente.rx.toFixed(2)}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <FaServer />
                                    <strong>OLT:</strong>
                                    <span>{localCliente.olt}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <FaArrowUp />
                                    <strong>TX:</strong>
                                    <span>{localCliente.tx.toFixed(2)}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <FaSitemap />
                                    <strong>PON:</strong>
                                    <span>{localCliente.ponid}</span>
                                </div>
                            </div>
                        </div>
                    
                        <div className={styles.contactInfo}>
                            <h3 className={styles.sectionTitle}>
                                <FaPhone /> Contatos
                            </h3>
                            <div className={styles.contactGrid}>
                                <div className={styles.contactItem}>
                                    <FaMobile />
                                    <div>
                                        <strong>Celular:</strong>
                                        <span>{localCliente.contatos?.celular || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className={styles.contactItem}>
                                    <FaWhatsapp />
                                    <div>
                                        <strong>WhatsApp:</strong>
                                        <span>{localCliente.contatos?.whatsapp || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className={styles.contactItem}>
                                    <FaPhone />
                                    <div>
                                        <strong>Fixo:</strong>
                                        <span>{localCliente.contatos?.fone || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.commentsColumn}>
                        <div className={styles.commentsContainer}>
                            <CommentSection
                                title="ㅤTentativas de Contato"
                                icon={<FaPhone />}
                                comments={tentativas}
                                onCommentsChange={(c) => { setTentativas(c); setIsDirty(true); }}
                                authorId={user!.id}
                                authorName={authorName}
                                authorAvatar={user?.user_metadata?.avatar_url}
                                canComment={canComment}
                            />
                            <CommentSection
                                title="ㅤResolução"
                                icon={<FaCheckCircle />}
                                comments={resolucao}
                                onCommentsChange={(c) => { setResolucao(c); setIsDirty(true); }}
                                authorId={user!.id}
                                authorName={authorName}
                                authorAvatar={user?.user_metadata?.avatar_url}
                                canComment={canComment}
                            />
                        </div>
                    </div>
                </div>
                {isAdmin && (
                    <div className={styles.adminAssignSection}>
                        <h4 className={styles.assigneeTitle}>
                            <FaUserCheck /> Atribuir Tarefa
                        </h4>
                        <div className={styles.assigneeSelectorWrapper}>
                            <AssigneeSelector
                                users={users}
                                onSelect={handleAdminAssignSelect}
                                currentSelection={localCliente.assigned_to}
                                valueType="id"
                                allowUnassign={true}
                                unassignText="Desatribuir"
                            />
                        </div>
                    </div>
                )}
                <div className={styles.modalFooter}>
                    <div className={styles.statusButtons}>
                        {isEditing ? (
                            <button
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                onClick={() => handleSave('pendente', 'Retorno para pendentes')}
                                disabled={isSubmitting}
                                title="Retorna o contato para a lista de pendentes"
                            >
                                {isSubmitting ?
                                    <><FaSpinner className="fa-spin" /> Processando...</> :
                                    <><FaUndo /> Retornar à Escala</>
                                 }
                            </button>
                        ) : (
                            <>
                                {
                                isUnassigned && !isAdmin && (
                                    <button
                                        className={`${styles.btn} ${styles.btnSecondary}`}
                                        onClick={handleAssignClick}
                                        disabled={isAssigning || isSubmitting}
                                        style={{ marginRight: 'auto' }}
                                        title="Assumir esta tarefa para você"
                                    >
                                        {isAssigning ?
                                            <><FaSpinner className="fa-spin" /> Assumindo...</> :
                                            <><FaUserCheck /> Assumir Tarefa</>
                                        }
                                    </button>
                                )}

                                {statusOptions.map((option) => (
                                    <button
                                        key={option.key}
                                        className={`${styles.btn} ${option.className}`}
                                        onClick={() => handleSave(option.key, option.actionLabel)}
                                        disabled={isSubmitting || isAssigning || !canRegisterAction}
                                        title={!isUnassigned ? (canRegisterAction ? option.description : 'Tarefa atribuída a outro usuário') : 'Você precisa assumir a tarefa primeiro'}
                                    >
                                        {isSubmitting && submitAction === option.actionLabel ?
                                            <><FaSpinner className="fa-spin" /> Processando...</> :
                                            <>{option.icon} {option.label}</>
                                        }
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}