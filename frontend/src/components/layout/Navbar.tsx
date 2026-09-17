import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import {
  UtensilsCrossed,
  BarChart3,
  Users,
  LogOut,
  QrCode,
  Store,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react'
import type { Branch } from '../../types'

interface NavbarProps {
  branches: Branch[]
  currentBranchId: number
  onSelectBranch: (branchId: number) => void
}

export const Navbar: React.FC<NavbarProps> = ({
  branches,
  currentBranchId,
  onSelectBranch,
}) => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [showQrModal, setShowQrModal] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentBranch = branches.find((b) => b.id === currentBranchId)
  const qrUrl = currentBranch
    ? `${window.location.origin}/branch/${currentBranch.id}/check-in`
    : ''

  const handleLogout = () => {
    setShowLogoutModal(false)
    setMobileMenuOpen(false)
    logout()
    navigate('/login')
  }

  const canSelectBranch = user?.role === 'admin' || user?.role === 'manager'

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Desktop Nav */}
            <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
              <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div className='sm:block hidden'>
                  <span className="text-lg font-extrabold text-slate-900 tracking-tight">Mesa247</span>
                </div>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center space-x-1">
                <Link
                  to="/dashboard"
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    location.pathname === '/dashboard'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  Cola en Vivo
                </Link>

                <Link
                  to="/dashboard/reports"
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    location.pathname === '/dashboard/reports'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Reportes del Día
                </Link>

                {user?.role === 'admin' && (
                  <Link
                    to="/dashboard/users"
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      location.pathname === '/dashboard/users'
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Usuarios
                  </Link>
                )}
              </nav>
            </div>

            {/* Branch Indicator & User Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Branch Selector: NEVER shown to Host, only shown to Admin / Manager */}
              {currentBranch && (
                canSelectBranch ? (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <select
                      value={currentBranchId}
                      onChange={(e) => onSelectBranch(Number(e.target.value))}
                      className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                      title="Cambiar sede de visualización"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.city})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800">
                    <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate max-w-30 sm:max-w-none">{currentBranch.name}</span>
                  </div>
                )
              )}

              {/* User badge & Logout */}
              <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-200">
                <div className="hidden lg:block text-right">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{user?.name}</p>
                  <Badge role={user?.role} className="text-[10px] py-0 px-1.5 mt-0.5" />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLogoutModal(true)}
                  className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-2"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>

              {/* Mobile menu hamburger button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Abrir menú de navegación"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-800">{user?.name}</p>
                <p className="text-[11px] text-slate-500">{user?.email}</p>
              </div>
              <Badge role={user?.role} className="text-[10px]" />
            </div>

            <div className="space-y-1">
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                  location.pathname === '/dashboard'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4 text-blue-600" />
                Cola en Vivo
              </Link>

              <Link
                to="/dashboard/reports"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                  location.pathname === '/dashboard/reports'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Reportes del Día
              </Link>

              {user?.role === 'admin' && (
                <Link
                  to="/dashboard/users"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                    location.pathname === '/dashboard/users'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4 text-blue-600" />
                  Usuarios
                </Link>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              {currentBranch && (
                <Link
                  to={`/branch/${currentBranch.id}/check-in`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 text-xs font-bold text-slate-700 hover:text-blue-700 transition-colors"
                >
                  <QrCode className="w-4 h-4 text-blue-600" />
                  <span>Abrir Registro QR de Sede</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              )}

              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setShowLogoutModal(true)
                }}
                className="w-full justify-center"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* QR Code Modal for Branch */}
      <Modal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        title={`Código QR - ${currentBranch?.name || 'Sede'}`}
        description="Muestra este QR en la entrada del restaurante o en tablets para que los comensales se registren a la cola."
      >
        <div className="flex flex-col items-center justify-center p-4 text-center space-y-4">
          <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-blue-300 shadow-inner flex flex-col items-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}`}
              alt="QR Code"
              className="w-48 h-48 rounded-lg shadow-sm"
            />
            <p className="text-xs font-bold text-slate-800 mt-4">{currentBranch?.name}</p>
            <p className="text-[11px] text-slate-500">{currentBranch?.full_address}</p>
          </div>

          <div className="w-full bg-slate-50 p-3 rounded-lg border border-slate-200 text-left">
            <p className="text-xs text-slate-500 font-semibold mb-1">Enlace directo para comensales:</p>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-sm break-all select-all">
                {qrUrl}
              </code>
              <a
                href={qrUrl}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-blue-600 transition-colors shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <a
              href={qrUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full text-center py-2.5 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Abrir como comensal
            </a>
            <Button
              variant="primary"
              className="w-full text-xs font-bold"
              onClick={() => window.print()}
            >
              Imprimir QR
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Logout */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Cerrar Sesión"
        description="Confirmación de salida del sistema"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            ¿Estás seguro de que deseas cerrar sesión? Tendrás que volver a ingresar tus credenciales para acceder a la plataforma.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowLogoutModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="md"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
