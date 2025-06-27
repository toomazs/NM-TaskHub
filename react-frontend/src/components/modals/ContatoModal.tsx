import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FaTimes, FaUndo, FaClipboardList, FaUser, FaCalendarCheck, FaPhoneSlash,
    FaExclamationTriangle, FaSave, FaServer, FaSitemap, FaFingerprint, FaUserCheck,
    FaUserPlus, FaUserSlash
} from 'react-icons/fa';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import { ClienteSinalAltoComStatus, StatusKey } from '../../types/sinal';

interface ContatoModalProps {
    cliente: ClienteSinalAltoComStatus;
    onSave: (status: StatusKey, resolucao: string) => void;
    onAssign?: (clienteId: string) => void;
    onUnassign?: (clienteId: string) => void;
    isEditing?: boolean;
}

export function ContatoModal() {
    const { closeModal, modalProps, isClosing } = useModal();
    const { cliente, onSave, onAssign, onUnassign, isEditing } = modalProps as ContatoModalProps;
    const { user } = useAuth();

    const [resolucao, setResolucao] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setResolucao(cliente?.anotacao || '');
    }, [cliente]);

    useEffect(() => {
        const originalValue = cliente?.anotacao || '';
        setHasChanges(resolucao !== originalValue);
    }, [resolucao, cliente?.anotacao]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, []);
    
    const handleClose = useCallback(() => {
        if (hasChanges && !isSubmitting) {
            const confirmClose = window.confirm('Você tem alterações não salvas. Deseja realmente fechar?');
            if (!confirmClose) return;
        }
        closeModal();
    }, [hasChanges, isSubmitting, closeModal]);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleClose]);

    const handleModalContentClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
    }, []);

    const handleSave = useCallback(async (status: StatusKey, resolucaoValue: string) => {
        if (!onSave) return;
        setIsSubmitting(true);
        try {
            await onSave(status, resolucaoValue.trim());
            closeModal();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            setIsSubmitting(false);
        }
    }, [onSave, closeModal]);

    const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setResolucao(e.target.value);
    }, []);

    const handleTextareaInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, []);

    const handleAssignClick = () => {
        if (onAssign) {
            onAssign(cliente.id);
        }
    };

    const handleUnassignClick = async () => {
        if (onUnassign) {
            setIsSubmitting(true);
            try {
                await onUnassign(cliente.id);
                closeModal();
            } catch (error) {
                setIsSubmitting(false);
            }
        }
    };

    if (!cliente) return null;

    const isCurrentUserAssigned = user?.id === cliente.assigned_to;

    const statusOptions = [
        { key: 'Agendado O.S.' as StatusKey, label: 'Agendado O.S.', icon: FaCalendarCheck, className: 'btn-primary', description: 'Ordem de serviço foi agendada' },
        { key: 'Nao conseguido contato' as StatusKey, label: 'Não Consegui Contato', icon: FaPhoneSlash, className: 'btn-secondary', description: 'Cliente não atendeu ou não foi localizado' },
        { key: 'Nao solucionado' as StatusKey, label: 'Não Solucionado', icon: FaExclamationTriangle, className: 'btn-danger', description: 'Problema não foi resolvido' }
    ];

    return (
        <div className={`modal contato-modal ${isClosing ? 'closing' : ''}`} onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-content" onClick={handleModalContentClick} style={{ maxWidth: '900px', minHeight: '500px' }}>
                <div className="modal-header">
                    <h2 id="modal-title">
                        <FaClipboardList style={{ color: 'var(--accent-blue)', marginRight: '0.75rem' }} />
                        {isEditing ? 'Editar Status do Cliente' : 'Registrar Ação de Contato'}
                    </h2>
                    <button className="modal-close" onClick={handleClose} aria-label="Fechar modal" disabled={isSubmitting}>
                        <FaTimes />
                    </button>
                </div>
                
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'row', padding: '2rem 2.5rem', flex: 1, gap: '2.5rem' }}>
                    <div className="client-info" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--accent-blue)', flex: '1 1 320px', minWidth: '300px' }}>
                        
                        {!cliente.assigned_to && onAssign && !isEditing && (
                            <button className="btn btn-secondary assign-button" onClick={handleAssignClick} style={{width: '100%', marginBottom: '1rem'}}>
                                <FaUserPlus /> Assumir Tarefa
                            </button>
                        )}
                        
                        <p style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '1.1rem', fontWeight: '500', gap: '0.75rem' }}>
                            <FaUser style={{ color: 'var(--accent-blue)', fontSize: '1rem' }} />
                            Cliente: <strong style={{ marginLeft: '0.5rem', color: 'var(--text-primary)' }}>{cliente.login}</strong>
                        </p>
                        
                        <div className="client-status-details" style={{ marginTop: '0.75rem', paddingLeft: 'calc(1rem + 0.75rem)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                           {cliente.status && (
                               <span style={{ color: 'var(--text-secondary)' }}>Status atual: <strong style={{ color: 'var(--text-primary)' }}>{cliente.status}</strong></span>
                           )}
                           {cliente.assigned_to_name && (
                               <span className="assigned-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-green)', fontWeight: '500' }}>
                                   <FaUserCheck /> Assumido por: <strong style={{ color: 'var(--accent-green)' }}>{cliente.assigned_to_name}</strong>
                               </span>
                           )}
                        </div>

                        <div className="client-extra-details">
                            <div className="detail-item"><i className="fa-solid fa-user"></i><span>ID:</span><strong>{cliente.id}</strong></div>
                            <div className="detail-item"><FaServer /><span>OLT:</span><strong>{cliente.olt}</strong></div>
                            <div className="detail-item"><FaSitemap /><span>PON:</span><strong>{cliente.ponid}</strong></div>
                            <div className="detail-item"><FaFingerprint /><span>MAC:</span><strong>{cliente.mac && cliente.mac.trim() ? cliente.mac : 'N/A'}</strong></div>
                            <div className="detail-item"><i className="fa-solid fa-arrow-down"></i><span>Sinal RX:</span><strong>{cliente.rx}</strong></div>
                            <div className="detail-item"><i className="fa-solid fa-arrow-up"></i><span>Sinal TX:</span><strong>{cliente.tx}</strong></div>
                        </div>
                    </div>

                    <div className="form-group" style={{ flex: '2 1 0%', display: 'flex', flexDirection: 'column' }}>
                        <label htmlFor="resolucao" className="form-label" style={{ display: 'block', marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '500' }}>
                            Anotação / Resolução
                        </label>
                        <textarea ref={textareaRef} id="resolucao" className="form-textarea" placeholder="Cole a O.S., observações importantes ou tentativas de contato..." value={resolucao} onChange={handleTextareaChange} onInput={handleTextareaInput} disabled={isSubmitting} style={{ flexGrow: 1, resize: 'none', fontFamily: 'inherit', padding: '1.25rem', fontSize: '0.95rem', lineHeight: '1.5' }} aria-describedby="resolucao-help" />
                        <small id="resolucao-help" className="help-text" style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            Esta anotação será salva junto com o status.
                        </small>
                    </div>
                </div>
                
                <div className="modal-footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem 2.5rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                    <div className="footer-actions" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                        <div>
                        {isCurrentUserAssigned && (
                            <button className="btn btn-danger" onClick={handleUnassignClick} disabled={isSubmitting}>
                                <FaUserSlash /> 
                            </button>
                        )}
                        </div>

                        <div className="status-buttons" style={{display: 'flex', gap: '1rem'}}>
                            {isEditing ? (
                                <button className="btn btn-secondary" onClick={() => handleSave('pendente', resolucao)} disabled={isSubmitting}>
                                    <FaUndo /> Salvar e Retornar para Pendentes
                                </button>
                            ) : (
                                statusOptions.map((option) => (
                                    <button 
                                        key={option.key} 
                                        className={`btn ${option.className}`} 
                                        onClick={() => handleSave(option.key, resolucao)} 
                                        disabled={isSubmitting || (!!cliente.assigned_to && !isCurrentUserAssigned)} 
                                        title={!!cliente.assigned_to && !isCurrentUserAssigned ? 'Tarefa já assumida por outro usuário' : option.description}
                                    >
                                        <option.icon />
                                        {option.label}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                    
                    {hasChanges && !isSubmitting && (
                        <div style={{ marginTop: '1rem', padding: '1rem 1.25rem', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', fontSize: '0.9rem', color: '#92400e', textAlign: 'center' }} className="changes-alert">
                            <FaSave style={{ marginRight: '0.75rem' }} />
                            Você tem anotações não salvas. Elas serão salvas ao definir um status.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}