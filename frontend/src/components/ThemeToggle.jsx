import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      className="theme-toggle-btn"
      onClick={toggleTheme}
      style={{
        display: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? '🌙' : '🌞'}
    </button>
  );
}
