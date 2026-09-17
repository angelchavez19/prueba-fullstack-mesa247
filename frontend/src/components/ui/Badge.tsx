import React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { QueueStatus, UserRole } from '../../types'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'purple'
  status?: QueueStatus
  role?: UserRole
}

export const STATUS_LABELS: Record<QueueStatus, string> = {
  reserved: 'En Espera',
  called: 'Llamado',
  seated: 'Sentado',
  cancelled: 'Cancelado',
  'no-show': 'No Asistió',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  host: 'Host',
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  status,
  role,
  ...props
}) => {
  let resolvedVariant = variant
  let displayText = children

  if (status) {
    displayText = STATUS_LABELS[status] || status
    switch (status) {
      case 'reserved':
        resolvedVariant = 'warning'
        break
      case 'called':
        resolvedVariant = 'purple'
        break
      case 'seated':
        resolvedVariant = 'success'
        break
      case 'cancelled':
        resolvedVariant = 'destructive'
        break
      case 'no-show':
        resolvedVariant = 'default'
        break
    }
  } else if (role) {
    displayText = ROLE_LABELS[role] || role
    switch (role) {
      case 'admin':
        resolvedVariant = 'purple'
        break
      case 'manager':
        resolvedVariant = 'info'
        break
      case 'host':
        resolvedVariant = 'success'
        break
    }
  }

  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    destructive: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-violet-50 text-violet-700 border-violet-200',
  }

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase',
          variantStyles[resolvedVariant],
          className
        )
      )}
      {...props}
    >
      {displayText}
    </span>
  )
}
