// src/components/Sidebar.tsx

import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { useLayout } from '../../contexts/LayoutContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { userDisplayNameMap, userRoleMap } from '../../api/config';
import * as authService from '../../services/auth';
import * as userService from '../../services/users';
import logo from '/img/nmlogo.png';
import { NotificationsDropdown } from './NotificationsDropdown';

export function Sidebar() {
  const { user, updateUser } = useAuth();
  const { isSidebarCollapsed, toggleSidebar } = useLayout();
  const { unreadCount, markAllAsRead } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);
  const avatarUploadRef = useRef<HTMLInputElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        if (showNotifications && unreadCount > 0) {
            markAllAsRead();
        }
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications, notificationsRef, unreadCount, markAllAsRead]);

  const handleLogout = async () => {
    await authService.signOut();
    navigate('/login');
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading("Enviando avatar...");
    const formData = new FormData();
    formData.append("avatar", file);

    try {
        const result = await userService.uploadAvatar(formData);
        if (user) {
            const updatedUser = {
                ...user,
                user_metadata: {
                    ...user.user_metadata,
                    avatar_url: `${result.avatar_url}?t=${new Date().getTime()}`
                }
            };
            updateUser(updatedUser);
            toast.success("Avatar atualizado!");
        }
    } catch (error) {
        toast.error("Falha no upload do avatar.");
    } finally {
        toast.dismiss(loadingToast);
    }
  };

  const displayName = user?.email ? (userDisplayNameMap[user.email] || user.email) : 'Usuário';
  const userRole = user?.email ? (userRoleMap[user.email] || 'Colaborador') : 'Colaborador';
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div id="sidebar" className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
            <div className="sidebar-header-top">
                {!isSidebarCollapsed && (
                    <div className="sidebar-logo">
                        <img src={logo} alt="Logo N-Multifibra" />
                    </div>
                )}
            </div>
            
            <div className="sidebar-header-actions">
                <div className="invitations-bell-container" ref={notificationsRef}>
                    <button id="notificationsBell" className="sidebar-action-btn" onClick={() => setShowNotifications(s => !s)}>
                        <i className="fas fa-bell"></i>
                        {unreadCount > 0 && (
                            <span className="invitations-count">{unreadCount}</span>
                        )}
                    </button>
                    {showNotifications && <NotificationsDropdown />}
                </div>

                <button
                    id="toggleSidebar"
                    className="sidebar-action-btn"
                    onClick={toggleSidebar}
                    title={isSidebarCollapsed ? "Expandir" : "Recolher"}
                >
                    {isSidebarCollapsed ? <i className="fas fa-chevron-right"></i> : <i className="fas fa-chevron-left"></i>}
                </button>
            </div>
        </div>

        <nav className="sidebar-nav">
            <ul className="nav-list">
                <li title="Kanban">
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} >
                        <i className="fas fa-headset"></i>
                        {!isSidebarCollapsed && <span>Kanban</span>}
                    </NavLink>
                </li>
                <li title="Quadros Privados">
                    <NavLink
                        to="/private-boards"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        <i className="fas fa-user-lock"></i>
                        {!isSidebarCollapsed && <span>Quadros Privados</span>}
                    </NavLink>
                </li>
                <li title="Ligações Ativas">
                    <NavLink
                        to="/ligacoes"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        <i className="fas fa-phone-volume"></i>
                        {!isSidebarCollapsed && <span>Ligações Ativas</span>}
                    </NavLink>
                </li>
                <li title="Avaliações Negativas">
                    <NavLink
                        to="/avaliacoes"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        <i className="fas fa-star-half-alt"></i>
                        {!isSidebarCollapsed && <span>Avaliações Negativas</span>}
                    </NavLink>
                </li>
                <li title="Dashboard">
                    <NavLink
                        to="/dashboard"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        <i className="fas fa-chart-line"></i>
                        {!isSidebarCollapsed && <span>Dashboard</span>}
                    </NavLink>
                </li>
                <li title="Agenda Diária">
                    <NavLink
                        to="/agenda"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        <i className="fas fa-calendar-day"></i>
                        {!isSidebarCollapsed && <span>Agenda Diária</span>}
                    </NavLink>
                </li>
                <li title="Sinais Atenuados">
                    <NavLink
                        to="/contatos-preventivos"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        <i className="fa-solid fa-house-signal"></i>
                        {!isSidebarCollapsed && <span>Sinais Atenuados</span>}
                    </NavLink>
                </li>
            </ul>
        </nav>
        <div className="sidebar-footer">
            <div className="sidebar-user">
                <div className="avatar-container" onClick={() => avatarUploadRef.current?.click()} title="Trocar foto">
                    <div className="user-avatar" style={{ backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none' }}>
                        {!avatarUrl && avatarInitial}
                    </div>
                    <div className="avatar-upload-label">
                        <i className="fas fa-camera"></i>
                    </div>
                    <input ref={avatarUploadRef} type="file" onChange={handleAvatarChange} accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} />
                </div>
                {!isSidebarCollapsed && (
                    <div className="user-info">
                        <div className="user-name">{displayName}</div>
                        <div className="user-role">{userRole}</div>
                    </div>
                )}
            </div>
            <button className="btn-logout-sidebar" onClick={handleLogout} title="Sair">
                <i className="fas fa-sign-out-alt"></i>
                {!isSidebarCollapsed && <span>Sair</span>}
            </button>
        </div>
    </div>
  );
}