import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../../services/api'
import type { Branch } from '../../types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Utensils, Users, Phone, User, MapPin, ArrowRight, Sparkles } from 'lucide-react'

export const DinerCheckInPage: React.FC = () => {
  const { branchId } = useParams<{ branchId: string }>()
  const navigate = useNavigate()

  const [branch, setBranch] = useState<Branch | null>(null)
  const [loadingBranch, setLoadingBranch] = useState<boolean>(true)
  const [errorBranch, setErrorBranch] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [partySize, setPartySize] = useState<number>(2)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!branchId) return
    setLoadingBranch(true)
    api
      .getBranch(Number(branchId))
      .then((data) => setBranch(data))
      .catch(() => setErrorBranch('No se pudo cargar la información de la sede.'))
      .finally(() => setLoadingBranch(false))
  }, [branchId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError('Por favor ingresa tu nombre completo.')
      return
    }
    if (!phone.trim() || phone.trim().length < 6) {
      setFormError('Por favor ingresa un número de celular válido.')
      return
    }
    if (partySize < 1) {
      setFormError('La cantidad de personas debe ser al menos 1.')
      return
    }

    try {
      setSubmitting(true)
      const entry = await api.checkInDiner(Number(branchId), {
        customer_name: name.trim(),
        phone_number: phone.trim(),
        party_size: partySize,
        notes: notes.trim() || undefined,
      })
      navigate(`/branch/${branchId}/queue/${entry.id}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Ocurrió un error al ingresar a la cola. Por favor intenta nuevamente.'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingBranch) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Cargando sede...</p>
        </div>
      </div>
    )
  }

  if (errorBranch || !branch) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <MapPin className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg">Sede no encontrada</CardTitle>
          <CardDescription>{errorBranch || 'La sede solicitada no existe o no está disponible.'}</CardDescription>
          <Link
            to="/"
            className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
          >
            Ver sedes disponibles
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50/50 via-slate-50 to-white flex flex-col items-center justify-center p-4 py-8 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Navigation link */}
        <div className="flex items-center justify-start">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Volver a Sedes
          </Link>
        </div>

        {/* Brand & Sede Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Mesa247 • Fila Virtual
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {branch.name}
          </h1>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span>{branch.full_address}</span>
          </div>
        </div>

        {/* Check-in Form Card */}
        <Card className="border-slate-200/90 shadow-xl shadow-slate-200/40 backdrop-blur-xs">
          <CardHeader className="bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-t-xl p-5 border-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center">
                <Utensils className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-base font-bold">Únete a la Cola</CardTitle>
                <p className="text-blue-100 text-xs mt-0.5">
                  Ingresa tus datos para asignarte un lugar y notificarte cuando tu mesa esté lista.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-700">
                  {formError}
                </div>
              )}

              {/* Customer Name */}
              <div>
                <div className="relative">
                  <Input
                    label="Nombre Completo"
                    placeholder="Ej. Mateo Rossi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="pl-9"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-8 pointer-events-none" />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <div className="relative">
                  <Input
                    label="Número de Celular"
                    placeholder="Ej. 999 888 777"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="pl-9"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-8 pointer-events-none" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Te avisaremos en la pantalla de tu teléfono cuando sea tu turno.
                </p>
              </div>

              {/* Party Size (Number of people) */}
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase">
                  ¿Cuántas personas vienen?
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-xs">
                    <button
                      type="button"
                      onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                      className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-4 py-2 text-sm font-bold text-slate-800 min-w-12 text-center bg-slate-50">
                      {partySize}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPartySize((p) => Math.min(20, p + 1))}
                      className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>{partySize === 1 ? '1 persona' : `${partySize} personas`}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Input
                  label="Notas u observaciones (opcional)"
                  placeholder="Ej. Silla de bebé, mesa en terraza"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={submitting}
                className="w-full mt-2 text-base font-bold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/25"
              >
                Ingresar a la Cola
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400">
          Al unirte a la fila virtual de Mesa247 podrás seguir tu turno en tiempo real desde tu dispositivo móvil.
        </p>
      </div>
    </div>
  )
}
