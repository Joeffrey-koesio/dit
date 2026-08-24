import { useMemo, useState } from 'react'
import { AlertTriangle, Building2, Clock3, Download, Layers3, MessageCircle, RotateCcw, TicketCheck, TimerReset, Upload } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as XLSX from 'xlsx'
import { average, consolidate, formatDuration, median, readFile } from './lib/data'
import type { PersonMetrics, Ticket } from './types'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#64748b']

type Role = 'technicians' | 'operators'
type KpiProps = { title: string; value: string | number; subtitle?: string; icon: typeof TicketCheck }

function Kpi({ title, value, subtitle, icon: Icon }: KpiProps) {
  return <article className="card kpi"><div><span>{title}</span><strong>{value}</strong>{subtitle && <small>{subtitle}</small>}</div><Icon /></article>
}

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [fileName, setFileName] = useState('')
  const [rowCount, setRowCount] = useState(0)
  const [rejected, setRejected] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState<Role>('technicians')
  const [person, setPerson] = useState('')
  const [agency, setAgency] = useState('')
  const [uo, setUo] = useState('')
  const [status, setStatus] = useState('')

  async function importFile(file?: File) {
    if (!file) return
    setLoading(true); setError('')
    try {
      const rawRows = await readFile(file)
      const result = consolidate(rawRows)
      setTickets(result.tickets); setRowCount(rawRows.length); setRejected(result.rejected); setFileName(file.name)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de lire le fichier.')
    } finally { setLoading(false) }
  }

  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const people = useMemo(() => unique(tickets.flatMap(ticket => ticket[role])), [tickets, role])
  const agencies = useMemo(() => unique(tickets.map(ticket => ticket.agency)), [tickets])
  const uos = useMemo(() => unique(tickets.map(ticket => ticket.uo)), [tickets])
  const statuses = useMemo(() => unique(tickets.map(ticket => ticket.status)), [tickets])

  const filtered = useMemo(() => tickets.filter(ticket =>
    (!person || ticket[role].includes(person)) &&
    (!agency || ticket.agency === agency) &&
    (!uo || ticket.uo === uo) &&
    (!status || ticket.status === status)
  ), [tickets, person, agency, uo, status, role])

  const personMetrics = useMemo<PersonMetrics[]>(() => people.map(name => {
    const linked = filtered.filter(ticket => ticket[role].includes(name))
    return {
      name,
      tickets: linked.length,
      handling: average(linked.map(ticket => ticket.handling)),
      response: average(linked.map(ticket => ticket.response)),
      resolution: average(linked.map(ticket => ticket.resolution)),
      resolvedTickets: linked.filter(ticket => ticket.resolution != null).length,
    }
  }).filter(metric => metric.tickets > 0).sort((a, b) => b.tickets - a.tickets), [filtered, people, role])

  const statusData = useMemo(() => Object.entries(filtered.reduce<Record<string, number>>((acc, ticket) => {
    const key = ticket.status || 'Non renseigné'; acc[key] = (acc[key] || 0) + 1; return acc
  }, {})).map(([name, value]) => ({ name, value })), [filtered])

  const uoData = useMemo(() => Object.entries(filtered.reduce<Record<string, number>>((acc, ticket) => {
    const key = ticket.uo || 'Non renseignée'; acc[key] = (acc[key] || 0) + 1; return acc
  }, {})).map(([name, tickets]) => ({ name, tickets })).sort((a, b) => b.tickets - a.tickets), [filtered])

  const agencyData = useMemo(() => Object.entries(filtered.reduce<Record<string, number>>((acc, ticket) => {
    const key = ticket.agency || 'Non renseignée'; acc[key] = (acc[key] || 0) + 1; return acc
  }, {})).map(([name, tickets]) => ({ name, tickets })).sort((a, b) => b.tickets - a.tickets), [filtered])

  const trendData = useMemo(() => Object.entries(filtered.reduce<Record<string, number>>((acc, ticket) => {
    const key = ticket.createdAt ? ticket.createdAt.toISOString().slice(0, 7) : 'Sans date'; acc[key] = (acc[key] || 0) + 1; return acc
  }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([date, tickets]) => ({ date, tickets })), [filtered])

  function resetFilters() { setPerson(''); setAgency(''); setUo(''); setStatus('') }

  function exportExcel() {
    const workbook = XLSX.utils.book_new()
    const ticketRows = filtered.map(ticket => ({
      'DIT no interne': ticket.id,
      'Date création': ticket.createdAt?.toLocaleString('fr-FR') || '',
      'État': ticket.status,
      'UO': ticket.uo,
      'Agence': ticket.agency,
      'Nature': ticket.nature,
      'Client': ticket.customer,
      'Opérateurs': ticket.operators.join(', '),
      'Intervenants': ticket.technicians.join(', '),
      'Prise en charge (h)': ticket.handling,
      'Réponse (h)': ticket.response,
      'Résolution (h)': ticket.resolution,
      'Durée intervention (h)': ticket.duration,
      'Lignes sources': ticket.sourceRows,
      'Anomalies': ticket.issues.join('; '),
    }))
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ticketRows), 'Tickets uniques')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(personMetrics), role === 'technicians' ? 'Techniciens' : 'Hotliners')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(uoData), 'Par UO')
    XLSX.writeFile(workbook, 'analyse-dit.xlsx')
  }

  if (!tickets.length) return <main className="landing"><section className="hero">
    <div className="brand">DIT Analytics</div>
    <h1>Pilotez vos interventions avec des données fiables</h1>
    <p>Importez un export Excel ou CSV. Les lignes sont regroupées par <b>DIT no interne</b> avant chaque calcul.</p>
    <label className="drop"><Upload /><b>{loading ? 'Analyse en cours…' : 'Déposer ou sélectionner un fichier'}</b><span>.xlsx, .xls ou .csv</span><input type="file" accept=".xlsx,.xls,.csv" onChange={event => importFile(event.target.files?.[0])} /></label>
    {error && <p className="error">{error}</p>}
    <aside>🔒 Traitement local dans le navigateur, sans envoi des données.</aside>
  </section></main>

  const validResolution = filtered.filter(ticket => ticket.resolution != null).length
  const issues = tickets.reduce((sum, ticket) => sum + ticket.issues.length, 0)

  return <main>
    <header><div><div className="brand">DIT Analytics</div><small>{fileName} • {rowCount.toLocaleString('fr-FR')} lignes • {tickets.length.toLocaleString('fr-FR')} DIT uniques</small></div><div className="actions"><button onClick={exportExcel}><Download />Exporter Excel</button><label className="button secondary">Changer de fichier<input type="file" accept=".xlsx,.xls,.csv" onChange={event => importFile(event.target.files?.[0])} /></label></div></header>

    <section className="filters">
      <select value={role} onChange={event => { setRole(event.target.value as Role); setPerson('') }}><option value="technicians">Vue techniciens</option><option value="operators">Vue hotliners / opérateurs</option></select>
      <select value={person} onChange={event => setPerson(event.target.value)}><option value="">Tous les collaborateurs</option>{people.map(value => <option key={value}>{value}</option>)}</select>
      <select value={uo} onChange={event => setUo(event.target.value)}><option value="">Toutes les UO</option>{uos.map(value => <option key={value}>{value}</option>)}</select>
      <select value={agency} onChange={event => setAgency(event.target.value)}><option value="">Toutes les agences</option>{agencies.map(value => <option key={value}>{value}</option>)}</select>
      <select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tous les états</option>{statuses.map(value => <option key={value}>{value}</option>)}</select>
      <button className="reset" onClick={resetFilters}><RotateCcw />Réinitialiser</button>
    </section>

    <section className="grid kpis">
      <Kpi title="Tickets uniques" value={filtered.length} subtitle={`${rowCount - tickets.length} lignes regroupées`} icon={TicketCheck} />
      <Kpi title="Prise en charge moyenne" value={formatDuration(average(filtered.map(ticket => ticket.handling)))} subtitle={`Médiane ${formatDuration(median(filtered.map(ticket => ticket.handling)))}`} icon={Clock3} />
      <Kpi title="Réponse moyenne" value={formatDuration(average(filtered.map(ticket => ticket.response)))} subtitle={`Médiane ${formatDuration(median(filtered.map(ticket => ticket.response)))}`} icon={MessageCircle} />
      <Kpi title="Résolution moyenne" value={formatDuration(average(filtered.map(ticket => ticket.resolution)))} subtitle={`${validResolution} tickets exploitables`} icon={TimerReset} />
      <Kpi title="UO visibles" value={unique(filtered.map(ticket => ticket.uo)).length} subtitle={uo || 'Toutes les UO'} icon={Layers3} />
      <Kpi title="Agences visibles" value={unique(filtered.map(ticket => ticket.agency)).length} subtitle={agency || 'Toutes les agences'} icon={Building2} />
    </section>

    <section className="grid charts two-thirds">
      <article className="card chart"><h2>Évolution du volume de tickets</h2><ResponsiveContainer width="100%" height={290}><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="tickets" stroke="#2563eb" strokeWidth={3} /></LineChart></ResponsiveContainer></article>
      <article className="card chart"><h2>Répartition par état</h2><ResponsiveContainer width="100%" height={290}><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92}>{statusData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></article>
    </section>

    <section className="grid charts halves">
      <article className="card chart"><h2>Tickets par UO</h2><ResponsiveContainer width="100%" height={Math.max(280, uoData.length * 40)}><BarChart data={uoData} layout="vertical" margin={{ left: 30 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={145} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="tickets" fill="#8b5cf6" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></article>
      <article className="card chart"><h2>Tickets par agence</h2><ResponsiveContainer width="100%" height={Math.max(280, agencyData.length * 40)}><BarChart data={agencyData} layout="vertical" margin={{ left: 30 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={145} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="tickets" fill="#14b8a6" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></article>
    </section>

    <section className="grid charts two-thirds">
      <article className="card chart"><h2>Tickets par collaborateur</h2><ResponsiveContainer width="100%" height={Math.max(330, Math.min(15, personMetrics.length) * 38)}><BarChart data={personMetrics.slice(0, 15)} layout="vertical" margin={{ left: 45 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={165} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="tickets" fill="#2563eb" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></article>
      <article className="card"><h2>Repères d'activité</h2><div className="notice"><AlertTriangle /><span>Ces données décrivent uniquement les volumes et délais présents dans l'export. Elles ne mesurent pas la qualité, la complexité des dossiers ou la satisfaction client.</span></div><ol className="ranking">{personMetrics.slice(0, 3).map((metric, index) => <li key={metric.name}><b>{index + 1}. {metric.name}</b><span>{metric.tickets} tickets associés • résolution {formatDuration(metric.resolution)}</span></li>)}</ol></article>
    </section>

    <section className="card table-card"><h2>Détail par collaborateur</h2><div className="scroll"><table><thead><tr><th>Collaborateur</th><th>Tickets associés</th><th>Prise en charge</th><th>Réponse</th><th>Résolution</th><th>Résolutions exploitables</th></tr></thead><tbody>{personMetrics.map(metric => <tr key={metric.name}><td>{metric.name}</td><td>{metric.tickets}</td><td>{formatDuration(metric.handling)}</td><td>{formatDuration(metric.response)}</td><td>{formatDuration(metric.resolution)}</td><td>{metric.resolvedTickets}</td></tr>)}</tbody></table></div></section>

    <footer>{rejected > 0 && `${rejected} lignes sans DIT ignorées • `}{issues} anomalies de consolidation signalées.</footer>
  </main>
}

export default App
