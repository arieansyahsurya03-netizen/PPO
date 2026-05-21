import { useEffect, useMemo, useState } from 'react'
import {
  Droplets,
  Gauge,
  Power,
  ToggleLeft,
  Wifi,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const SENSOR_KEYS = ['sensor1', 'sensor2', 'sensor3'] as const

type SensorKey = (typeof SENSOR_KEYS)[number]
type Mode = 'auto' | 'manual'

interface SensorSnapshot {
  time: string
  sensor1: number
  sensor2: number
  sensor3: number
  average: number
}

interface ActuatorState {
  pump: boolean
  valve: boolean
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const formatTimeLabel = (date: Date) =>
  date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

const nextSensorValue = (current: number) => {
  const drift = (Math.random() * 10 - 5) * 0.6
  return clamp(current + drift, 0, 100)
}

const getMoistureTone = (value: number) => {
  if (value < 30) {
    return {
      label: 'Dry',
      className: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
    }
  }
  if (value > 70) {
    return {
      label: 'Wet',
      className: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
    }
  }
  return {
    label: 'Optimal',
    className: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  }
}

const buildInitialHistory = (values: Record<SensorKey, number>) => {
  const now = Date.now()
  return Array.from({ length: 6 }, (_, index) => {
    const stamp = new Date(now - (5 - index) * 2000)
    const jitter = () => clamp(values.sensor1 + (Math.random() * 6 - 3), 0, 100)
    const sensor1 = jitter()
    const sensor2 = clamp(values.sensor2 + (Math.random() * 6 - 3), 0, 100)
    const sensor3 = clamp(values.sensor3 + (Math.random() * 6 - 3), 0, 100)
    const average = (sensor1 + sensor2 + sensor3) / 3

    return {
      time: formatTimeLabel(stamp),
      sensor1,
      sensor2,
      sensor3,
      average,
    }
  })
}

function App() {
  const [clock, setClock] = useState(new Date())
  const [isOnline] = useState(true)
  const [mode, setMode] = useState<Mode>('auto')
  const [actuators, setActuators] = useState<ActuatorState>({
    pump: false,
    valve: false,
  })
  const [sensorValues, setSensorValues] = useState<Record<SensorKey, number>>({
    sensor1: 46,
    sensor2: 52,
    sensor3: 61,
  })
  const [history, setHistory] = useState<SensorSnapshot[]>(() =>
    buildInitialHistory({
      sensor1: 46,
      sensor2: 52,
      sensor3: 61,
    }),
  )

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClock(new Date())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      // Update the sensor values first, then append a history point.
      setSensorValues((prev) => {
        const updated = {
          sensor1: nextSensorValue(prev.sensor1),
          sensor2: nextSensorValue(prev.sensor2),
          sensor3: nextSensorValue(prev.sensor3),
        }

        const now = new Date()
        const average = (updated.sensor1 + updated.sensor2 + updated.sensor3) / 3
        setHistory((prevHistory) => {
          const next = [
            ...prevHistory,
            {
              time: formatTimeLabel(now),
              ...updated,
              average,
            },
          ]

          return next.slice(-20)
        })

        return updated
      })
    }, 2000)

    return () => window.clearInterval(intervalId)
  }, [])

  const averageMoisture = useMemo(() => {
    const sum = sensorValues.sensor1 + sensorValues.sensor2 + sensorValues.sensor3
    return sum / 3
  }, [sensorValues])

  useEffect(() => {
    if (mode !== 'auto') {
      return
    }

    const pumpOn = averageMoisture < 35
    const valveOn = averageMoisture < 40
    setActuators({ pump: pumpOn, valve: valveOn })
  }, [averageMoisture, mode])

  const clockLabel = useMemo(
    () =>
      clock.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    [clock],
  )

  const toggleActuator = (key: keyof ActuatorState) => {
    if (mode !== 'manual') {
      return
    }

    setActuators((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const renderSensorCard = (label: string, value: number) => {
    const tone = getMoistureTone(value)

    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur">
        <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-slate-400">
          <span>{label}</span>
          <Droplets className="h-4 w-4 text-slate-300" />
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div className="text-3xl font-semibold text-white">
            {value.toFixed(0)}%
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone.className}`}
          >
            {tone.label}
          </span>
        </div>
      </div>
    )
  }

  const actuatorClass = (active: boolean) =>
    active
      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
      : 'border-slate-600/60 bg-slate-800/50 text-slate-300'

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 md:px-8">
        <header className="flex flex-col gap-6 rounded-3xl border border-slate-700/50 bg-slate-950/70 p-6 shadow-2xl shadow-black/40 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              IoT Monitoring Suite
            </p>
            <h1 className="text-3xl font-semibold text-white md:text-4xl">
              IoT Soil Moisture Monitoring
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
              {clockLabel}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm">
              <Wifi
                className={`h-4 w-4 ${
                  isOnline ? 'text-emerald-300' : 'text-rose-300'
                }`}
              />
              <span className="text-slate-200">
                {isOnline ? 'Online' : 'Offline'}
              </span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isOnline ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {renderSensorCard('Sensor 1', sensorValues.sensor1)}
          {renderSensorCard('Sensor 2', sensorValues.sensor2)}
          {renderSensorCard('Sensor 3', sensorValues.sensor3)}
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 shadow-lg shadow-black/20 backdrop-blur">
            <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-amber-200/70">
              <span>Average</span>
              <Gauge className="h-4 w-4 text-amber-200" />
            </div>
            <div className="mt-4 text-3xl font-semibold text-amber-100">
              {averageMoisture.toFixed(0)}%
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
          <div className="rounded-3xl border border-slate-700/60 bg-slate-950/70 p-6 shadow-xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Control & Actuators</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Mode
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setMode((prev) => (prev === 'auto' ? 'manual' : 'auto'))
              }
              className="mt-4 flex w-full items-center justify-between rounded-2xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500/70"
            >
              <div className="flex items-center gap-3">
                <ToggleLeft className="h-5 w-5 text-slate-300" />
                <span className="font-semibold capitalize">{mode}</span>
                <span className="text-xs text-slate-400">
                  {mode === 'auto'
                    ? 'Auto logic controls devices.'
                    : 'Manual override enabled.'}
                </span>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  mode === 'auto'
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : 'bg-amber-500/15 text-amber-200'
                }`}
              >
                {mode === 'auto' ? 'Auto' : 'Manual'}
              </span>
            </button>

            <div className="mt-6 space-y-4">
              <div
                role={mode === 'manual' ? 'button' : undefined}
                tabIndex={mode === 'manual' ? 0 : -1}
                onClick={() => toggleActuator('pump')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    toggleActuator('pump')
                  }
                }}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                  actuatorClass(actuators.pump)
                } ${
                  mode === 'manual'
                    ? 'cursor-pointer hover:border-emerald-400/80'
                    : 'cursor-not-allowed opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Power className="h-5 w-5" />
                  <span className="font-semibold">Pump</span>
                </div>
                <span className="text-sm">
                  {actuators.pump ? 'On' : 'Off'}
                </span>
              </div>

              <div
                role={mode === 'manual' ? 'button' : undefined}
                tabIndex={mode === 'manual' ? 0 : -1}
                onClick={() => toggleActuator('valve')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    toggleActuator('valve')
                  }
                }}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                  actuatorClass(actuators.valve)
                } ${
                  mode === 'manual'
                    ? 'cursor-pointer hover:border-emerald-400/80'
                    : 'cursor-not-allowed opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Power className="h-5 w-5" />
                  <span className="font-semibold">Solenoid Valve</span>
                </div>
                <span className="text-sm">
                  {actuators.valve ? 'On' : 'Off'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/60 bg-slate-950/70 p-6 shadow-xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Historical Trends</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Last 20 points
              </span>
            </div>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="4 6" stroke="#1f2937" />
                  <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#94a3b8"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: 12,
                    }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value) =>
                      typeof value === 'number'
                        ? `${value.toFixed(0)}%`
                        : `${value ?? ''}`
                    }
                  />
                  <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                  <Line
                    type="monotone"
                    dataKey="sensor1"
                    stroke="#7dd3fc"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sensor2"
                    stroke="#86efac"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sensor3"
                    stroke="#cbd5f5"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="#facc15"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
