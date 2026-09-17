import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import type { User, Branch, UserRole } from '../../types'
import { Navbar } from '../../components/layout/Navbar'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Users, UserPlus, ShieldAlert, CheckCircle2, Store } from 'lucide-react'

export const UsersPage: React.FC = () => {
  const { user } = useAuth()

  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<number>(() => user?.branch_id || 1)
  const [usersList, setUsersList] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('host')
  const [branchId, setBranchId] = useState<number>(1)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [modalError, setModalError] = useState<string | null>(null)

  useEffect(() => {
    api.listBranches().then((list) => {
      setBranches(list)
      if (list.length > 0) {
        setBranchId(list[0].id)
      }
    })
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.listUsers()
      setUsersList(data)
    } catch (err) {
      console.error('Failed to load users', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)

    if (!name.trim() || !email.trim() || !password.trim()) {
      setModalError('Por favor completa todos los campos.')
      return
    }

    try {
      setSubmitting(true)
      await api.createUser({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        role,
        branch_id: branchId,
      })
      setShowAddModal(false)
      setName('')
      setEmail('')
      setPassword('')
      setRole('host')
      await fetchUsers()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Error al crear el usuario. Asegúrate de que el correo no esté duplicado.'
      setModalError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Role gate: Admin only
  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar
          branches={branches}
          currentBranchId={selectedBranchId}
          onSelectBranch={setSelectedBranchId}
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center p-8 space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <CardTitle>Acceso Restringido</CardTitle>
            <p className="text-xs text-slate-500">
              Solo los usuarios con rol de <strong>Administrador</strong> tienen permisos para gestionar y crear usuarios.
            </p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        branches={branches}
        currentBranchId={selectedBranchId}
        onSelectBranch={setSelectedBranchId}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              <span>Gestión de Usuarios y Personal</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Administra las cuentas autorizadas para Hosts, Managers y Administradores de Mesa247.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="shadow-sm"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Agregar Usuario
          </Button>
        </div>

        {/* Users Table Card */}
        <Card className="border-slate-200 shadow-xs bg-white overflow-hidden">
          <CardHeader className="p-5 border-b border-slate-100 flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900">
              Lista de Usuarios Registrados
            </CardTitle>
            <span className="text-xs font-semibold text-slate-400">
              {usersList.length} usuarios
            </span>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Cargando usuarios...
              </div>
            ) : usersList.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No hay usuarios registrados.</div>
            ) : (
              <>
                {/* Mobile Cards View */}
                <div className="md:hidden divide-y divide-slate-100">
                  {usersList.map((u) => {
                    const branch = branches.find((b) => b.id === u.branch_id)
                    return (
                      <div key={u.id} className="p-4 space-y-2.5 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">{u.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{u.email}</p>
                          </div>
                          <Badge role={u.role} />
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="flex items-center gap-1.5 font-medium text-slate-700">
                            <Store className="w-3.5 h-3.5 text-blue-600" />
                            {branch?.name || `Sede #${u.branch_id}`}
                          </span>
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Activo
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                        <th className="py-3.5 px-6">Nombre</th>
                        <th className="py-3.5 px-6">Email</th>
                        <th className="py-3.5 px-6">Rol</th>
                        <th className="py-3.5 px-6">Sede Asignada</th>
                        <th className="py-3.5 px-6">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usersList.map((u) => {
                        const branch = branches.find((b) => b.id === u.branch_id)
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-6 font-bold text-slate-900">{u.name}</td>
                            <td className="py-4 px-6 text-slate-600">{u.email}</td>
                            <td className="py-4 px-6">
                              <Badge role={u.role} />
                            </td>
                            <td className="py-4 px-6 text-slate-700 font-medium">
                              <span className="flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-slate-400" />
                                {branch?.name || `Sede #${u.branch_id}`}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Activo
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Crear Nuevo Usuario"
        description="Ingresa los datos para autorizar a un nuevo miembro del personal en Mesa247."
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-700">
              {modalError}
            </div>
          )}

          <Input
            label="Nombre Completo"
            placeholder="Ej. Lucía Morales"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Correo Electrónico"
            type="email"
            placeholder="lucia@mesa247.pe"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            {/* Role selection */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase">
                Rol
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="host">Host (Anfitrión de cola)</option>
                <option value="manager">Manager (Gerente de sede)</option>
                <option value="admin">Administrador General</option>
              </select>
            </div>

            {/* Branch selection */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase">
                Sede Asignada
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Guardar Usuario
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
