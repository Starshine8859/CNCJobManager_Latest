import React from 'react';

interface TextureSwatchProps {
  texture?: string | null;
  hexColor: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TextureSwatch({ texture, hexColor, name, size = 'md', className = '' }: TextureSwatchProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-12 h-12'
  };

  const baseClasses = `${sizeClasses[size]} rounded border object-cover shadow-sm ${className}`;

  if (texture) {
    return (
      <img
        src={texture}
        alt={name}
        className={baseClasses}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={baseClasses}
      style={{ backgroundColor: hexColor }}
      title={name}
    />
  );
} 