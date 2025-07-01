import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import * as authService from '../services/auth';
import { useAuth } from '../contexts/AuthContext';
import logo from '/img/nmlogo.png'; 
import styles from './LoginPage.module.css';
import { userDisplayNameMap, userDisplayNameModalMap } from '../api/config';

interface FormErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const { user, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.body.classList.add(styles.loginPage);
    return () => {
      document.body.classList.remove(styles.loginPage);
    };
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    
    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isSubmitting) return;
        
        if (!validateForm()) {
          toast.error('Por favor, corrija os erros no formulário');
          return;
        }
        
        setIsSubmitting(true);
        
        try {
          await authService.signIn(formData.email, formData.password);
    
          const displayName = userDisplayNameMap[formData.email] || 'Usuário';
          
          toast.success(`Bem-vindo, ${displayName}!`);
    
        } catch (error: any) {
          console.error('Erro no login:', error);
          
          let errorMessage = 'Falha no login. Tente novamente.';
          
          if (error.message) {
            if (error.message.includes('invalid-email')) {
              errorMessage = 'Email inválido';
            } else if (error.message.includes('user-not-found') || error.message.includes('invalid-credential')) {
              errorMessage = 'Email ou senha incorretos';
            } else if (error.message.includes('wrong-password')) {
              errorMessage = 'Senha incorreta';
            } else if (error.message.includes('too-many-requests')) {
              errorMessage = 'Muitas tentativas. Tente novamente mais tarde.';
            } else {
              errorMessage = error.message;
            }
          }
          
          toast.error(errorMessage, {
            duration: 4000,
            position: 'top-center',
          });
        } finally {
          setIsSubmitting(false);
        }
      };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting) {
      handleSubmit(e as any);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loginSection}>
        <div className={styles.loginContainer}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className={styles.spinner} style={{ 
              width: '40px', 
              height: '40px', 
              border: '4px solid rgba(255,255,255,0.3)',
              borderTop: '4px solid #58a6ff',
              borderRadius: '50%',
              margin: '0 auto'
            }}></div>
            <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.7)' }}>
              Carregando...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.loginSection}>
      <div className={styles.loginContainer}>
        <form onSubmit={handleSubmit} className={styles.loginForm} noValidate>
          <div className={styles.logoContainer}>
            <img 
              src={logo} 
              alt="Logo N-MULTIFIBRA" 
              loading="eager"
              onError={(e) => {
                console.error('Erro ao carregar logo:', e);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input 
              type="email" 
              id="email" 
              value={formData.email} 
              onChange={handleInputChange('email')}
              onKeyPress={handleKeyPress}
              required 
              placeholder="seu@email.com" 
              disabled={isSubmitting}
              autoComplete="email"
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={!!errors.email}
              style={{
                borderColor: errors.email ? '#ff4757' : undefined,
                background: errors.email ? 'rgba(255, 71, 87, 0.05)' : undefined
              }}
            />
            {errors.email && (
              <div 
                id="email-error" 
                style={{ 
                  color: '#ff4757', 
                  fontSize: '0.875rem', 
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                ⚠️ {errors.email}
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Senha</label>
            <input 
              type={showPassword ? "text" : "password"}
              id="password" 
              value={formData.password} 
              onChange={handleInputChange('password')}
              onKeyPress={handleKeyPress}
              required 
              placeholder="Sua senha" 
              disabled={isSubmitting}
              autoComplete="current-password"
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={!!errors.password}
              style={{
                borderColor: errors.password ? '#ff4757' : undefined,
                background: errors.password ? 'rgba(255, 71, 87, 0.05)' : undefined
              }}
            />
            {errors.password && (
              <div 
                id="password-error" 
                style={{ 
                  color: '#ff4757', 
                  fontSize: '0.875rem', 
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                ⚠️ {errors.password}
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isSubmitting}
            aria-label={isSubmitting ? 'Fazendo login...' : 'Fazer login'}
          >
            {isSubmitting ? (
              <>
                <div className={styles.spinner} style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%'
                }}></div>
                Entrando...
              </>
            ) : (
              <>
                <span>Entrar</span>
                <span style={{ fontSize: '1.2rem' }}>→</span>
              </>
            )}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: '2rem',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.5px'
        }}>
          N-MULTIFIBRA © 2025
        </div>
      </div>
    </div>
  );
}