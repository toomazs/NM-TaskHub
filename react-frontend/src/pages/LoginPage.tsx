import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import * as authService from '../services/auth';
import { useAuth } from '../contexts/AuthContext';
import logo from '/img/nmlogo.png'; 
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { user, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.body.classList.add(styles.loginPage);
    return () => {
      document.body.classList.remove(styles.loginPage);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      await authService.signIn(email, password);
    } catch (error: any) {
      const errorMessage = error.message || 'Falha no login. Verifique suas credenciais.';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return null; 
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.loginSection}>
      <div className={styles.loginContainer}>
        <form onSubmit={handleLogin} className={styles.loginForm}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <img src={logo} alt="Logo N-MULTIFIBRA" style={{ width: '200px' }} />
            </div>
            <div className={styles.formGroup2}>
              <label htmlFor="email">Email</label>
              <input 
                type="email" 
                id="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                placeholder="seu@email.com" 
                disabled={isSubmitting}
              />
            </div>
            <div className={styles.formGroup2}>
              <label htmlFor="password">Senha</label>
              <input 
                type="password" 
                id="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                placeholder="Sua senha" 
                disabled={isSubmitting}
              />
            </div>
            <button type="submit" className={`btn ${styles.btnPrimary}`} disabled={isSubmitting}>
              {isSubmitting ? (
                <><i className={`fas fa-spinner ${styles.faSpin}`}></i> Entrando...</>
              ) : (
                'Entrar'
              )}
            </button>
        </form>
      </div>
    </div>
  );
}