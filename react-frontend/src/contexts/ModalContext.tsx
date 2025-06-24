import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Card } from '../types/kanban';

type ModalType = 'task' | 'privateBoard' | 'inviteUser' | 'manageMembers' | 'stats' | 'column';

interface ModalContextType {
  isModalOpen: boolean;
  isClosing: boolean; 
  modalType: ModalType | null;
  modalProps: any; 
  openModal: (type: ModalType, props?: any) => void;
  closeModal: () => void;
  editingCard: Card | null;
  currentColumnId: number | null;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [modalProps, setModalProps] = useState<any>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [currentColumnId, setCurrentColumnId] = useState<number | null>(null);

  const openModal = (type: ModalType, props: any = {}) => {
    setIsClosing(false); 
    setModalType(type);
    setModalProps(props);
    
    if (type === 'task') {
        setEditingCard(props.card || null);
        setCurrentColumnId(props.columnId || null);
    }

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
        setIsModalOpen(false);
        setIsClosing(false);
        setModalType(null);
        setModalProps(null);
        setEditingCard(null);
        setCurrentColumnId(null);
    }, 300);
  };

  const value = { isModalOpen, isClosing, modalType, modalProps, openModal, closeModal, editingCard, currentColumnId };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};