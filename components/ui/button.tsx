import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md';
  asChild?: boolean;
}

export function Button({
  className,
  variant = 'default',
  size = 'md',
  asChild,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
  const sizes = {
    sm: 'h-8 px-3',
    md: 'h-9 px-4',
  }[size];
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  }[variant];
  if (asChild) {
    // Conveniencia: permite usar <Button asChild><Link/></Button>
    // sin depender de librerías extra.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const child = (props as any).children as React.ReactElement | undefined;
    if (!child) return null;
    return React.cloneElement(child, {
      className: cn(base, sizes, variants, className, child.props?.className),
    });
  }
  return <button className={cn(base, sizes, variants, className)} {...props} />;
}

