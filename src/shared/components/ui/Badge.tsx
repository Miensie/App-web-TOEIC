import { HTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> { variant?: BadgeVariant; }

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variants[variant], className)} {...props}>{children}</span>;
}