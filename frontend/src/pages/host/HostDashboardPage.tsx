import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import type { Branch, QueueEntry, QueueStatus } from '../../types'
import { Navbar } from '../../components/layout/Navbar'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import {
  Users,
  Megaphone,
  CheckCircle2,
  PhoneCall,
  UserX,
  UserPlus,
  Clock,
  RefreshCw,
  Info,
  Calendar,
  Phone,
  QrCode,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export const HostDashboardPage: React.FC = () => {
  const { user } = useAuth()

  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<number>(() => user?.branch_id || 1)
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now())

  // Track animation states for arrivals and cancellations
  const [newArrivalIds, setNewArrivalIds] = useState<Set<number>>(new Set())
  const [cancelledNotification, setCancelledNotification] = useState<string | null>(null)
  const previousEntriesRef = useRef<QueueEntry[]>([])

  // Modal for host manually adding a walk-in diner
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [newDinerName, setNewDinerName] = useState('')
  const [newDinerPhone, setNewDinerPhone] = useState('')
  const [newDinerParty, setNewDinerParty] = useState(2)
  const [newDinerNotes, setNewDinerNotes] = useState('')
  const [addingDiner, setAddingDiner] = useState(false)

  const currentBranch = branches.find((b) => b.id === selectedBranchId)

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

  // Update current time every 10 seconds for wait display
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [])

  // Fetch active queue
  const fetchQueue = useCallback(async () => {
    if (!selectedBranchId) return
    try {
      const allEntries = await api.listQueueEntries(selectedBranchId)
      // Active queue contains only reserved and called
      const active = allEntries.filter((e) => e.status === 'reserved' || e.status === 'called')
      setQueueEntries(active)
      previousEntriesRef.current = active
    } catch (err) {
      console.error('Failed to load queue', err)
    } finally {
      setLoading(false)
    }
  }, [selectedBranchId])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Real-time SSE listener
  useEffect(() => {
    if (!selectedBranchId) return

    const sseUrl = api.getBranchQueueStreamUrl(selectedBranchId)
    const eventSource = new EventSource(sseUrl)

    eventSource.addEventListener('queue_sync', (event) => {
      try {
        const incoming: QueueEntry[] = JSON.parse(event.data)
        const prevEntries = previousEntriesRef.current

        // Detect new arrivals
        if (prevEntries.length > 0) {
          const prevIds = new Set(prevEntries.map((e) => e.id))
          const freshArrivals = incoming.filter((e) => !prevIds.has(e.id)).map((e) => e.id)
          if (freshArrivals.length > 0) {
            setNewArrivalIds(new Set(freshArrivals))
            setTimeout(() => setNewArrivalIds(new Set()), 2000)
          }

          // Check if any diner was cancelled
          const incomingIds = new Set(incoming.map((e) => e.id))
          const removed = prevEntries.filter((e) => !incomingIds.has(e.id))
          if (removed.length > 0) {
            // Check if status changed to cancelled
            api.listQueueEntries(selectedBranchId, 'cancelled').then((cancelledList) => {
              const cancelledIds = new Set(cancelledList.map((c) => c.id))
              const cancelledItem = removed.find((r) => cancelledIds.has(r.id))
              if (cancelledItem) {
                setCancelledNotification(
                  `El comensal ${cancelledItem.customer_name} canceló su reserva en la cola.`
                )
                setTimeout(() => setCancelledNotification(null), 5000)
              }
            })
          }
        }

        previousEntriesRef.current = incoming
        setQueueEntries(incoming)
      } catch (err) {
        console.error('Error parsing queue_sync event', err)
      }
    })

    eventSource.onerror = () => {
      // Re-fetch in case of disconnect
      fetchQueue()
    }

    return () => {
      eventSource.close()
    }
  }, [selectedBranchId, fetchQueue])

  // Status transition handler
  const handleTransition = async (entryId: number, targetStatus: QueueStatus) => {
    try {
      setActionLoadingId(entryId)
      await api.updateQueueStatus(selectedBranchId, entryId, targetStatus)
      await fetchQueue()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo actualizar el estado.'
      alert(msg)
    } finally {
      setActionLoadingId(null)
    }
  }

  // Add diner manually (Walk-in)
  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDinerName.trim() || !newDinerPhone.trim()) return

    try {
      setAddingDiner(true)
      await api.checkInDiner(selectedBranchId, {
        customer_name: newDinerName.trim(),
        phone_number: newDinerPhone.trim(),
        party_size: newDinerParty,
        notes: newDinerNotes.trim() || undefined,
      })
      setShowAddModal(false)
      setNewDinerName('')
      setNewDinerPhone('')
      setNewDinerParty(2)
      setNewDinerNotes('')
      await fetchQueue()
    } catch {
      alert('Error al registrar comensal.')
    } finally {
      setAddingDiner(false)
    }
  }

  // Format time wait dynamically in minutes
  const formatWait = (checkInTime: string | null | undefined) => {
    if (!checkInTime) return '—'
    // Ensure UTC interpretation if timezone offset or Z is missing from DB
    let normalized = checkInTime
    if (!normalized.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(normalized)) {
      normalized = `${normalized}Z`
    }
    const checkInMs = new Date(normalized).getTime()
    if (isNaN(checkInMs)) return '—'
    const diff = Math.max(0, Math.floor((currentTime - checkInMs) / 60000))
    return `${diff} min`
  }

  const activeReserved = queueEntries.filter((e) => e.status === 'reserved')
  const activeCalled = queueEntries.filter((e) => e.status === 'called')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        branches={branches}
        currentBranchId={selectedBranchId}
        onSelectBranch={handleSelectBranch}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Sede & Quick Stats Summary (NO graphs, clean cards) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Gestión de Cola en Vivo</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-ping" />
                Tiempo Real
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de comensales en espera, llamados a mesa y asignaciones.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchQueue} title="Actualizar cola">
              <RefreshCw className="w-4 h-4 text-slate-600" />
            </Button>


            {/* Semantic Link to Public Diner Check-In / QR */}
            {currentBranch && (
              <Link
                to={`/branch/${currentBranch.id}/check-in`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-colors shadow-2xs"
                title="Abrir formulario QR de la sede en nueva pestaña"
              >
                <QrCode className="w-3.5 h-3.5 text-blue-600" />
                <span>Ver QR</span>
              </Link>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="shadow-sm"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Registrar en Puerta
            </Button>
          </div>
        </div>

        {/* Cancellation Notice Banner if someone cancelled */}
        {cancelledNotification && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between animate-row-cancel">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{cancelledNotification}</span>
            </div>
            <button
              onClick={() => setCancelledNotification(null)}
              className="text-rose-400 hover:text-rose-700 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Operational Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="p-4 bg-white border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total en Cola
              </span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">{queueEntries.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Grupos aguardando</p>
          </Card>

          <Card className="p-4 bg-white border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                En Espera
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-600 mt-1">{activeReserved.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Pendientes de llamado</p>
          </Card>

          <Card className="p-4 bg-white border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
                Llamados
              </span>
              <Megaphone className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-black text-purple-600 mt-1">{activeCalled.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Esperando en recepción</p>
          </Card>
        </div>

        {/* Live Queue Table Card */}
        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Lista de Comensales Activos
            </h2>
            <span className="text-xs text-slate-400">
              {queueEntries.length === 1 ? '1 grupo en cola' : `${queueEntries.length} grupos en cola`}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Cargando cola de la sede...
            </div>
          ) : queueEntries.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No hay comensales en la cola</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Los comensales que escaneen el código QR o que registres en puerta aparecerán aquí en tiempo real.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Cards View (Touch-friendly for hosts on phone/tablet) */}
              <div className="md:hidden divide-y divide-slate-100">
                {queueEntries.map((entry, index) => {
                  const isNewArrival = newArrivalIds.has(entry.id)
                  const isCalled = entry.status === 'called'
                  const isLoadingThis = actionLoadingId === entry.id

                  return (
                    <div
                      key={entry.id}
                      className={`p-4 space-y-3 transition-colors ${
                        isNewArrival ? 'animate-row-arrival' : ''
                      } ${isCalled ? 'bg-purple-50/50' : 'bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-xl font-black text-sm ${
                              isCalled
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            #{index + 1}
                          </span>
                          <div>
                            <p className="font-bold text-slate-900 text-base leading-tight">
                              {entry.customer_name}
                            </p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {entry.phone_number}
                            </p>
                          </div>
                        </div>
                        <Badge status={entry.status} />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          <span>{entry.party_size} pers.</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Espera: {formatWait(entry.check_in_time)}</span>
                        </div>
                      </div>

                      {entry.notes && (
                        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 p-2 rounded-lg">
                          Nota: {entry.notes}
                        </p>
                      )}

                      {/* Touch-friendly actions for mobile */}
                      <div className="pt-1 flex flex-col gap-2">
                        {entry.status === 'reserved' && (
                          <Button
                            variant="primary"
                            size="md"
                            isLoading={isLoadingThis}
                            onClick={() => handleTransition(entry.id, 'called')}
                            className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-sm font-bold shadow-xs py-2.5"
                          >
                            <PhoneCall className="w-4 h-4 mr-2" />
                            Llamar a Mesa
                          </Button>
                        )}

                        {entry.status === 'called' && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Button
                              variant="success"
                              size="md"
                              isLoading={isLoadingThis}
                              onClick={() => handleTransition(entry.id, 'seated')}
                              className="w-full justify-center text-xs font-bold py-2.5"
                              title="Asignar mesa al comensal"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                              Sentar
                            </Button>

                            <Button
                              variant="outline"
                              size="md"
                              isLoading={isLoadingThis}
                              onClick={() => handleTransition(entry.id, 'called')}
                              className="w-full justify-center text-purple-700 border-purple-200 hover:bg-purple-50 text-xs font-bold py-2.5"
                              title="Re-notificar llamada"
                            >
                              <Megaphone className="w-3.5 h-3.5 mr-1.5" />
                              Volver a llamar
                            </Button>

                            <Button
                              variant="destructive"
                              size="md"
                              isLoading={isLoadingThis}
                              onClick={() => handleTransition(entry.id, 'no-show')}
                              className="w-full justify-center text-xs font-bold py-2.5"
                              title="Descartar comensal por inasistencia (NO_SHOW)"
                            >
                              <UserX className="w-3.5 h-3.5 mr-1.5" />
                              No Asistió
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      <th className="py-3.5 px-6">Orden</th>
                      <th className="py-3.5 px-6">Comensal</th>
                      <th className="py-3.5 px-6">Personas</th>
                      <th className="py-3.5 px-6">Espera</th>
                      <th className="py-3.5 px-6">Estado</th>
                      <th className="py-3.5 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {queueEntries.map((entry, index) => {
                      const isNewArrival = newArrivalIds.has(entry.id)
                      const isCalled = entry.status === 'called'
                      const isLoadingThis = actionLoadingId === entry.id

                      return (
                        <tr
                          key={entry.id}
                          className={`transition-colors hover:bg-slate-50/80 ${
                            isNewArrival ? 'animate-row-arrival' : ''
                          } ${isCalled ? 'bg-purple-50/40' : ''}`}
                        >
                          {/* Order Number */}
                          <td className="py-4 px-6 font-bold text-slate-900">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm ${
                                isCalled
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              #{index + 1}
                            </span>
                          </td>

                          {/* Diner Name & Phone & Notes */}
                          <td className="py-4 px-6">
                            <div>
                              <span className="font-bold text-slate-900 block leading-tight">
                                {entry.customer_name}
                              </span>
                              <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {entry.phone_number}
                              </span>
                              {entry.notes && (
                                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-sm inline-block mt-1">
                                  {entry.notes}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Party Size (Exact format: "5 pers.") */}
                          <td className="py-4 px-6 font-semibold text-slate-800">
                            {entry.party_size} pers.
                          </td>

                          {/* Wait Time */}
                          <td className="py-4 px-6 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {formatWait(entry.check_in_time)}
                            </span>
                          </td>

                          {/* Status Badge in Spanish */}
                          <td className="py-4 px-6">
                            <Badge status={entry.status} />
                          </td>

                          {/* Dynamic Actions based on status */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                              {/* State: RESERVED -> Action: LLAMAR */}
                              {entry.status === 'reserved' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  isLoading={isLoadingThis}
                                  onClick={() => handleTransition(entry.id, 'called')}
                                  className="bg-blue-600 hover:bg-blue-700 shadow-xs"
                                >
                                  <PhoneCall className="w-3.5 h-3.5 mr-1" />
                                  Llamar
                                </Button>
                              )}

                              {/* State: CALLED -> Actions: SENTAR, VOLVER A LLAMAR, NO_SHOW */}
                              {entry.status === 'called' && (
                                <>
                                  <Button
                                    variant="success"
                                    size="sm"
                                    isLoading={isLoadingThis}
                                    onClick={() => handleTransition(entry.id, 'seated')}
                                    title="Asignar mesa (desaparece de la cola)"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    Sentar
                                  </Button>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    isLoading={isLoadingThis}
                                    onClick={() => handleTransition(entry.id, 'called')}
                                    title="Re-notificar llamada"
                                    className="text-purple-700 border-purple-200 hover:bg-purple-50"
                                  >
                                    <Megaphone className="w-3.5 h-3.5 mr-1" />
                                    Volver a llamar
                                  </Button>

                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    isLoading={isLoadingThis}
                                    onClick={() => handleTransition(entry.id, 'no-show')}
                                    title="Descartar manualmente por inasistencia (NO_SHOW)"
                                  >
                                    <UserX className="w-3.5 h-3.5 mr-1" />
                                    No Asistió
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </main>

      {/* Manual Diner Registration Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Registrar Comensal en Puerta (Walk-in)"
        description="Ingresa los datos del comensal que acaba de llegar físicamente al restaurante."
      >
        <form onSubmit={handleAddWalkIn} className="space-y-4">
          <Input
            label="Nombre del Comensal"
            placeholder="Ej. Carlos Mendoza"
            value={newDinerName}
            onChange={(e) => setNewDinerName(e.target.value)}
            required
          />

          <Input
            label="Número de Celular"
            placeholder="Ej. +51987654321"
            type="tel"
            value={newDinerPhone}
            onChange={(e) => setNewDinerPhone(e.target.value)}
            required
          />

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase">
              Número de personas
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => setNewDinerParty((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  -
                </button>
                <span className="px-4 py-2 text-sm font-bold text-slate-800 min-w-12 text-center bg-slate-50">
                  {newDinerParty}
                </span>
                <button
                  type="button"
                  onClick={() => setNewDinerParty((p) => Math.min(20, p + 1))}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>{newDinerParty} pers.</span>
              </div>
            </div>
          </div>

          <Input
            label="Observaciones"
            placeholder="Ej. Mesa en terraza"
            value={newDinerNotes}
            onChange={(e) => setNewDinerNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={addingDiner}>
              Registrar Comensal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
