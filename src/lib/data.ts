import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { RawRow, Ticket } from '../types'

export const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

const aliases: Record<string, string[]> = {
  id: ['DIT no interne'],
  created: ['DIT Date/Heure'],
  status: ['DIT Etat'],
  nature: ['DIT Nature'],
  requestType: ['Type DIT'],
  opLast: ['DIT Opérateur nom'],
  opFirst: ['DIT Opérateur prénom'],
  techLast: ['IT Intervenant nom'],
  techFirst: ['IT Intervenant prénom'],
  duration: ['IT Durée'],
  handling: ['Tps Prise en charge'],
  response: ['Tps Réponse'],
  resolution: ['Tps Résolution'],
  agency: ['Profil client AGENCES'],
  uo: ['DIT Domaine lib'],
  customer: ['DIT Raison sociale'],
  activity: ['IT Activité article'],
}

export function detectColumns(headers: string[]) {
  const mapping: Record<string, string | undefined> = {}
  for (const [key, names] of Object.entries(aliases)) {
    mapping[key] = headers.find(header => names.some(name => normalize(header) === normalize(name)))
  }
  return mapping
}

const asText = (value: unknown) => value == null ? '' : String(value).trim()
const asNumber = (value: unknown) => {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
const asDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    return parsed ? new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S) : null
  }
  if (typeof value === 'string') {
    const french = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
    if (french) return new Date(+french[3], +french[2] - 1, +french[1], +(french[4] || 0), +(french[5] || 0))
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}
const fullName = (first: unknown, last: unknown) => [asText(first), asText(last).toUpperCase()].filter(Boolean).join(' ')

export async function readFile(file: File): Promise<RawRow[]> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return await new Promise((resolve, reject) => Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: result => resolve(result.data),
      error: reject,
    }))
  }
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<RawRow>(firstSheet, { defval: null, raw: true })
}

export function consolidate(rows: RawRow[]) {
  const headers = rows[0] ? Object.keys(rows[0]) : []
  const mapping = detectColumns(headers)
  if (!mapping.id) throw new Error('La colonne « DIT no interne » est introuvable.')

  const grouped = new Map<string, RawRow[]>()
  let rejected = 0
  for (const row of rows) {
    const id = asText(row[mapping.id]).toUpperCase()
    if (!id) { rejected += 1; continue }
    const existing = grouped.get(id)
    if (existing) existing.push(row)
    else grouped.set(id, [row])
  }

  const tickets: Ticket[] = []
  for (const [id, group] of grouped) {
    const first = (key: string) => {
      const column = mapping[key]
      return column ? group.map(row => row[column]).find(value => value != null && value !== '') : null
    }
    const numbers = (key: string) => {
      const column = mapping[key]
      return column ? group.map(row => asNumber(row[column])).filter((value): value is number => value != null) : []
    }
    const people = (firstKey: string, lastKey: string) => {
      const firstColumn = mapping[firstKey]
      const lastColumn = mapping[lastKey]
      return [...new Set(group.map(row => fullName(firstColumn ? row[firstColumn] : null, lastColumn ? row[lastColumn] : null)).filter(Boolean))]
    }
    const issues: string[] = []
    const oneDuration = (key: string) => {
      const values = numbers(key)
      if (new Set(values.map(value => value.toFixed(6))).size > 1) issues.push(`Valeurs multiples : ${key}`)
      return values[0] ?? null
    }
    const dates = mapping.created ? group.map(row => asDate(row[mapping.created!])).filter((value): value is Date => value != null) : []
    const statuses = mapping.status ? [...new Set(group.map(row => asText(row[mapping.status!])).filter(Boolean))] : []
    if (statuses.length > 1) issues.push('Plusieurs états pour le même DIT')

    tickets.push({
      id,
      createdAt: dates.length ? new Date(Math.min(...dates.map(value => value.getTime()))) : null,
      status: statuses.length ? statuses[statuses.length - 1] : '',
      nature: asText(first('nature')),
      requestType: asText(first('requestType')),
      agency: asText(first('agency')),
      uo: asText(first('uo')),
      customer: asText(first('customer')),
      activity: asText(first('activity')),
      operators: people('opFirst', 'opLast'),
      technicians: people('techFirst', 'techLast'),
      handling: oneDuration('handling'),
      response: oneDuration('response'),
      resolution: oneDuration('resolution'),
      duration: numbers('duration').reduce((sum, value) => sum + value, 0),
      sourceRows: group.length,
      issues,
    })
  }
  return { tickets, rejected }
}

export const average = (values: (number | null)[]) => {
  const valid = values.filter((value): value is number => value != null)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}
export const median = (values: (number | null)[]) => {
  const valid = values.filter((value): value is number => value != null).sort((a, b) => a - b)
  if (!valid.length) return null
  const middle = Math.floor(valid.length / 2)
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2
}
export const formatDuration = (hours: number | null) => {
  if (hours == null) return 'N/D'
  const minutes = Math.round(hours * 60)
  if (minutes < 60) return `${minutes} min`
  const days = Math.floor(minutes / 1440)
  const remainingHours = Math.floor((minutes % 1440) / 60)
  const remainingMinutes = minutes % 60
  return days ? `${days} j ${remainingHours} h ${remainingMinutes} min` : `${remainingHours} h ${remainingMinutes} min`
}
