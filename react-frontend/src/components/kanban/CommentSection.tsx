import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Comment } from '../../types/kanban';
import { useBoard } from '../../contexts/BoardContext';
import { userDisplayNameMap } from '../../api/config';

interface CommentSectionProps {
  title: string;
  icon: string;
  comments: Comment[];
  onCommentsChange: (newComments: Comment[]) => void;
  authorName: string; 
}

export function CommentSection({ title, icon, comments, onCommentsChange, authorName }: CommentSectionProps) {
    const [isInputVisible, setInputVisible] = useState(false);
    const [newCommentText, setNewCommentText] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');

    const { users, boardMembers, board } = useBoard();

    const handleAddComment = () => {
        if (!newCommentText.trim()) return;
        const newComment: Comment = {
            text: newCommentText,
            author: authorName,
            timestamp: new Date().toLocaleString('pt-BR'),
        };
        onCommentsChange([...(comments || []), newComment]);
        setNewCommentText('');
        setInputVisible(false);
    };

    const handleDeleteComment = (indexToDelete: number) => {
        toast((t) => (
            <span>
                Excluir este comentário?
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <button className="btn btn-danger" style={{flex: 1}} onClick={() => {
                        onCommentsChange(comments.filter((_, index) => index !== indexToDelete));
                        toast.dismiss(t.id);
                        toast.success("Comentário removido.");
                    }}>Sim</button>
                    <button className="btn btn-secondary" style={{flex: 1}} onClick={() => toast.dismiss(t.id)}>Não</button>
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
            index === editingIndex ? { ...comment, text: editingText } : comment
        );
        onCommentsChange(updatedComments);
        handleCancelEditing();
        toast.success("Comentário atualizado.");
    };

    return (
        <div className="comment-section">
            <div className="comment-header">
                <div className="comment-title"><i className={`fas ${icon}`}></i><span>{title}</span></div>
                <button type="button" className="add-comment-btn" onClick={() => setInputVisible(s => !s)}><i className="fas fa-plus"></i></button>
            </div>
            <div className="comments-list">
                {comments && comments.map((comment, index) => {
                    const authorUser = (board?.is_public ? users : boardMembers).find(u => (userDisplayNameMap[u.email] || u.username) === comment.author);
                    const canEdit = comment.author === authorName; 

                    if (editingIndex === index && canEdit) {
                        return (
                            <div key={index} className="comment-edit-container">
                                <textarea className="comment-edit-textarea" value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3}></textarea>
                                <div className="comment-actions">
                                    <button type="button" className="btn-save" onClick={handleSaveEdit}><i className="fas fa-check"></i> Salvar</button>
                                    <button type="button" className="btn-cancel" onClick={handleCancelEditing}><i className="fas fa-times"></i></button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={index} className="comment-item">
                            <div className="comment-content">{comment.text}</div>
                            <div className="comment-meta">
                                <span className="comment-author">
                                    <div className="comment-avatar" style={{ backgroundImage: authorUser?.avatar ? `url(${authorUser.avatar})` : 'none' }}>
                                        {!authorUser?.avatar && comment.author.charAt(0).toUpperCase()}
                                    </div>
                                    {comment.author}
                                </span>
                                <span className="comment-timestamp">{comment.timestamp}</span>
                            </div>
                            {canEdit && (
                                <div className="comment-item-actions">
                                    <button className="edit-comment-btn" onClick={() => handleStartEditing(index, comment.text)} title="Editar Comentário"><i className="fas fa-pencil-alt"></i></button>
                                    <button className="delete-comment-btn" onClick={() => handleDeleteComment(index)} title="Excluir Comentário"><i className="fas fa-trash"></i></button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {isInputVisible && (
                <div className="comment-input-container" style={{display: 'block'}}>
                    <textarea placeholder={`Adicionar ${title.toLowerCase()}...`} rows={3} value={newCommentText} onChange={e => setNewCommentText(e.target.value)}></textarea>
                    <div className="comment-actions">
                        <button type="button" className="btn-save" onClick={handleAddComment}><i className="fas fa-check"></i> Salvar</button>
                        <button type="button" className="btn-cancel" onClick={() => setInputVisible(false)}><i className="fas fa-times"></i></button>
                    </div>
                </div>
            )}
        </div>
    );
}