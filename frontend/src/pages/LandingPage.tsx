import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import type { Branch } from '../types'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import {
  UtensilsCrossed,
  QrCode,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Users,
  Clock,
  Radio,
} from 'lucide-react'

export const LandingPage: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    api
      .listBranches()
      .then(setBranches)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-blue-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">Mesa247</span>
          </Link>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Acceso Staff / Host</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10 sm:space-y-14">
        <div className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Sistema Inteligente de Colas para Restaurantes
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Gestión de Filas Virtuales en Tiempo Real
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
            Los comensales escanean el código QR en la entrada de la sede, siguen su turno en vivo y reciben alertas instantáneas al momento de su llamado.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-white">Registro QR Sin Fricción</h2>
            <p className="text-xs text-slate-400">
              Sin descargas de apps. Ingreso instantáneo con nombre, celular y cantidad de personas.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-white">Sincronización en Vivo (SSE)</h2>
            <p className="text-xs text-slate-400">
              Número de orden animado en vivo y alertas en pantalla al ser llamado por el host.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-2 sm:col-span-2 md:col-span-1">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-white">Tiempos de Espera</h2>
            <p className="text-xs text-slate-400">
              Estimación de espera para el comensal y analíticas operativas del día para el staff.
            </p>
          </div>
        </div>

        {/* Branches Selection Section */}
        <div className="space-y-6 pt-2">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Sedes Disponibles</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Simula la lectura del código QR en cualquiera de nuestras sedes para unirte a la fila:
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Cargando sedes...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {branches.map((b) => (
                <Card
                  key={b.id}
                  className="bg-white/95 text-slate-900 border-white/20 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all flex flex-col justify-between"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-blue-100 text-blue-800">
                        {b.city}, {b.country}
                      </span>
                      <QrCode className="w-4 h-4 text-slate-400" />
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900">{b.name}</CardTitle>
                    <p className="text-xs text-slate-500 flex items-start gap-1 mt-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{b.full_address}</span>
                    </p>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-3">
                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        Atención en puerta
                      </span>
                      <span className="font-semibold text-emerald-600">Cola Activa</span>
                    </div>

                    {/* Semantic Link instead of button */}
                    <Link
                      to={`/branch/${b.id}/check-in`}
                      className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors shadow-md shadow-blue-500/20"
                    >
                      Escanear QR / Unirse a la Cola
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        Mesa247 • Solución de Colas para Restaurantes en LATAM
      </footer>
    </div>
  )
}
