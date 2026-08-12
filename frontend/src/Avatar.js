import React from 'react';

// ===== SHARED AVATAR — single component used everywhere a user avatar
// renders: sidebar footer, chat header, message bubbles, and Settings ->
// Profile. Reads directly from the user object passed in — never a separate
// local copy — so once that object updates (upload, remove, initial fetch),
// every consumer re-renders with the same value in the same tick. =====

export default function Avatar({ user, size = 40, radius, loading = false, className = '', style = {} }) {
  const shape = radius !== undefined ? radius : '50%';
  const initial = user?.username ? user.username[0].toUpperCase() : '?';
  const common = {
    width: size, height: size, borderRadius: shape, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', ...style,
  };

  if (loading) {
    return (
      <div
        className={`avatar-skeleton ${className}`}
        style={{ ...common, background: 'var(--surface-4)' }}
        aria-hidden="true"
      />
    );
  }

  if (user?.avatar_url) {
    return (
      <div className={className} style={common}>
        <img
          src={user.avatar_url}
          alt={user.username || ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        ...common,
        background: user?.avatar_color || '#667eea',
        color: 'white', fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.4)),
      }}
    >
      {initial}
    </div>
  );
}