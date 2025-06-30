import React, { useState, useEffect } from 'react';
import { useModal } from '../../contexts/ModalContext';
import * as ligacaoService from '../../services/ligacoes';
import { Ligacao } from '../../types/kanban';
import toast from 'react-hot-toast';
import styles from './LigacaoModal.module.css';

export function LigacaoModal() {
    const { closeModal, modalProps, isClosing } = useModal();
    const { ligacao: editingLigacao, isReadOnly } = modalProps;
    const isEditing = !!editingLigacao;

    const [formData, setFormData] = useState<Partial<Ligacao>>({});
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const initialData: Partial<Ligacao> = isEditing 
            ? editingLigacao 
            : { type: 'Condomínio', status: 'Ativo' };
        setFormData(initialData);
    }, [editingLigacao, isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setImageFile(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isSubmitting || isReadOnly) return;
        setIsSubmitting(true);

        const dataToSend: Partial<Ligacao> = { ...formData };
        
        if (!dataToSend.spreadsheet_url) dataToSend.spreadsheet_url = undefined;
        if (!dataToSend.address) dataToSend.address = undefined;
        if (!dataToSend.observations) dataToSend.observations = undefined;
        
        if (!dataToSend.end_date) {
            (dataToSend as any).end_date = null;
        } else {
            (dataToSend as any).end_date = new Date(dataToSend.end_date).toISOString();
        }

        const toastId = toast.loading(isEditing ? 'Atualizando ligação ativa...' : 'Criando ligação ativa...');
        
        try {
            const savedLigacao = isEditing
                ? await ligacaoService.updateLigacao((editingLigacao as Ligacao).id, dataToSend)
                : await ligacaoService.createLigacao(dataToSend);
            
            if (imageFile) {
                const uploadFormData = new FormData();
                uploadFormData.append('image', imageFile);
                await ligacaoService.uploadLigacaoImage(savedLigacao.id, uploadFormData);
            }
            
            toast.success(isEditing ? 'Ligação ativa atualizada!' : 'Ligação ativa criada!', { id: toastId });
            modalProps.onSave();
            closeModal();
        } catch (error) {
            console.error('Erro ao salvar ligação ativa:', error);
            toast.error('Erro ao salvar ligação ativa. Tente novamente.', { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={closeModal}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <button className={styles.modalClose} onClick={closeModal} disabled={isSubmitting}>
                    <i className="fas fa-times"></i>
                </button>
                
                <div className={styles.modalHeader}>
                    <h2>
                        <i className="fas fa-network-wired"></i> 
                        {isReadOnly ? 'Visualizar Ligação' : (isEditing ? 'Editar Ligação Ativa' : 'Nova Ligação Ativa')}
                    </h2>          
                </div>
                
                <div className={styles.modalBody}>
                    <form onSubmit={handleSubmit} className={styles.modalMain}>
                        <div className={styles.formSection}>
                            <div className={styles.formGroup}>
                                <label htmlFor="name" className={styles.formLabel}><i className="fas fa-signature"></i> Nome da Ligação Ativa *</label>
                                <input 
                                    id="name" type="text" name="name" value={formData.name || ''} 
                                    onChange={handleChange} className={styles.formInput} required autoFocus
                                    disabled={isSubmitting || isReadOnly}
                                    placeholder="Digite o nome da ligação ativa"
                                />
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="type" className={styles.formLabel}><i className="fas fa-tags"></i> Sujeito Ativo</label>
                                    <select id="type" name="type" value={formData.type || 'Condomínio'} 
                                        onChange={handleChange} className={styles.formSelect} disabled={isSubmitting || isReadOnly}>
                                        <option value="Condomínio">Condomínio</option><option value="Bairro">Bairro</option><option value="Outros">Outros</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="end_date" className={styles.formLabel}><i className="fas fa-calendar-times"></i> Data Final</label>
                                    <input id="end_date" type="date" name="end_date" value={formData.end_date?.split('T')[0] || ''} 
                                        onChange={handleChange} className={styles.formInput} disabled={isSubmitting || isReadOnly}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className={styles.formSection}>
                            <div className={styles.formGroup}>
                                <label htmlFor="address" className={styles.formLabel}><i className="fas fa-home"></i> Endereço Completo</label>
                                <input id="address" type="text" name="address" value={formData.address || ''} 
                                    onChange={handleChange} className={styles.formInput} disabled={isSubmitting || isReadOnly} placeholder="Endereço/Bairro"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="spreadsheet_url" className={styles.formLabel}><i className="fas fa-table"></i> Link da Planilha</label>
                                <input id="spreadsheet_url" type="url" name="spreadsheet_url" value={formData.spreadsheet_url || ''} 
                                    onChange={handleChange} className={styles.formInput} disabled={isSubmitting || isReadOnly} placeholder="https://1drv.ms/..."
                                />
                                <div className={styles.inputHelp}><i className="fas fa-lightbulb"></i> Cole aqui o link da planilha do Excel Online ou Google Sheets</div>
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="image" className={styles.formLabel}><i className="fas fa-camera"></i> Imagem da Ligação Ativa</label>
                                <div className={styles.fileInputWrapper}>
                                    <input id="image" type="file" onChange={handleImageChange} className={styles.fileInput} disabled={isSubmitting || isReadOnly} accept="image/*"/>
                                    <div className={styles.fileInputPlaceholder}>
                                        <i className="fas fa-cloud-upload-alt"></i><span>Clique para selecionar uma imagem</span><small>PNG, JPG, JPEG até 5MB</small>
                                    </div>
                                </div>
                                {imageFile && <div className={styles.filePreview}><i className="fas fa-image"></i><span>{imageFile.name}</span><button type="button" className={styles.fileRemove} onClick={() => setImageFile(null)}><i className="fas fa-times"></i></button></div>}
                            </div>
                        </div>
                        <div className={styles.formSection}>
                            <div className={styles.formGroup}>
                                <label htmlFor="observations" className={styles.formLabel}><i className="fas fa-comment-dots"></i> Observações e Anotações</label>
                                <textarea id="observations" name="observations" value={formData.observations || ''} onChange={handleChange} 
                                    className={styles.formTextarea} rows={4} disabled={isSubmitting || isReadOnly} placeholder="Adicione observações importantes, detalhes técnicos, etc.."/>
                                <div className={styles.textareaCounter}><i className="fas fa-text-width"></i>{(formData.observations || '').length} caracteres</div>
                            </div>
                        </div>
                        {!isReadOnly && (
                            <div className={styles.formActions}>
                                <button type="button" className={`btn ${styles.btnSecondary}`} onClick={closeModal} disabled={isSubmitting}>
                                    <i className="fas fa-times"></i> Cancelar
                                </button>
                                <button type="submit" className={`btn ${styles.btnPrimary}`} disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <><i className={`fas fa-spinner ${styles.faSpin}`}></i>{isEditing ? 'Atualizando...' : 'Salvando...'}</>
                                    ) : (
                                        <><i className="fas fa-save"></i>{isEditing ? 'Atualizar' : 'Criar Ligação Ativa'}</>
                                    )}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}