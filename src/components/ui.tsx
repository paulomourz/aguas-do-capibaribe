import { MOSTRAR_SELETOR_DE_ESTADOS } from '../config'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
} from 'react'
import {
  IconAlertTriangle,
  IconBell,
  IconCheckCircle,
  IconChevron,
  IconChevronLeft,
  IconCloudOff,
  IconEye,
  IconEyeOff,
  IconOctagon,
  IconRefresh,
  IconSearch,
  IconSpinner,
  IconX,
} from './icons'
import logoUrl from '../assets/logo.png'
import type { AlertaStatus } from '../domain/tipos'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

const safeId = (raw: string, p: string) => p + raw.replace(/[^a-zA-Z0-9]/g, '')

/* =========================================================
   Marca
   ========================================================= */

export function LogoMark({ size = 40 }: { size?: number; inverted?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-lg bg-white p-1"
      style={{ height: size, width: size }}
    >
      <img src={logoUrl} alt="" className="block h-full w-full object-contain" />
    </div>
  )
}

export function Logo({ inverted = false, compact = false }: { inverted?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark inverted={inverted} size={compact ? 40 : 52} />
      <div className="leading-tight">
        <div
          className={cx(
            'font-display font-bold tracking-tight',
            compact ? 'text-[17px]' : 'text-xl',
            inverted ? 'text-white' : 'text-brand',
          )}
        >
          Águas do Capibaribe
        </div>
        {!compact && (
          <div className={cx('text-[13px]', inverted ? 'text-on-dark-muted' : 'text-ink-2')}>Gestão de água por lote</div>
        )}
      </div>
    </div>
  )
}

/* =========================================================
   Grafismos (somente cores decorativas)
   ========================================================= */

export function DiamondDivider({
  tone = 'terracota',
  opacity = 0.45,
  height = 14,
  className,
}: {
  tone?: 'terracota' | 'areia' | 'couro' | 'white'
  opacity?: number
  height?: number
  className?: string
}) {
  const id = safeId(useId(), 'dd')
  const color = { terracota: 'var(--color-terracota)', areia: 'var(--color-areia)', couro: 'var(--color-couro)', white: '#FFFFFF' }[tone]
  const h = height
  const w = h * 1.6
  return (
    <div aria-hidden="true" className={cx('w-full', className)} style={{ height: h }}>
      <svg width="100%" height={h}>
        <defs>
          <pattern id={id} width={w} height={h} patternUnits="userSpaceOnUse">
            <g fill="none" style={{ stroke: color }} strokeWidth="1" strokeOpacity={opacity}>
              <path d={`M${w / 2} 1 L${w - 2} ${h / 2} L${w / 2} ${h - 1} L2 ${h / 2} Z`} />
              <path d={`M${w / 2} ${h / 2 - 2.5} L${w / 2 + 2.5} ${h / 2} L${w / 2} ${h / 2 + 2.5} L${w / 2 - 2.5} ${h / 2} Z`} />
              <path d={`M0 ${h / 2} L2 ${h / 2} M${w - 2} ${h / 2} L${w} ${h / 2}`} />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height={h} fill={`url(#${id})`} />
      </svg>
    </div>
  )
}

export function LacePattern({ color = 'var(--color-areia)', opacity = 0.14 }: { color?: string; opacity?: number }) {
  const id = safeId(useId(), 'lp')
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
      <defs>
        <pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse">
          <g fill="none" style={{ stroke: color }} strokeOpacity={opacity} strokeWidth="1">
            <path d="M24 2 46 24 24 46 2 24Z" />
            <path d="M24 12 36 24 24 36 12 24Z" />
            <circle cx="24" cy="24" r="2" />
            <circle cx="0" cy="0" r="2" />
            <circle cx="48" cy="0" r="2" />
            <circle cx="0" cy="48" r="2" />
            <circle cx="48" cy="48" r="2" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/** Ilustração geométrica minimalista de losangos (login e estados vazios). */
export function DiamondIllustration({ size = 112, children }: { size?: number; children?: ReactNode }) {
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 112 112" className="absolute inset-0 h-full w-full">
        <path d="M56 2 110 56 56 110 2 56Z" fill="none" style={{ stroke: 'var(--color-areia)' }} strokeWidth="1" />
        <path d="M56 16 96 56 56 96 16 56Z" fill="#FFFFFF" style={{ stroke: 'var(--color-areia)' }} strokeWidth="1" />
        <path d="M56 30 82 56 56 82 30 56Z" style={{ fill: 'var(--color-brand-soft)' }} />
        <path d="M56 2v14M56 96v14M2 56h14M96 56h14" style={{ stroke: 'var(--color-terracota)' }} strokeOpacity="0.5" />
        <circle cx="56" cy="9" r="2" style={{ fill: 'var(--color-terracota)' }} fillOpacity="0.6" />
        <circle cx="56" cy="103" r="2" style={{ fill: 'var(--color-terracota)' }} fillOpacity="0.6" />
        <circle cx="9" cy="56" r="2" style={{ fill: 'var(--color-terracota)' }} fillOpacity="0.6" />
        <circle cx="103" cy="56" r="2" style={{ fill: 'var(--color-terracota)' }} fillOpacity="0.6" />
      </svg>
      <span className="relative text-brand">{children}</span>
    </div>
  )
}

/* =========================================================
   Botões
   ========================================================= */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'text'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  full?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading, icon, full, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed',
        size === 'lg' && 'min-h-14 px-6 text-[17px]',
        size === 'md' && 'min-h-12 px-4 text-base',
        size === 'sm' && 'min-h-11 px-3 text-[15px]',
        variant === 'primary' &&
          (loading
            ? 'bg-brand-hover text-white'
            : 'bg-brand text-white shadow-sm hover:bg-brand-hover disabled:bg-disabled-bg disabled:text-neutral-ink disabled:shadow-none'),
        variant === 'secondary' &&
          'border-[1.5px] border-brand bg-white text-brand hover:bg-brand-soft disabled:border-disabled-bg disabled:bg-white disabled:text-disabled-ink',
        variant === 'text' && 'px-2 text-link hover:bg-brand-soft hover:text-brand disabled:text-disabled-ink disabled:hover:bg-transparent',
        full && 'w-full',
        className,
      )}
    >
      {loading ? <IconSpinner size={18} /> : icon}
      {children}
    </button>
  )
}

/* =========================================================
   Campos
   ========================================================= */

export function Field({
  label,
  hint,
  error,
  children,
  id,
  className,
  optional,
}: {
  label: string
  hint?: ReactNode
  error?: string
  id: string
  children: ReactNode
  className?: string
  optional?: boolean
}) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-[15px] font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-ink-2"> (opcional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[13px] leading-snug text-ink-2">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-[13px] font-semibold leading-snug text-crit">
      <IconOctagon size={16} strokeWidth={2.2} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}

const inputBase =
  'min-h-12 w-full rounded-lg border bg-white px-4 text-base text-ink transition-colors hover:border-field-border-hover focus-visible:border-link focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:border-neutral-bg disabled:bg-disabled-field disabled:text-disabled-ink'

export function TextInput({
  invalid,
  suffix,
  className,
  ...rest
}: ComponentProps<'input'> & { invalid?: boolean; suffix?: string }) {
  const describedBy = rest.id ? (invalid ? `${rest.id}-error` : `${rest.id}-hint`) : undefined
  return (
    <div className="relative">
      <input
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        {...rest}
        className={cx(inputBase, invalid ? 'border-crit border-[1.5px]' : 'border-field-border', suffix && 'pr-20', className)}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[15px] font-medium text-ink-2">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function PasswordInput({ invalid, className, ...rest }: ComponentProps<'input'> & { invalid?: boolean }) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div className="relative">
      <TextInput {...rest} invalid={invalid} type={visivel ? 'text' : 'password'} className={cx('pr-14', className)} />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        disabled={rest.disabled}
        className="absolute right-0.5 top-0.5 grid h-11 w-11 place-items-center rounded-md text-ink-2 hover:text-brand disabled:opacity-50"
      >
        {visivel ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  )
}

export function Select({ invalid, className, children, ...rest }: ComponentProps<'select'> & { invalid?: boolean }) {
  const describedBy = rest.id ? (invalid ? `${rest.id}-error` : `${rest.id}-hint`) : undefined
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        {...rest}
        className={cx(inputBase, 'appearance-none pr-11', invalid ? 'border-[1.5px] border-crit' : 'border-field-border', className)}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-2"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}

/** Grupo de opções em cartões (rádio) */
export function ChoiceGroup<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  error,
}: {
  legend: string
  name: string
  value: T | ''
  onChange: (v: T) => void
  options: { value: T; label: string; hint?: string }[]
  error?: string
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-2 text-[15px] font-semibold text-ink">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              'flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 text-base font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link',
              value === o.value
                ? 'border-[1.5px] border-brand bg-brand-soft text-brand'
                : error
                  ? 'border-[1.5px] border-crit bg-white'
                  : 'border-field-border bg-white text-ink hover:border-field-border-hover',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="h-5 w-5 shrink-0 accent-brand focus-visible:outline-none"
            />
            <span className="leading-tight">
              {o.label}
              {o.hint && <span className="block text-[13px] font-normal text-ink-2">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <FieldError id={`${name}-error`}>{error}</FieldError>}
    </fieldset>
  )
}

/* =========================================================
   Selos
   ========================================================= */

export type Status = 'ok' | 'warn' | 'crit'

export const statusMeta: Record<Status, { label: string; text: string; bg: string; Icon: typeof IconCheckCircle }> = {
  ok: { label: 'Dentro da meta', text: 'text-ok', bg: 'bg-ok-bg', Icon: IconCheckCircle },
  warn: { label: 'Atenção', text: 'text-warn', bg: 'bg-warn-bg', Icon: IconAlertTriangle },
  crit: { label: 'Crítico', text: 'text-crit', bg: 'bg-crit-bg', Icon: IconOctagon },
}

const badgeSize = {
  sm: 'px-2.5 py-1 text-[13px]',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
}

export function StatusBadge({ status, size = 'md' }: { status: Status; size?: 'sm' | 'md' | 'lg' }) {
  const m = statusMeta[status]
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold', m.text, m.bg, badgeSize[size])}>
      <m.Icon size={size === 'lg' ? 20 : 16} strokeWidth={2.2} />
      {m.label}
    </span>
  )
}

export type AlertStatus = AlertaStatus

export const alertMeta: Record<AlertStatus, { label: string; cls: string; Icon: typeof IconCheckCircle }> = {
  aberto: { label: 'Aberto', cls: 'bg-crit-bg text-crit', Icon: IconBell },
  analise: { label: 'Em análise', cls: 'bg-brand-soft text-brand', Icon: IconSearch },
  resolvido: { label: 'Resolvido', cls: 'bg-neutral-bg text-neutral-ink', Icon: IconCheckCircle },
}

export function AlertBadge({ status, size = 'md' }: { status: AlertStatus; size?: 'sm' | 'md' | 'lg' }) {
  const m = alertMeta[status]
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-semibold', m.cls, badgeSize[size])}>
      <m.Icon size={size === 'lg' ? 20 : 16} strokeWidth={2.2} />
      {m.label}
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-page px-2 py-1 text-[13px] font-semibold text-ink tabular-nums">
      {children}
    </span>
  )
}

/* =========================================================
   Cards
   ========================================================= */

export function Card({ children, className, as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <As className={cx('rounded-[8px] border border-line bg-white shadow-[var(--shadow-card)]', className)}>{children}</As>
}

export function CardHeader({ title, subtitle, action, id }: { title: string; subtitle?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-4 pt-6 sm:px-6">
      <div className="min-w-0">
        <h2 id={id} className="text-[18px] font-semibold leading-tight text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function KpiCard({ label, value, unit, footer, icon }: { label: string; value: string; unit?: string; footer?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-medium text-ink-2">{label}</span>
        {icon && <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[32px] font-semibold leading-none tracking-tight text-ink tabular-nums">{value}</span>
        {unit && <span className="text-base font-medium text-ink-2">{unit}</span>}
      </div>
      {footer && <div className="text-[15px] text-ink-2">{footer}</div>}
    </Card>
  )
}

/* =========================================================
   Tabela responsiva (desktop: tabela com cabeçalho fixo e zebra; mobile: cards)
   ========================================================= */

export type Col<T> = {
  key: string
  header: string
  render: (r: T) => ReactNode
  num?: boolean
  /** Como a coluna aparece no card mobile */
  mobile?: 'title' | 'subtitle' | 'badge' | 'value' | 'field' | 'hide'
  className?: string
}

export function DataTable<T>({
  rows,
  cols,
  caption,
  rowKey,
  minWidth = 640,
  maxHeight = 560,
  highlight,
  footer,
  breakpoint = 'md',
}: {
  rows: T[]
  cols: Col<T>[]
  caption: string
  rowKey: (r: T) => string
  minWidth?: number
  maxHeight?: number | null
  highlight?: (r: T) => boolean
  footer?: ReactNode
  breakpoint?: 'md' | 'lg'
}) {
  const title = cols.find((c) => c.mobile === 'title')
  const subtitle = cols.find((c) => c.mobile === 'subtitle')
  const badge = cols.find((c) => c.mobile === 'badge')
  const value = cols.find((c) => c.mobile === 'value')
  const fields = cols.filter((c) => !c.mobile || c.mobile === 'field')
  return (
    <>
      <div
        className={cx('overflow-auto', breakpoint === 'md' ? 'hidden md:block' : 'hidden lg:block')}
        style={maxHeight ? { maxHeight } : undefined}
        tabIndex={0}
        role="region"
        aria-label={caption}
      >
        <table className="w-full border-separate border-spacing-0 text-left text-[15px]" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cx(
                    'sticky top-0 z-10 border-b border-line bg-page px-4 py-3 text-[14px] font-medium text-ink-2 first:pl-6 last:pr-6',
                    c.num && 'whitespace-nowrap text-right',
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className={cx('even:bg-zebra', highlight?.(r) && '!bg-brand-soft')}>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      'border-b border-line px-4 py-3 align-middle text-ink first:pl-6 last:pr-6',
                      c.num && 'whitespace-nowrap text-right tabular-nums',
                      c.className,
                    )}
                  >
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>

      <ul className={cx('divide-y divide-line border-t border-line', breakpoint === 'md' ? 'md:hidden' : 'lg:hidden')} aria-label={caption}>
        {rows.map((r) => (
          <li key={rowKey(r)} className={cx('flex flex-col gap-3 px-4 py-4', highlight?.(r) && 'bg-brand-soft')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {title && <div className="text-base font-semibold text-ink">{title.render(r)}</div>}
                {subtitle && <div className="mt-0.5 text-[13px] text-ink-2">{subtitle.render(r)}</div>}
              </div>
              {value && <div className="shrink-0 font-display text-lg font-semibold tabular-nums text-ink">{value.render(r)}</div>}
            </div>
            {fields.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {fields.map((f) => (
                  <div key={f.key} className="min-w-0">
                    <dt className="text-[13px] text-ink-2">{f.header}</dt>
                    <dd className={cx('text-[15px] text-ink', f.num && 'tabular-nums')}>{f.render(r)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {badge && <div>{badge.render(r)}</div>}
          </li>
        ))}
      </ul>
    </>
  )
}

/* =========================================================
   Filtros e paginação
   ========================================================= */

export function FilterBar({ children, onClear, resumo }: { children: ReactNode; onClear?: () => void; resumo?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-line px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:px-6">
      {children}
      <div className="flex items-center gap-4 sm:ml-auto">
        {resumo && <span className="text-[15px] text-ink-2" aria-live="polite">{resumo}</span>}
        {onClear && (
          <Button variant="text" size="sm" onClick={onClear}>
            Limpar filtro
          </Button>
        )}
      </div>
    </div>
  )
}

export function Pagination({ page, total, perPage, onChange }: { page: number; total: number; perPage: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage))
  if (total === 0) return null
  const ini = (page - 1) * perPage + 1
  const fim = Math.min(page * perPage, total)
  return (
    <nav aria-label="Paginação" className="flex flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between sm:px-6">
      <p className="text-[15px] text-ink-2 tabular-nums">
        Mostrando {ini}–{fim} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="grid h-11 w-11 place-items-center rounded-lg text-brand hover:bg-brand-soft disabled:text-field-border disabled:hover:bg-transparent"
          aria-label="Página anterior"
        >
          <IconChevronLeft />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Página ${p}`}
            className={cx(
              'grid h-11 min-w-11 place-items-center rounded-lg px-2 text-[15px] font-semibold tabular-nums',
              p === page ? 'bg-brand text-white' : 'text-ink hover:bg-brand-soft hover:text-brand',
            )}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page === pages}
          className="grid h-11 w-11 place-items-center rounded-lg text-brand hover:bg-brand-soft disabled:text-field-border disabled:hover:bg-transparent"
          aria-label="Próxima página"
        >
          <IconChevron />
        </button>
      </div>
    </nav>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string; count?: number; tone?: 'crit' }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const ativo = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={ativo}
            onClick={() => onChange(t.value)}
            className={cx(
              'relative flex min-h-12 shrink-0 items-center gap-2 px-4 text-[15px] font-semibold transition-colors',
              ativo ? 'text-brand' : 'text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cx('rounded-full px-2 py-0.5 text-[13px] tabular-nums', t.tone === 'crit' && t.count ? 'bg-crit-bg font-semibold text-crit' : ativo ? 'bg-brand text-white' : 'bg-neutral-bg text-neutral-ink')}>
                {t.count}
              </span>
            )}
            {ativo && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-brand" />}
          </button>
        )
      })}
    </div>
  )
}

/* =========================================================
   Estados
   ========================================================= */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('skeleton rounded-md', className)} />
}

export function LoadingBlock({ rows = 4, label = 'Carregando dados…' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4 p-6">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <DiamondIllustration size={112}>{icon}</DiamondIllustration>
      <h3 className="mt-6 text-[18px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-base text-ink-2">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Não foi possível carregar os dados',
  description = 'Verifique sua conexão e tente novamente. Se o problema continuar, avise o gestor da lavanderia.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-crit-bg text-crit">
        <IconCloudOff size={28} />
      </div>
      <h3 className="mt-4 text-[18px] font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-base text-ink-2">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-6" icon={<IconRefresh size={18} />} onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function Banner({ tone, title, children }: { tone: Status | 'info'; title?: string; children: ReactNode }) {
  const styles = { ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn', crit: 'bg-crit-bg text-crit', info: 'bg-brand-soft text-brand' }[tone]
  const Icon = tone === 'info' ? IconCheckCircle : statusMeta[tone].Icon
  return (
    <div role={tone === 'crit' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-lg px-4 py-3 text-[15px]', styles)}>
      <Icon size={20} strokeWidth={2.2} className="mt-0.5 shrink-0" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : 'font-medium'}>{children}</div>
      </div>
    </div>
  )
}

/* =========================================================
   Cabeçalho de página e seletor de estado (protótipo)
   ========================================================= */

export type ViewState = 'dados' | 'carregando' | 'vazio' | 'erro'

export function PageHeader({
  title,
  description,
  actions,
  code,
  back,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  code?: string
  back?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      {back}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {code && (
            <span className="mb-2 inline-flex items-center rounded border border-line-strong bg-white px-2 py-0.5 text-[13px] font-semibold tracking-wide text-ink-2">
              {code}
            </span>
          )}
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-base text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

const stateLabels: Record<ViewState, string> = { dados: 'Com dados', carregando: 'Carregando', vazio: 'Vazio', erro: 'Erro' }

export function StatePreview({
  value,
  onChange,
  options = ['dados', 'carregando', 'vazio', 'erro'],
  labels,
}: {
  value: ViewState
  onChange: (v: ViewState) => void
  options?: ViewState[]
  labels?: Partial<Record<ViewState, string>>
}) {
  if (!MOSTRAR_SELETOR_DE_ESTADOS) return null
  return (
    <fieldset className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line-strong bg-white/70 px-3 py-1">
      <legend className="sr-only">Pré-visualizar estado da tela</legend>
      <span className="text-[13px] font-medium text-ink-2">Estado (protótipo):</span>
      <div className="flex flex-wrap">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={cx(
              'min-h-11 rounded-md px-3 text-[13px] font-semibold transition-colors',
              value === o ? 'bg-brand text-white' : 'text-ink-2 hover:bg-brand-soft hover:text-brand',
            )}
          >
            {labels?.[o] ?? stateLabels[o]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/* =========================================================
   Modal (desktop: centralizado; mobile: opcionalmente tela cheia)
   ========================================================= */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  fullscreenMobile = false,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  fullscreenMobile?: boolean
  size?: 'sm' | 'md'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = safeId(useId(), 'mt')
  const fechar = useRef(onClose)
  fechar.current = onClose

  useEffect(() => {
    if (!open) return
    const anterior = document.activeElement as HTMLElement | null
    const el = ref.current
    const focaveis = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, [href]') ?? [])
    const primeiro = el?.querySelector<HTMLElement>('input, select') ?? focaveis()[0]
    primeiro?.focus()
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar.current()
      if (e.key === 'Tab') {
        const f = focaveis()
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault()
          f[f.length - 1].focus()
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault()
          f[0].focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      anterior?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className={cx('fixed inset-0 z-50 flex justify-center bg-ink/50', fullscreenMobile ? 'items-stretch sm:items-center sm:p-6' : 'items-center p-4 sm:p-6')}>
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'rise relative flex w-full flex-col bg-white shadow-2xl',
          size === 'sm' ? 'sm:max-w-[480px]' : 'sm:max-w-[560px]',
          fullscreenMobile ? 'min-h-full sm:min-h-0 sm:rounded-[8px]' : 'max-h-[90vh] rounded-[8px]',
        )}
      >
        {fullscreenMobile && <div className="h-1 shrink-0 bg-terracota sm:hidden" />}
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 id={titleId} className="text-[22px] font-semibold leading-tight text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-[15px] text-ink-2">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-brand-soft hover:text-brand"
          >
            <IconX />
          </button>
        </div>
        {children && <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line bg-zebra px-6 py-4 sm:flex-row sm:justify-end sm:rounded-b-[8px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================================
   Toast (sucesso / erro)
   ========================================================= */

export type ToastData = { id: number; message: string; tone: 'sucesso' | 'erro' }

export function Toast({ toast, onClose, inline = false }: { toast: ToastData | null; onClose: () => void; inline?: boolean }) {
  if (!toast) return null
  const erro = toast.tone === 'erro'
  const box = (
    <div
      role={erro ? 'alert' : 'status'}
      aria-live={erro ? 'assertive' : 'polite'}
      className={cx(
        'rise flex max-w-[440px] items-start gap-3 rounded-lg border py-2 pl-4 pr-2 text-[15px] shadow-lg',
        erro ? 'border-crit-line bg-white text-ink' : 'border-brand bg-brand text-white',
      )}
    >
      <span className={cx('mt-2.5 shrink-0', erro && 'text-crit')}>
        {erro ? <IconOctagon size={20} strokeWidth={2.2} /> : <IconCheckCircle size={20} strokeWidth={2.2} />}
      </span>
      <span className="flex-1 py-2.5 font-medium">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-md', erro ? 'text-ink-2 hover:bg-page' : 'hover:bg-brand-hover focus-visible:outline-white')}
        aria-label="Fechar notificação"
      >
        <IconX size={18} />
      </button>
    </div>
  )
  if (inline) return box
  return <div className="fixed inset-x-4 bottom-4 z-[60] flex justify-center sm:inset-x-auto sm:bottom-6 sm:right-6">{box}</div>
}
