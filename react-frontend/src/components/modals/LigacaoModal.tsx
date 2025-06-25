import React, { useState, useEffect } from 'react';
import { useModal } from '../../contexts/ModalContext';
import * as ligacaoService from '../../services/ligacoes';
import { Ligacao } from '../../types/kanban';
import toast from 'react-hot-toast';

export function LigacaoModal() {
    const { closeModal, modalProps, isClosing } = useModal();
    const editingLigacao = modalProps.ligacao as Ligacao | undefined;
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
        
        if (isSubmitting) return;
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
                ? await ligacaoService.updateLigacao(editingLigacao!.id, dataToSend)
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
        <div className={`modal ${isClosing ? 'closing' : ''}`} onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '700px'}}>
                <button className="modal-close" onClick={closeModal} disabled={isSubmitting}>
                    <i className="fas fa-times"></i>
                </button>
                
                <div className="modal-header">
                    <h2>
                        <i className="fas fa-network-wired"></i> 
                        {isEditing ? 'Editar Ligação Ativa' : 'Nova Ligação Ativa'}
                    </h2>
                    <p className="modal-subtitle">
                        <i className="fas fa-info-circle"></i>
                        {isEditing ? 'Atualize as informações da ligação ativa' : 'Preencha os dados para criar uma nova ligação ativa'}
                    </p>
                </div>
                
                <div className="modal-body">
                    <form onSubmit={handleSubmit} className="modal-main">
                        <div className="form-section">
                            <div className="section-header">
                                <i className="fas fa-user-tag"></i>
                                <h3>Informações Básicas</h3>
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="name">
                                    <i className="fas fa-signature"></i>
                                    Nome da Ligação Ativa *
                                </label>
                                <input 
                                    id="name"
                                    type="text" 
                                    name="name" 
                                    value={formData.name || ''} 
                                    onChange={handleChange} 
                                    className="form-input" 
                                    required
                                    disabled={isSubmitting}
                                    placeholder="Digite o nome da ligação ativa"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="type">
                                        <i className="fas fa-tags"></i>
                                        Sujeito Ativo
                                    </label>
                                    <select 
                                        id="type"
                                        name="type" 
                                        value={formData.type || 'Condomínio'} 
                                        onChange={handleChange} 
                                        className="form-select"
                                        disabled={isSubmitting}
                                    >
                                        <option value="Condomínio">
                                            <i className="fas fa-building"></i> Condomínio
                                        </option>
                                        <option value="Bairro">
                                            <i className="fas fa-map"></i> Bairro
                                        </option>
                                        <option value="Outros">
                                            <i className="fas fa-ellipsis-h"></i> Outros
                                        </option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="end_date">
                                        <i className="fas fa-calendar-times"></i>
                                        Data Final
                                    </label>
                                    <input 
                                        id="end_date"
                                        type="date" 
                                        name="end_date" 
                                        value={formData.end_date?.split('T')[0] || ''} 
                                        onChange={handleChange} 
                                        className="form-input"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <div className="section-header">
                                <i className="fas fa-map-marker-alt"></i>
                                <h3>Localização e Recursos</h3>
                            </div>

                            <div className="form-group">
                                <label htmlFor="address">
                                    <i className="fas fa-home"></i>
                                    Endereço Completo
                                </label>
                                <input 
                                    id="address"
                                    type="text" 
                                    name="address" 
                                    value={formData.address || ''} 
                                    onChange={handleChange} 
                                    className="form-input"
                                    disabled={isSubmitting}
                                    placeholder="Endereço/Bairro"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="spreadsheet_url">
                                    <i className="fas fa-table"></i>
                                    Link da Planilha
                                </label>
                                <input 
                                    id="spreadsheet_url"
                                    type="url" 
                                    name="spreadsheet_url" 
                                    value={formData.spreadsheet_url || ''} 
                                    onChange={handleChange} 
                                    className="form-input"
                                    disabled={isSubmitting}
                                    placeholder="https://1drv.ms/..."
                                />
                                <div className="input-help">
                                    <i className="fas fa-lightbulb"></i>
                                    Cole aqui o link da planilha do Excel Online ou Google Sheets
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="image">
                                    <i className="fas fa-camera"></i>
                                    Imagem da Ligação Ativa
                                </label>
                                <div className="file-input-wrapper">
                                    <input 
                                        id="image"
                                        type="file" 
                                        onChange={handleImageChange} 
                                        className="form-input file-input"
                                        disabled={isSubmitting}
                                        accept="image/*"
                                    />
                                    <div className="file-input-placeholder">
                                        <i className="fas fa-cloud-upload-alt"></i>
                                        <span>Clique para selecionar uma imagem</span>
                                        <small>PNG, JPG, JPEG até 5MB</small>
                                    </div>
                                </div>
                                {imageFile && (
                                    <div className="file-preview">
                                        <i className="fas fa-image"></i>
                                        <span>{imageFile.name}</span>
                                        <button 
                                            type="button" 
                                            className="file-remove"
                                            onClick={() => setImageFile(null)}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-section">
                            <div className="section-header">
                                <i className="fas fa-sticky-note"></i>
                                <h3>Observações Adicionais</h3>
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="observations">
                                    <i className="fas fa-comment-dots"></i>
                                    Observações e Anotações
                                </label>
                                <textarea 
                                    id="observations"
                                    name="observations" 
                                    value={formData.observations || ''} 
                                    onChange={handleChange} 
                                    className="form-textarea" 
                                    rows={4}
                                    disabled={isSubmitting}
                                    placeholder="Adicione observações importantes, detalhes técnicos, etc.."
                                />
                                <div className="textarea-counter">
                                    <i className="fas fa-text-width"></i>
                                    {(formData.observations || '').length} caracteres
                                </div>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={closeModal}
                                disabled={isSubmitting}
                            >
                                <i className="fas fa-times"></i>
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-primary" 
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin"></i>
                                        {isEditing ? 'Atualizando...' : 'Salvando...'}
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save"></i>
                                        {isEditing ? 'Atualizar' : 'Criar Ligação Ativa'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}