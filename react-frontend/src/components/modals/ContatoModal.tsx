import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FaTimes, FaUndo, FaClipboardList, FaUser, FaCalendarCheck, FaPhoneSlash,
    FaExclamationTriangle, FaSave, FaUserCheck, FaUserPlus, FaServer, 
    FaSitemap, FaFingerprint, FaSpinner, FaTasks,
    FaArrowDown, FaArrowUp
} from 'react-icons/fa';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import { useBoard } from '../../contexts/BoardContext';
import { ClienteSinalAltoComStatus, StatusKey } from '../../types/sinal';
import { AssigneeSelector } from '../kanban/AssigneeSelector';
import toast from 'react-hot-toast';
import styles from './ContatoModal.module.css';

interface ContatoModalProps {
    cliente: ClienteSinalAltoComStatus;
    onSave: (clienteId: string, status: StatusKey, resolucao: string) => void;
    onAssign?: (clienteId: string) => void;
    onUnassign?: (clienteId: string) => void;
    onAdminAssign?: (clienteId: string, assigneeId: string) => void;
    isEditing?: boolean;
}

export function ContatoModal() {
    const { closeModal, modalProps, isClosing } = useModal();
    const { cliente, onSave, onAssign, onUnassign, onAdminAssign, isEditing } = modalProps as ContatoModalProps;
    const { user } = useAuth();
    const { users } = useBoard();

    const [resolucao, setResolucao] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [submitAction, setSubmitAction] = useState<string>('');
    const [characterCount, setCharacterCount] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setResolucao(cliente?.anotacao || '');
        setCharacterCount((cliente?.anotacao || '').length);
    }, [cliente]);

    useEffect(() => {
        const originalValue = cliente?.anotacao || '';
        setHasChanges(resolucao !== originalValue);
        setCharacterCount(resolucao.length);
    }, [resolucao, cliente?.anotacao]);

    useEffect(() => {
        if (textareaRef.current) {
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    }, []);

    const handleClose = useCallback(() => {
        if (hasChanges && !isSubmitting) {
            if (!window.confirm('Você tem alterações não salvas. Deseja realmente fechar?')) return;
        }
        closeModal();
    }, [closeModal, hasChanges, isSubmitting]);

    const handleModalContentClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

    const handleSave = useCallback(async (status: StatusKey, resolucaoValue: string, actionLabel: string) => {
        if (!onSave) return;
        setIsSubmitting(true);
        setSubmitAction(actionLabel);
        try {
            await onSave(cliente.id, status, resolucaoValue.trim());
            toast.success(`${actionLabel} realizada com sucesso!`, { duration: 3000, icon: '✅' });
            setTimeout(() => closeModal(), 500);
        } catch (error) {
            console.error('Erro ao salvar:', error);
            toast.error(`Erro ao ${actionLabel.toLowerCase()}. Tente novamente.`);
            setIsSubmitting(false);
            setSubmitAction('');
        }
    }, [onSave, closeModal, cliente.id]);
    
    const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => setResolucao(e.target.value), []);

    const handleAssignClick = () => {
        if (onAssign) onAssign(cliente.id);
        closeModal();
    };
    
    const handleAdminAssignSelect = async (selectedValue: string | null) => {
        const loadingToast = toast.loading("Processando atribuição...");
        try {
            if (selectedValue === null) {
                if (onUnassign) {
                    await onUnassign(cliente.id);
                    toast.success("Tarefa desatribuída!", { id: loadingToast });
                }
            } else {
                if (onAdminAssign) {
                    await onAdminAssign(cliente.id, selectedValue);
                    toast.success("Tarefa atribuída!", { id: loadingToast });
                }
            }
            setTimeout(() => closeModal(), 500);
        } catch (error: any) {
            toast.error(error.message || "Falha ao processar a atribuição.", { id: loadingToast });
        }
    };

    const getFormattedStatus = (status: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
            'pendente': { label: 'Pendente', color: '#f59e0b' },
            'Agendado O.S.': { label: 'O.S. Agendada', color: '#10b981' },
            'Nao conseguido contato': { label: 'Sem Contato', color: '#ef4444' },
            'Nao solucionado': { label: 'Não Solucionado', color: '#ef4444' },
        };
        return statusMap[status] || { label: status, color: '#6b7280' };
    };

    if (!cliente) return null;

    const isCurrentUserAssigned = user?.id === cliente.assigned_to;
    const isAdmin = user?.user_metadata?.is_admin;
    const canTakeAction = isCurrentUserAssigned || isAdmin || !cliente.assigned_to;
    const formattedStatus = getFormattedStatus(cliente.status);

    const statusOptions = [
        { key: 'Agendado O.S.' as StatusKey, label: 'Agendado O.S.', icon: FaCalendarCheck, className: styles.btnPrimary, description: 'Ordem de serviço foi agendada', actionLabel: 'Agendamento de O.S.' },
        { key: 'Nao conseguido contato' as StatusKey, label: 'Não Consegui Contato', icon: FaPhoneSlash, className: styles.btnSecondary, description: 'Cliente não atendeu ou não foi localizado', actionLabel: 'Registro de tentativa de contato' },
        { key: 'Nao solucionado' as StatusKey, label: 'Não Solucionado', icon: FaExclamationTriangle, className: styles.btnDanger, description: 'Problema não foi resolvido', actionLabel: 'Marcação como não solucionado' }
    ];

    return (
        <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={styles.modalContent} onClick={handleModalContentClick}>
                <div className={styles.modalHeader}>
                    <h2 id="modal-title"><FaClipboardList />{isEditing ? 'Editar Status do Cliente' : 'Registrar Ação de Contato'}</h2>
                    <button className={styles.modalClose} onClick={handleClose} aria-label="Fechar modal" disabled={isSubmitting}><FaTimes /></button>
                </div>

                <div className={styles.modalBody}>
                    <div className={styles.infoAndActionsColumn}>
                        <div className={styles.clientInfo}>
                            <h3 className={styles.sectionTitle}><FaUser /> Informações do Cliente</h3>
                            <div className={styles.clientPrimaryInfo}>
                                <div className={styles.clientLogin}>Login: <strong>{cliente.login}</strong></div>
                                <div className={styles.clientStatus} style={{ '--status-color': formattedStatus.color } as React.CSSProperties}>
                                    <FaTasks />
                                    <span>{formattedStatus.label}</span>
                                </div>
                            </div>
                            
                            <div className={styles.assigneeInfo}>
                                {cliente.assigned_to_name ? (
                                    <div className={styles.assignedBadge}>
                                        <div className={styles.assigneeAvatar}>
                                            {cliente.assigned_to_avatar ? (
                                                <img 
                                                    src={cliente.assigned_to_avatar} 
                                                    alt={cliente.assigned_to_name}
                                                    className={styles.assigneeAvatarImage}
                                                />
                                            ) : (
                                                <span className={styles.assigneeAvatarInitial}>
                                                    {cliente.assigned_to_name.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.assigneeText}>
                                            Atribuído a
                                            <strong>{cliente.assigned_to_name}</strong>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.unassignedBadge}><FaUserPlus /><span>Não atribuído</span></div>
                                )}
                            </div>
                        </div>

                        <div className={styles.technicalDetails}>
                             <h3 className={styles.sectionTitle}><FaServer /> Detalhes Técnicos</h3>
                             <div className={styles.detailsGrid}>
                                <div className={styles.detailItem}><FaArrowDown /><strong>RX:</strong><span>{cliente.rx ? cliente.rx.toFixed(2) : 'N/A'} dBm</span></div>
                                <div className={styles.detailItem}><FaArrowUp /><strong>TX:</strong><span>{cliente.tx ? cliente.tx.toFixed(2) : 'N/A'} dBm</span></div>
                                <div className={styles.detailItem}><FaServer /><strong>OLT:</strong><span>{cliente.olt}</span></div>
                                <div className={styles.detailItem}><FaSitemap /><strong>PON:</strong><span>{cliente.ponid}</span></div>
                                <div className={`${styles.detailItem} ${styles.fullWidth}`}><FaFingerprint /><strong>ID:</strong><span>{cliente.id}</span></div>
                             </div>
                        </div>
                    </div>

                    <div className={styles.formSection}>
                        <label htmlFor="resolucao" className={styles.formLabel}>Anotação / Resolução</label>
                        <textarea
                            ref={textareaRef}
                            id="resolucao"
                            className={styles.formTextarea}
                            placeholder="Cole a O.S., observações importantes ou tentativas de contato..."
                            value={resolucao}
                            onChange={handleTextareaChange}
                            disabled={isSubmitting}
                            maxLength={2000}
                        />
                        <div className={styles.textareaFooter}>
                            <small className={styles.helpText}>Esta anotação será salva junto com o status.</small>
                            <small className={styles.characterCount} style={{ color: characterCount > 1800 ? '#ef4444' : 'var(--text-secondary)' }}>
                                {characterCount}/2000
                            </small>
                        </div>
                    </div>
                </div>

                {isAdmin && (
                    <div className={styles.adminAssignSectionHorizontal}>
                        <h4 className={styles.assigneeTitle}><FaUserCheck /> Atribuir Tarefa</h4>
                        <AssigneeSelector users={users} onSelect={handleAdminAssignSelect} currentSelection={cliente.assigned_to} valueType="id" allowUnassign={true} unassignText="Desatribuir" />
                    </div>
                )}

                <div className={styles.modalFooter}>
                    <div className={styles.footerActions}>
                        <div className={styles.statusButtons}>
                            {!cliente.assigned_to && !isAdmin && onAssign && (
                                <button className={`${styles.btn} ${styles.assignButton}`} onClick={handleAssignClick} disabled={isSubmitting}><FaUserPlus /> Assumir Tarefa</button>
                            )}

                            {isEditing ? (
                                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => handleSave('pendente', resolucao, 'Retorno para pendentes')} disabled={isSubmitting}>
                                    {isSubmitting && submitAction === 'Retorno para pendentes' ? <><FaSpinner className="fa-spin" /> Processando...</> : <><FaUndo /> Salvar e Retornar</>}
                                </button>
                            ) : (
                                statusOptions.map((option) => (
                                    <button key={option.key} className={`${styles.btn} ${option.className}`} onClick={() => handleSave(option.key, resolucao, option.actionLabel)} disabled={isSubmitting || !canTakeAction} title={!canTakeAction ? 'Tarefa já assumida por outro usuário' : option.description}>
                                        {isSubmitting && submitAction === option.actionLabel ? <><FaSpinner className="fa-spin" /> Processando...</> : <><option.icon /> {option.label}</>}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                    
                    {hasChanges && !isSubmitting && (
                        <div className={styles.changesAlert}><FaSave />Anotações não salvas serão guardadas ao definir um status.</div>
                    )}
                    
                    {isSubmitting && (
                        <div className={styles.submittingIndicator}><FaSpinner className="fa-spin" /> Processando {submitAction.toLowerCase()}...</div>
                    )}
                </div>
            </div>
        </div>
    );
}