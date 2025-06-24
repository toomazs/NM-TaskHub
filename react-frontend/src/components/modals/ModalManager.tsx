import { useModal } from '../../contexts/ModalContext';
import { TaskModal } from './TaskModal';
import { PrivateBoardModal } from './PrivateBoardModal';
import { InviteUserModal } from './InviteUserModal';
import { ManageMembersModal } from './ManageMembersModal';
import { StatsModal } from './StatsModal';
import { ColumnModal } from './ColumnModal';

const modalComponents = {
    task: TaskModal,
    privateBoard: PrivateBoardModal,
    inviteUser: InviteUserModal,
    manageMembers: ManageMembersModal,
    stats: StatsModal,
    column: ColumnModal,
};

export function ModalManager() {
    const { isModalOpen, modalType } = useModal();
    
    if (!isModalOpen || !modalType) {
        return null;
    }

    const SpecificModal = modalComponents[modalType];
    
    return SpecificModal ? <SpecificModal /> : null;
}