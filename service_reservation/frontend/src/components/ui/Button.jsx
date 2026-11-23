import clsx from 'clsx'
import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from './Feedback'

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-hover shadow-sm disabled:bg-brand/60',
  secondary: 'bg-[#EEF0F3] text-ink hover:bg-[#E4E6EA] disabled:opacity-60',
  outline: 'bg-white text-ink border border-line hover:bg-page disabled:opacity-60',
  ghost: 'text-ink-soft hover:bg-field disabled:opacity-60',
  danger: 'bg-danger text-white hover:bg-danger-text disabled:opacity-60',
  'danger-ghost': 'text-danger-text hover:bg-danger-soft disabled:opacity-60',
}

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-[10px]',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-[10px]',
  icon: 'h-9 w-9 rounded-lg justify-center',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, className, children, to, disabled, ...props },
  ref,
) {
  const classes = clsx(
    'inline-flex select-none items-center justify-center font-semibold transition-colors duration-150 disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
  const content = (
    <>
      {loading ? <Spinner className="h-4 w-4" /> : Icon && <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />}
      {children}
      {IconRight && !loading && <IconRight className="h-[18px] w-[18px] shrink-0" aria-hidden />}
    </>
  )
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }
  return (
    <button ref={ref} type="button" className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  )
})
