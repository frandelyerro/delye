import { cva } from 'class-variance-authority';
import { cn } from './utils';
import { ButtonHTMLAttributes } from 'react';

const buttonVariants = cva('rounded px-4 py-2 text-sm font-medium', {
  variants: { variant: { default: 'bg-cyan-700 hover:bg-cyan-600', secondary: 'bg-slate-800 hover:bg-slate-700' } },
  defaultVariants: { variant: 'default' }
});

export function Button({ className, variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'secondary' }) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
