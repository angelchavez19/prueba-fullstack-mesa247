import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { UtensilsCrossed, Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(email.trim(), password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Credenciales incorrectas o usuario inactivo.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail)
    setPassword(userPass)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/30">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Mesa247 Staff
          </h1>
          <p className="text-xs text-slate-300">
            Acceso operativo para Hosts, Managers y Administradores
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-700/60 shadow-2xl bg-white/95 backdrop-blur-md">
          <CardHeader className="p-6 pb-2 border-b border-slate-100">
            <CardTitle className="text-lg">Iniciar Sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales autorizadas para gestionar la cola de tu sede.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Input
                  label="Correo Electrónico"
                  type="email"
                  placeholder="ejemplo@mesa247.pe"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-9"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-8 pointer-events-none" />
              </div>

              <div className="relative">
                <Input
                  label="Contraseña"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-8 pointer-events-none" />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={loading}
                className="w-full mt-2 font-bold shadow-md shadow-blue-600/30"
              >
                Ingresar al Sistema
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>

            {/* Quick-fill Demo Credentials */}
            <div className="pt-4 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                Credenciales de Prueba (Click para autocompletar)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillCredentials('host@mesa247.pe', 'host123')}
                  className="p-2 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left transition-all cursor-pointer"
                >
                  <span className="block text-[11px] font-bold text-slate-800 items-center gap-1">
                    <UserCheck className="w-3 h-3 text-emerald-600" /> Host
                  </span>
                  <span className="block text-[9px] text-slate-500 truncate">host@mesa247.pe</span>
                </button>

                <button
                  type="button"
                  onClick={() => fillCredentials('manager@mesa247.pe', 'manager123')}
                  className="p-2 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left transition-all cursor-pointer"
                >
                  <span className="block text-[11px] font-bold text-slate-800 items-center gap-1">
                    <UserCheck className="w-3 h-3 text-blue-600" /> Manager
                  </span>
                  <span className="block text-[9px] text-slate-500 truncate">manager@mesa247.pe</span>
                </button>

                <button
                  type="button"
                  onClick={() => fillCredentials('admin@mesa247.pe', 'admin123')}
                  className="p-2 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left transition-all cursor-pointer"
                >
                  <span className="block text-[11px] font-bold text-slate-800 items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-purple-600" /> Admin
                  </span>
                  <span className="block text-[9px] text-slate-500 truncate">admin@mesa247.pe</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back to diner landing using semantic Link */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Volver a la vista para Comensales
          </Link>
        </div>
      </div>
    </div>
  )
}
