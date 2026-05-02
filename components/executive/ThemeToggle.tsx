'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

/**
 * next-themes resuelve el tema en el cliente; cualquier etiqueta que dependa de `theme`
 * debe montarse solo tras `useEffect` para evitar mismatch SSR/hidratación.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, systemTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className="pointer-events-none opacity-90"
        aria-busy="true"
        title="Cargando tema…"
      >
        Tema
      </Button>
    );
  }

  const current = theme === 'system' ? systemTheme : theme;
  const isDark = current === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title="Cambiar modo claro/oscuro"
    >
      {isDark ? 'Modo claro' : 'Modo oscuro'}
    </Button>
  );
}

