import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import type { Branch, QueueMetrics, MetricTimeframe, QueueEntry } from '../../types'
import { Navbar } from '../../components/layout/Navbar'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import {
  BarChart3,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  UserX,
  Users,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'

export const ReportsPage: React.FC = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const timeframeParam = searchParams.get('timeframe') as MetricTimeframe | null
  const timeframe: MetricTimeframe =
    timeframeParam && ['day', 'week', 'month', 'all'].includes(timeframeParam)
      ? timeframeParam
      : 'day'

  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<number>(() => user?.branch_id || 1)
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null)
  const [recentHistory, setRecentHistory] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Load branches
  useEffect(() => {
    api.listBranches().then((list) => {
      setBranches(list)
      if (user?.role === 'host' && user.branch_id) {
        setSelectedBranchId(user.branch_id)
      } else if (user?.branch_id && list.some((b) => b.id === user.branch_id)) {
        setSelectedBranchId(user.branch_id)
      } else if (list.length > 0) {
        setSelectedBranchId(list[0].id)
      }
    })
  }, [user])

  const handleSelectBranch = (branchId: number) => {
    if (user?.role === 'host') return
    setSelectedBranchId(branchId)
  }

  const parseUtcDate = (dateStr: string) => {
    if (!dateStr) return new Date()
    let normalized = dateStr
    if (!normalized.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(normalized)) {
      normalized = `${normalized}Z`
    }
    return new Date(normalized)
  }

  const fetchMetricsAndHistory = useCallback(async () => {
    if (!selectedBranchId) return
    try {
      setLoading(true)
      const [metricsData, allEntries] = await Promise.all([
        api.getBranchMetrics(selectedBranchId, timeframe),
        api.listQueueEntries(selectedBranchId),
      ])
      setMetrics(metricsData)
      // Filter entries by completed states (seated, cancelled, no-show)
      const resolved = allEntries
        .filter((e) => e.status === 'seated' || e.status === 'cancelled' || e.status === 'no-show')
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      setRecentHistory(resolved)
    } catch (err) {
      console.error('Failed to fetch reports', err)
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId, timeframe])

  useEffect(() => {
    fetchMetricsAndHistory()
  }, [fetchMetricsAndHistory])

  const currentBranch = branches.find((b) => b.id === selectedBranchId)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        branches={branches}
        currentBranchId={selectedBranchId}
        onSelectBranch={handleSelectBranch}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <span>Reportes y Estadísticas Operativas</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Métricas y análisis de rendimiento de la cola para{' '}
              <strong className="text-slate-700">{currentBranch?.name}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe Semantic Links */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-xs overflow-x-auto max-w-full">
              {(
                [
                  { key: 'day', label: 'Hoy' },
                  { key: 'week', label: 'Semana' },
                  { key: 'month', label: 'Mes' },
                  { key: 'all', label: 'Histórico' },
                ] as const
              ).map(({ key, label }) => {
                const isActive = timeframe === key
                return (
                  <Link
                    key={key}
                    to={`/dashboard/reports?timeframe=${key}`}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors shrink-0 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>

            <Button variant="outline" size="sm" onClick={fetchMetricsAndHistory} title="Recargar">
              <RefreshCw className="w-4 h-4 text-slate-600" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Cargando estadísticas...
          </div>
        ) : metrics ? (
          <>
            {/* Main Operational Metrics Cards (Clean design, NO charts as requested) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Comensales que ingresaron */}
              <Card className="p-5 bg-white border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Ingresaron a Cola
                  </span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-3xl font-black text-slate-900 mt-2">{metrics.joined}</p>
                <p className="text-xs text-slate-400 mt-1">Total registrados en el período</p>
              </Card>

              {/* 2. Sentados */}
              <Card className="p-5 bg-white border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                    Sentados a Mesa
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-3xl font-black text-emerald-600 mt-2">{metrics.seated}</p>
                <p className="text-xs text-emerald-600/80 font-medium mt-1">
                  {metrics.seated_rate_percent}% de efectividad
                </p>
              </Card>

              {/* 3. Abandonos / Cancelados */}
              <Card className="p-5 bg-white border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                    Abandonos / Cancelados
                  </span>
                  <XCircle className="w-4 h-4 text-rose-600" />
                </div>
                <p className="text-3xl font-black text-rose-600 mt-2">
                  {metrics.left_without_sitting}
                </p>
                <p className="text-xs text-rose-600/80 font-medium mt-1">
                  {metrics.cancellation_rate_percent}% tasa de cancelación
                </p>
              </Card>

              {/* 4. No asistieron tras llamado */}
              <Card className="p-5 bg-white border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    No asistió al Llamado
                  </span>
                  <UserX className="w-4 h-4 text-slate-500" />
                </div>
                <p className="text-3xl font-black text-slate-800 mt-2">
                  {metrics.did_not_come_when_called}
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {metrics.no_show_rate_percent}% de inasistencia
                </p>
              </Card>
            </div>

            {/* Wait Times & Conversion Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5 bg-linear-to-br from-blue-50 to-indigo-50/40 border-blue-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Tiempo Promedio de Espera
                    </h3>
                    <p className="text-2xl font-black text-blue-900 mt-0.5">
                      {metrics.average_wait_minutes !== null ? `${metrics.average_wait_minutes} min` : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-3 border-t border-blue-100 pt-2">
                  Calculado para comensales que completaron su espera y fueron sentados.
                </p>
              </Card>

              <Card className="p-5 bg-white border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Tasa de Ocupación Exitosa
                    </h3>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">
                      {metrics.seated_rate_percent}%
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-3 border-t border-slate-100 pt-2">
                  Porcentaje de comensales que se quedaron y fueron ubicados en mesa.
                </p>
              </Card>

              <Card className="p-5 bg-white border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      En Atención Actual
                    </h3>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">
                      {metrics.currently_reserved + metrics.currently_called} en cola
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-3 border-t border-slate-100 pt-2">
                  {metrics.currently_reserved} en espera y {metrics.currently_called} llamados actualmente.
                </p>
              </Card>
            </div>

            {/* Resolved Queue History Table */}
            <Card className="border-slate-200 shadow-xs bg-white overflow-hidden">
              <CardHeader className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Historial de Turnos Atendidos
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registro de reservas completadas (sentadas, canceladas o no-show).
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {recentHistory.length} registros
                </span>
              </CardHeader>

              <CardContent className="p-0">
                {recentHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No hay turnos finalizados en el período seleccionado.
                  </div>
                ) : (
                  <>
                    {/* Mobile Card Layout for Resolved History */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {recentHistory.map((entry) => (
                        <div key={entry.id} className="p-4 space-y-2 bg-white">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-900 text-sm leading-tight">
                                {entry.customer_name}
                              </p>
                              <p className="text-xs text-slate-400 font-normal mt-0.5">
                                {entry.phone_number}
                              </p>
                            </div>
                            <Badge status={entry.status} />
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="font-semibold text-slate-800">{entry.party_size} pers.</span>
                            <span className="text-slate-500">
                              {parseUtcDate(entry.check_in_time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="font-medium text-blue-700">
                              {entry.wait_time_seconds !== null && entry.wait_time_seconds !== undefined
                                ? `Espera: ${Math.round(entry.wait_time_seconds / 60)} min`
                                : '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                            <th className="py-3 px-6">Comensal</th>
                            <th className="py-3 px-6">Personas</th>
                            <th className="py-3 px-6">Ingreso</th>
                            <th className="py-3 px-6">Tiempo Esperado</th>
                            <th className="py-3 px-6">Resultado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recentHistory.map((entry) => (
                            <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-6 font-semibold text-slate-900">
                                {entry.customer_name}
                                <span className="block text-xs text-slate-400 font-normal">
                                  {entry.phone_number}
                                </span>
                              </td>
                              <td className="py-3.5 px-6 text-slate-700">{entry.party_size} pers.</td>
                              <td className="py-3.5 px-6 text-xs text-slate-500">
                                {parseUtcDate(entry.check_in_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-3.5 px-6 text-xs font-medium text-slate-700">
                                {entry.wait_time_seconds !== null && entry.wait_time_seconds !== undefined
                                  ? `${Math.round(entry.wait_time_seconds / 60)} min`
                                  : '—'}
                              </td>
                              <td className="py-3.5 px-6">
                                <Badge status={entry.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  )
}
