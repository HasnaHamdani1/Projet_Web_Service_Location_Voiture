import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'

/** Liste déroulante de filtre (style des boutons « Tous les statuts » / « Novembre 2026 ») */
export function FilterSelect({ value, onChange, options, icon: Icon, label, className }) {
  const selected = options.find((o) => o.value === value) || options[0]
  return (
    <Listbox value={value} onChange={onChange}>
      <div className={clsx('relative', className)}>
        <ListboxButton
          aria-label={label}
          className="inline-flex h-10 w-full items-center gap-2.5 rounded-[10px] bg-[#F1F2F4] px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-[#E9EBEE] sm:w-auto"
        >
          {Icon && <Icon className="h-[18px] w-[18px] text-ink-soft" aria-hidden />}
          <span className="flex-1 truncate text-left">{selected?.label}</span>
          <ChevronDown className="ml-2 h-4 w-4 text-ink-muted" aria-hidden />
        </ListboxButton>
        <ListboxOptions
          anchor={{ to: 'bottom end', gap: 6 }}
          className="z-40 max-h-72 min-w-[var(--button-width)] overflow-auto rounded-xl bg-white p-1.5 shadow-pop ring-1 ring-black/5 focus:outline-none"
        >
          {options.map((o) => (
            <ListboxOption
              key={o.value}
              value={o.value}
              className="group flex cursor-pointer items-center justify-between gap-6 rounded-lg px-3 py-2 text-sm text-ink data-[focus]:bg-field data-[selected]:font-semibold"
            >
              {o.label}
              <Check className="invisible h-4 w-4 text-brand group-data-[selected]:visible" aria-hidden />
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  )
}
