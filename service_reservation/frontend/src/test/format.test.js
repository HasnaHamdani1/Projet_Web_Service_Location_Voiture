import { describe, expect, it } from 'vitest'
import { daysBetween, formatDateTimeLong, formatMoney, formatPeriodLong, formatPeriodShort, lastMonths, monthLabel } from '../utils/format'

describe('formatage FR', () => {
  it('formate les montants comme la maquette', () => {
    expect(formatMoney(153)).toBe('153,00 €')
    expect(formatMoney(25.5)).toBe('25,50 €')
    expect(formatMoney(1234.5)).toBe('1 234,50 €')
    expect(formatMoney(null)).toBe('—')
  })

  it('formate les périodes', () => {
    expect(formatPeriodShort('2026-11-18T09:00:00', '2026-11-21T09:00:00')).toBe('18 → 21 nov. 2026')
    expect(formatPeriodShort('2026-11-28T09:00:00', '2026-12-02T09:00:00')).toBe('28 nov. → 2 déc. 2026')
    expect(formatPeriodLong('2026-11-18T09:00:00', '2026-11-21T09:00:00')).toBe('18 → 21 novembre 2026')
  })

  it('lit les heures de période sans décalage de fuseau', () => {
    expect(formatDateTimeLong('2026-11-13T10:42:00')).toBe('13 novembre 2026 à 10:42')
  })

  it('calcule la durée comme le backend', () => {
    expect(daysBetween('2026-11-18', '2026-11-21')).toBe(3)
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3)
    expect(daysBetween('2026-11-18', '2026-11-18')).toBe(0)
  })

  it('génère les mois du filtre', () => {
    expect(monthLabel('2026-11')).toBe('Novembre 2026')
    const months = lastMonths(3, new Date(2026, 0, 15))
    expect(months.map((m) => m.value)).toEqual(['2026-01', '2025-12', '2025-11'])
  })
})
