import type { AnchorHTMLAttributes, ReactNode } from 'react'

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
  children: ReactNode
  active?: boolean
}

export function HashLink({ to, children, active = false, className = '', ...props }: Props) {
  return <a href={`#${to}`} className={`${className}${active ? ' active' : ''}`.trim()} {...props}>{children}</a>
}
