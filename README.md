# Mesa247 - Sistema de Gestión de Colas en Tiempo Real

Plataforma fullstack para la gestión inteligente y en tiempo real de colas de espera en restaurantes, diseñada para múltiples sedes en LATAM. Permite a los comensales registrarse escaneando un código QR en la entrada de la sede y seguir su turno en vivo desde sus dispositivos móviles, mientras que el personal del restaurante (Host / Manager) gestiona la cola, los llamados a mesa y las asignaciones mediante un dashboard sincronizado al instante vía Server-Sent Events (SSE).

---

## 🚀 Arquitectura y Tecnologías

### Backend
- **FastAPI** (Python 3.10+) con soporte asíncrono y streaming SSE nativo.
- **SQLModel & SQLAlchemy** para modelado ORM y consultas eficientes.
- **MySQL 8.4** para persistencia relacional transaccional.
- **PyJWT & Passlib (Bcrypt)** para autenticación segura basada en tokens JWT.
- **Pydantic v2** para validación de esquemas y serialización con soporte estricto de zonas horarias UTC.
- **Pytest** para suite de pruebas unitarias e integración.

### Frontend
- **React 19** con **TypeScript**.
- **Vite** para desarrollo ultrarrápido y empaquetado optimizado.
- **Tailwind CSS v4** con diseño moderno, componentes accesibles y animaciones fluidas.
- **React Router v7** para enrutamiento SPA y protección de rutas.
- **Axios** para consumo de API REST con interceptores de autenticación y manejo de errores.
- **Server-Sent Events (SSE)** mediante `EventSource` nativo para reactividad en vivo sin sobrecarga de polling.
- **Lucide React** para iconografía consistente.

---

## 📋 Funcionalidades Principales

### 1. Experiencia del Comensal (Sin Autenticación)
- **Registro por Código QR (`/branch/:branchId/check-in`)**: El comensal escanea el QR en la puerta de la sede y registra su nombre, celular, cantidad de personas en el grupo y notas especiales.
- **Pantalla de Estado en Vivo (`/branch/:branchId/queue/:entryId`)**:
  - Número de orden en tiempo real con animación elástica al avanzar la fila.
  - Indicador de comensales/grupos por delante y tiempo promedio/estimado de espera.
  - **Alerta de llamado**: Banner destacado cuando el host llama al comensal para que se acerque a recepción.
  - **Cancelación voluntaria**: Opción para que el comensal cancele su reserva de forma autónoma.

### 2. Gestión Operativa del Host (`/dashboard`)
- **Cola activa sincronizada en tiempo real** vía SSE: visualización instantánea de nuevos registros y cancelaciones.
- **Diseño completamente responsive**: Tabla optimizada para pantallas de escritorio y tarjetas táctiles para tablets y celulares.
- **Transiciones de estado con acciones según el flujo**:
  - `En Espera`: Botón para **Llamar** a mesa.
  - `Llamado`: Botón para **Sentar** (asigna mesa), **Volver a llamar** (re-notificación) o **No Asistió** (descarte por inasistencia).
- **Registro en puerta**: Modal para que el host ingrese comensales que llegan directamente a recepción.
- **Código QR de la sede**: Modal con QR generado dinámicamente y enlace directo para mostrar o imprimir.

### 3. Reportes y Analíticas de Sede (`/dashboard/reports`)
- Métricas operativas consolidadas: comensales ingresados, sentados, cancelaciones, inasistencias y tasas de conversión.
- Tiempos de espera promedio calculados con precisión histórica.
- Filtros temporales: **Hoy**, **Esta Semana**, **Este Mes** e **Histórico**.
- Historial detallado de reservas atendidas y cerradas.

---

## 🛠️ Requisitos Previos

Asegúrate de tener instaladas las siguientes herramientas:
- **Docker** y **Docker Compose**
- **Python 3.10** o superior
- **Node.js 18** o superior
- **pnpm** (recomendado) o `npm`

---

## ⚙️ Guía de Instalación y Ejecución Local

### Paso 1: Levantar la Base de Datos (MySQL)

El proyecto incluye una configuración de Docker Compose para levantar MySQL 8.4:

```bash
docker-compose up -d
```

Verifica que el contenedor esté corriendo:
```bash
docker ps
```

---

### Paso 2: Configurar y Ejecutar el Backend

1. Ingresa a la carpeta `backend`:
   ```bash
   cd backend
   ```

2. Crea y activa un entorno virtual de Python:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Instala las dependencias del proyecto:
   ```bash
   pip install -e .
   ```

4. Configura las variables de entorno (copia el archivo de ejemplo si no existe `.env`):
   ```bash
   cp ../.env.example .env
   ```

5. **Poblar la base de datos con el Seed**:
   El script creará las sedes (*La Terraza Azul*, *Cuatro Vientos*, *Casa Mediterránea*), los usuarios de prueba y datos históricos de colas:
   ```bash
   python -m src.seed_data
   ```

6. Inicia el servidor de desarrollo FastAPI:
   ```bash
   fastapi dev main.py --host 0.0.0.0 --port 8000
   ```

   El backend estará disponible en `http://localhost:8000`.
   - **Documentación Swagger interactiva**: `http://localhost:8000/docs`
   - **OpenAPI JSON**: `http://localhost:8000/openapi.json`

---

### Paso 3: Configurar y Ejecutar el Frontend

1. Abre una nueva terminal e ingresa a la carpeta `frontend`:
   ```bash
   cd frontend
   ```

2. Instala las dependencias con `pnpm`:
   ```bash
   pnpm install
   ```

3. Inicia el servidor de desarrollo Vite:
   ```bash
   pnpm dev
   ```

4. Abre tu navegador en:
   ```
   http://localhost:5173
   ```

---

## 🔐 Credenciales de Prueba (Staff)

El sistema cuenta con usuarios preconfigurados por rol para acceder al portal administrativo (`/login`):

| Rol | Correo Electrónico | Contraseña | Sede Asignada |
| :--- | :--- | :--- | :--- |
| **Host** | `host@mesa247.pe` | `host123` | La Terraza Azul (Lima) |
| **Manager** | `manager@mesa247.pe` | `manager123` | La Terraza Azul (Lima) |
| **Admin** | `admin@mesa247.pe` | `admin123` | Multi-sede global |

> **Tip:** En la pantalla de login dispones de botones de acceso rápido para rellenar las credenciales automáticamente con un solo clic.

---

## 🧪 Ejecución de Pruebas Automatizadas (Backend)

Para ejecutar la suite de pruebas unitarias y de integración con Pytest:

```bash
cd backend
source .venv/bin/activate
pytest
```

---

## 📌 Suposiciones y Consideraciones del Prototipo

1. **Internacionalización (i18n):**
   - Para este prototipo inicial la interfaz está en español y no incluye soporte multilenguaje, manteniendo la simplicidad del código.
2. **Notificaciones al comensal:**
   - En lugar de integración externa con WhatsApp/SMS, la alerta de turno se notifica en tiempo real directamente en la pantalla web del comensal (`/queue/:id`).
3. **Autenticación simplificada:**
   - La autenticación JWT está orientada al personal de sede (Admin, Manager, Host). Los comensales ingresan mediante enlaces generados por QR sin requerir creación de cuentas.
4. **Tolerancia y Re-llamados:**
   - Se permite re-notificar a un comensal en estado `Llamado` (`called` -> `called`) en caso de que no haya acudido al primer llamado, antes de marcarlo como `No Asistió`.
