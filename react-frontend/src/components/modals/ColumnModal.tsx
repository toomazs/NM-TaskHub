import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import * as columnService from '../../services/columns';
import { Column } from '../../types/kanban';

export function ColumnModal() {
    const { closeModal, isClosing, modalProps } = useModal();
    const { board, addColumn, updateColumn: updateColumnInContext } = useBoard(); 
    
    const editingColumn = modalProps.column as Column | undefined; 
    const isEditing = !!editingColumn;

    const [title, setTitle] = useState('');
    const [color, setColor] = useState('#333333');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isEditing && editingColumn) {
            setTitle(editingColumn.title);
            setColor(editingColumn.color);
        } else {
            setTitle('');
            setColor('#333333');
        }
    }, [editingColumn, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("O título da coluna é obrigatório.");
            return;
        }
        if (isLoading) return;

        setIsLoading(true);
        const loadingToast = toast.loading(isEditing ? 'Atualizando coluna...' : 'Criando coluna...');

        try {
            if (isEditing && editingColumn) {
                const updatedData = { title, color };
                const updatedColumnResult = await columnService.updateColumn(editingColumn.id, updatedData);
                updateColumnInContext(updatedColumnResult);
                toast.success("Coluna atualizada com sucesso!");
            } else {
                if (!board?.id) throw new Error("ID do quadro não encontrado.");
                
                const newColumnData = { title, color, board_id: board.id };
                const newColumnResult = await columnService.createColumn(newColumnData);
                addColumn(newColumnResult);
                toast.success("Coluna criada com sucesso!");
            }
            closeModal();
        } catch (error: any) {
            toast.error(error.message || "Ocorreu um erro inesperado.");
        } finally {
            toast.dismiss(loadingToast);
            setIsLoading(false);
        }
    };

    return (
        <div className={`modal ${isClosing ? 'closing' : ''}`} onClick={closeModal}>
            <div className="modal-content-private" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={closeModal}><i className="fas fa-times"></i></button>
                <div className="modal-header"><h2><i className="fas fa-columns"></i><span>{isEditing ? 'Editar Coluna' : 'Nova Coluna'}</span></h2></div>
                <div className="modal-body-private" style={{ padding: '2rem' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="columnTitle" className="form-label"><i className="fas fa-heading"></i> Título da Coluna</label>
                            <input 
                                type="text" 
                                id="columnTitle" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                className="form-input" 
                                required 
                                disabled={isLoading}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="columnColor" className="form-label"><i className="fas fa-palette"></i> Cor do Título</label>
                            <input 
                                type="color" 
                                id="columnColor" 
                                value={color} 
                                onChange={e => setColor(e.target.value)} 
                                className="form-input form-input-color" 
                                disabled={isLoading}
                            />
                        </div>
                        <div className="form-actions" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={isLoading}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={isLoading}>
                                {isLoading ? (
                                    <><i className="fas fa-spinner fa-spin"></i> Salvando...</>
                                ) : (
                                    <><i className="fas fa-check-circle"></i> Salvar Coluna</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}