import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import { useModal } from '../../contexts/ModalContext';
import { useBoard } from '../../contexts/BoardContext';
import * as columnService from '../../services/columns';
import { Column } from '../../types/kanban';
import styles from './ColumnModal.module.css';

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
        <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={closeModal}>
            <div className={styles.modalContentPrivate} onClick={e => e.stopPropagation()}>
                <button className={styles.modalClose} onClick={closeModal}><i className="fas fa-times"></i></button>
                <div className={styles.modalHeader}><h2><i className="fas fa-columns"></i><span>{isEditing ? 'Editar Coluna' : 'Nova Coluna'}</span></h2></div>
                <div className={styles.modalBodyPrivate}>
                    <form onSubmit={handleSubmit} style={{width: '100%'}}>
                        <div className={styles.formGroup}>
                            <label htmlFor="columnTitle" className={styles.formLabel}><i className="fas fa-heading"></i> Título da Coluna</label>
                            <input 
                                type="text" 
                                id="columnTitle" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                className={styles.formInput}
                                required 
                                autoFocus
                                disabled={isLoading}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="columnColor" className={styles.formLabel}><i className="fas fa-palette"></i> Cor do Título</label>
                            <input 
                                type="color" 
                                id="columnColor" 
                                value={color} 
                                onChange={e => setColor(e.target.value)} 
                                className={styles.formInput}
                                disabled={isLoading}
                            />
                        </div>
                        <div className={styles.formActions}>
                            <button type="button" className={`btn ${styles.btnSecondary}`} onClick={closeModal} disabled={isLoading}>
                                Cancelar
                            </button>
                            <button type="submit" className={`btn ${styles.btnPrimary}`} disabled={isLoading}>
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