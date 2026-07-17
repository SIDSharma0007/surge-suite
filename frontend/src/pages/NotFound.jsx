import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.themeToggleWrapper}>
        <ThemeToggle />
      </div>

      <div style={styles.content}>
        <FileQuestion size={48} strokeWidth={1.25} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-xl)' }} />
        <h1 style={styles.title}>404</h1>
        <h3 style={styles.subtitle}>Page Not Found</h3>
        <p style={styles.description}>The page you are looking for does not exist or has been relocated.</p>
        <button onClick={() => navigate('/')} style={styles.backBtn}>
          Return to Gateway
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-app)',
    color: 'var(--text-primary)',
    padding: 'var(--space-xl)',
    transition: 'background-color var(--dur-normal) var(--ease-apple), color var(--dur-normal) var(--ease-apple)',
    position: 'relative',
    fontFamily: 'var(--font-sans)',
  },
  themeToggleWrapper: {
    position: 'absolute',
    top: 'var(--space-xl)',
    right: 'var(--space-xl)',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    animation: 'fadeIn var(--dur-normal) var(--ease-apple)',
    maxWidth: '360px',
  },
  title: {
    fontSize: '5rem',
    fontWeight: '900',
    lineHeight: '1',
    letterSpacing: '-3px',
    marginBottom: 'var(--space-sm)',
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: 'var(--text-lg)',
    fontWeight: '700',
    marginBottom: 'var(--space-md)',
    letterSpacing: '-0.3px',
  },
  description: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    marginBottom: 'var(--space-2xl)',
  },
  backBtn: {
    background: 'var(--text-primary)',
    color: 'var(--bg-app)',
    padding: '11px var(--space-xl)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    transition: 'var(--transition-all)',
    boxShadow: 'var(--shadow-sm)',
  },
};
