import React, { useState } from 'react';
import toast from 'react-hot-toast';

import { useModal } from '../../contexts/ModalContext';
import * as boardService from '../../services/boards';

export function PrivateBoardModal() {
    const { closeModal, isClosing, modalProps } = useModal();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error("O título do quadro é obrigatório.");
            return;
        }
        if (isLoading) return;

        setIsLoading(true);
        const loadingToast = toast.loading("Criando quadro...");

        try {
            const boardData = {
                title: title.trim(),
                description: description.trim(),
                is_public: false,
                color: '#3498db', 
            };

            await boardService.createBoard(boardData);
            
            toast.success(`Quadro "${boardData.title}" criado com sucesso!`);
            
            if (modalProps.onBoardCreated) {
                modalProps.onBoardCreated();
            }
            
            closeModal();

        } catch (error: any) {
            toast.error(error.message || "Não foi possível criar o quadro.");
        } finally {
            toast.dismiss(loadingToast);
            setIsLoading(false);
        }
    };

     return (
        <div className={`modal ${isClosing ? 'closing' : ''}`} onClick={closeModal}>
            <div className="modal-content stats-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={closeModal} disabled={isLoading}><i className="fas fa-times"></i></button>
                <div className="modal-header"><h2><i className="fas fa-user-lock"></i><span>Novo Quadro Privado</span></h2></div>
                <div className="modal-body" style={{ padding: '2rem' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="boardTitle" className="form-label"><i className="fas fa-heading"></i> Título do Quadro</label>
                            <input 
                                type="text" 
                                id="boardTitle" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                className="form-input" 
                                required 
                                placeholder="Ex: Projetos Pessoais"
                                disabled={isLoading}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="boardDescription" className="form-label"><i className="fas fa-align-left"></i> Descrição (Opcional)</label>
                            <textarea 
                                id="boardDescription" 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                className="form-textarea" 
                                placeholder="Descreva o objetivo deste quadro..." 
                                rows={4}
                                disabled={isLoading}
                            ></textarea>
                        </div>
                        <div className="form-actions" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={isLoading}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={isLoading}>
                                {isLoading ? (
                                    <><i className="fas fa-spinner fa-spin"></i> Salvando...</>
                                ) : (
                                    <><i className="fas fa-check-circle"></i> Salvar Quadro</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}