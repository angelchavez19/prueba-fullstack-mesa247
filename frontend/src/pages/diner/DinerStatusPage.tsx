import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../services/api'
import type { QueuePositionInfo, Branch } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import {
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MapPin,
  ArrowLeft,
  Calendar,
} from 'lucide-react'

export const DinerStatusPage: React.FC = () => {
  const { branchId, entryId } = useParams<{ branchId: string; entryId: string }>()


  const [position, setPosition] = useState<QueuePositionInfo | null>(null)
  const [branch, setBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [orderAnimating, setOrderAnimating] = useState<boolean>(false)
  const [orderChangedNotice, setOrderChangedNotice] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false)
  const [cancelling, setCancelling] = useState<boolean>(false)

  const prevOrderRef = useRef<number | null>(null)

  // Fetch initial info
  const fetchPosition = useCallback(async () => {
    if (!branchId || !entryId) return
    try {
      const pos = await api.getDinerPosition(Number(branchId), Number(entryId))
      setPosition(pos)
      if (prevOrderRef.current !== null && prevOrderRef.current !== pos.order_number) {
        const oldOrder = prevOrderRef.current
        setOrderAnimating(true)
        setTimeout(() => setOrderAnimating(false), 850)
        if (pos.order_number && oldOrder && pos.order_number < oldOrder) {
          const diff = oldOrder - pos.order_number
          setOrderChangedNotice(`¡Avanzaste ${diff} ${diff === 1 ? 'lugar' : 'lugares'} en la fila!`)
          setTimeout(() => setOrderChangedNotice(null), 4000)
        }
      }
      prevOrderRef.current = pos.order_number
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo encontrar tu turno en la cola.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [branchId, entryId])

  useEffect(() => {
    if (!branchId || !entryId) return
    api.getBranch(Number(branchId)).then(setBranch).catch(() => {})
    fetchPosition()
  }, [branchId, entryId, fetchPosition])

  // Setup SSE connection
  useEffect(() => {
    if (!branchId || !entryId) return

    const sseUrl = api.getDinerLiveStreamUrl(Number(branchId), Number(entryId))
    const eventSource = new EventSource(sseUrl)

    eventSource.addEventListener('queue_update', (event) => {
      try {
        const data: QueuePositionInfo = JSON.parse(event.data)
        setPosition(data)
        if (prevOrderRef.current !== null && prevOrderRef.current !== data.order_number) {
          const oldOrder = prevOrderRef.current
          setOrderAnimating(true)
          setTimeout(() => setOrderAnimating(false), 850)
          if (data.order_number && oldOrder && data.order_number < oldOrder) {
            const diff = oldOrder - data.order_number
            setOrderChangedNotice(`¡Avanzaste ${diff} ${diff === 1 ? 'lugar' : 'lugares'} en la fila!`)
            setTimeout(() => setOrderChangedNotice(null), 4000)
          }
        }
        prevOrderRef.current = data.order_number
      } catch (err) {
        console.error('Failed to parse SSE queue_update', err)
      }
    })

    eventSource.addEventListener('queue_closed', (event) => {
      try {
        const data: QueuePositionInfo = JSON.parse(event.data)
        setPosition(data)
      } catch (err) {
        console.error('Failed to parse SSE queue_closed', err)
      }
      eventSource.close()
    })

    eventSource.onerror = () => {
      // Fallback polling if SSE drops
      fetchPosition()
    }

    return () => {
      eventSource.close()
    }
  }, [branchId, entryId, fetchPosition])

  const handleCancelReservation = async () => {
    if (!branchId || !entryId) return
    try {
      setCancelling(true)
      await api.cancelDinerReservation(Number(branchId), Number(entryId))
      setShowCancelModal(false)
      fetchPosition()
    } catch {
      alert('No se pudo cancelar la reserva. Por favor intenta nuevamente.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Consultando tu lugar en la cola...</p>
        </div>
      </div>
    )
  }

  if (error || !position) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          <CardContent className="p-6 space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Reserva no encontrada</h2>
            <p className="text-xs text-slate-500">{error || 'No se encontró la reserva solicitada.'}</p>
            <Link
              to={`/branch/${branchId}/check-in`}
              className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
            >
              Registrarse de nuevo
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isCalled = position.status === 'called'
  const isSeated = position.status === 'seated'
  const isCancelled = position.status === 'cancelled'
  const isNoShow = position.status === 'no-show'
  const isWaiting = position.status === 'reserved'

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50/60 via-slate-50 to-white flex flex-col items-center justify-start p-4 py-8 sm:p-6">
      <div className="w-full max-w-md space-y-5">
        {/* Navigation & Sede */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Inicio
          </Link>
          <Badge status={position.status} className="font-bold" />
        </div>

        {/* Branch Info Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-slate-900">{branch?.name || 'Restaurante'}</h1>
          {branch?.full_address && (
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {branch.full_address}
            </p>
          )}
        </div>

        {/* SEATED STATE */}
        {isSeated && (
          <div className="bg-emerald-500 text-white rounded-2xl p-5 shadow-lg text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-full mx-auto">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold">¡Mesa Asignada!</h2>
            <p className="text-sm text-emerald-50 font-medium">
              ¡Que disfrutes tu visita en {branch?.name || 'nuestro restaurante'}!
            </p>
          </div>
        )}

        {/* CANCELLED STATE */}
        {isCancelled && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-5 text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-rose-100 rounded-full mx-auto">
              <XCircle className="w-6 h-6 text-rose-600" />
            </div>
            <h2 className="text-lg font-bold">Reserva Cancelada</h2>
            <p className="text-xs text-rose-600 font-medium">
              Tu turno en la cola fue cancelado. Si deseas volver a ingresar, escanea el código QR de la sede.
            </p>
            <Link
              to={`/branch/${branchId}/check-in`}
              className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-300 hover:bg-white text-xs font-bold text-slate-700 transition-colors shadow-xs"
            >
              Registrarse nuevamente
            </Link>
          </div>
        )}

        {/* NO SHOW STATE */}
        {isNoShow && (
          <div className="bg-slate-100 border border-slate-300 text-slate-700 rounded-2xl p-5 text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-200 rounded-full mx-auto">
              <AlertTriangle className="w-6 h-6 text-slate-500" />
            </div>
            <h2 className="text-lg font-bold">Turno Expirado</h2>
            <p className="text-xs text-slate-500 font-medium">
              Tu turno expiró por inasistencia al llamado. Por favor consulta con la recepción.
            </p>
          </div>
        )}

        {/* MAIN ORDER NUMBER CARD (When in Reserved or Called) */}
        {(isWaiting || isCalled) && (
          <Card className="border-slate-200 shadow-xl overflow-hidden text-center">
            <div className="relative bg-linear-to-br from-blue-600 via-indigo-600 to-blue-700 p-7 text-white overflow-hidden">
              {/* Subtle ambient lighting spheres */}
              <div className="absolute -top-12 -left-12 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-indigo-400/25 rounded-full blur-2xl pointer-events-none" />

              <p className="text-xs font-bold uppercase tracking-wider text-blue-100/90 relative z-10">
                {isCalled ? 'Estado actual' : 'Tu número de orden'}
              </p>

              {/* Enhanced animated live order number container */}
              <div className="relative my-3 flex flex-col items-center justify-center z-10 min-h-22.5">
                {orderAnimating && (
                  <span className="absolute w-32 h-32 rounded-full bg-white/30 animate-aura-glow pointer-events-none" />
                )}

                <div
                  key={isCalled ? 'called' : position.order_number}
                  className={`inline-flex items-center justify-center px-8 py-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-2xl transition-all duration-300 select-none ${
                    orderAnimating ? 'animate-number-pop ring-4 ring-white/30 shadow-white/40' : 'hover:scale-[1.02]'
                  }`}
                >
                  {isCalled ? (
                    <span className="inline-flex items-center gap-2.5 text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md uppercase">
                      ¡Es tu turno!
                    </span>
                  ) : (
                    <span className="text-6xl sm:text-7xl font-black tracking-tight text-white drop-shadow-md">
                      #{position.order_number ?? '—'}
                    </span>
                  )}
                </div>

                {/* Celebration notice when diner advances in queue */}
                {!isCalled && orderChangedNotice && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-400/25 border border-emerald-300/40 text-emerald-100 text-xs font-bold shadow-xs animate-in fade-in zoom-in-95 duration-200">
                    <span>▲ {orderChangedNotice}</span>
                  </div>
                )}
              </div>

              <p className="text-xs font-medium text-blue-100/90 relative z-10">
                Reserva a nombre de <strong className="text-white font-bold">{position.customer_name}</strong>
              </p>
            </div>

            <CardContent className="p-6 space-y-6">
              {/* People ahead & Party size */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center justify-center gap-1.5 text-blue-600 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase text-slate-500">Por delante</span>
                  </div>
                  <p className="text-xl font-extrabold text-slate-800">
                    {isCalled
                      ? '¡Te toca!'
                      : position.people_ahead === 0
                      ? '¡Eres el siguiente!'
                      : `${position.people_ahead} grupos`}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center justify-center gap-1.5 text-blue-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase text-slate-500">Mesa para</span>
                  </div>
                  <p className="text-xl font-extrabold text-slate-800">{position.party_size} pers.</p>
                </div>
              </div>

              {/* Wait Time Analytics */}
              <div className="p-4 bg-blue-50/80 border border-blue-100 rounded-xl text-left flex items-start gap-3">
                <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center shrink-0 shadow-xs">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    {isCalled ? 'Estado de Atención' : 'Tiempo de Espera Estimado'}
                  </h4>
                  <p className="text-sm font-semibold text-blue-700">
                    {isCalled
                      ? '¡Tu mesa está lista para ser asignada!'
                      : `~${position.estimated_wait_minutes ?? 15} minutos`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isCalled
                      ? 'Acércate al anfitrión en recepción para ingresar.'
                      : `Tiempo promedio histórico de la sede: ${position.average_wait_minutes ?? 15} min`}
                  </p>
                </div>
              </div>

              {/* Live sync indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Actualizado en vivo</span>
                <button
                  onClick={fetchPosition}
                  title="Refrescar"
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cancel Reservation Button */}
              {isWaiting && (
                <div className="pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                    onClick={() => setShowCancelModal(true)}
                  >
                    Cancelar mi reserva
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer Note */}
        {isWaiting && (
          <p className="text-center text-xs text-slate-400">
            Mantén esta pantalla abierta para enterarte al instante de cualquier cambio en la fila.
          </p>
        )}
      </div>

      {/* Confirmation Modal for Reservation Cancellation */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="¿Deseas cancelar tu reserva?"
        description="Si cancelas, perderás tu lugar en la fila y deberás registrarte nuevamente."
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Actualmente estás en el puesto <strong>#{position.order_number}</strong>. Esta acción no se puede deshacer.
            </span>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              No, mantener lugar
            </Button>
            <Button
              variant="destructive"
              isLoading={cancelling}
              onClick={handleCancelReservation}
            >
              Sí, cancelar reserva
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
