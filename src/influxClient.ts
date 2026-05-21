export interface InfluxConfig {
  url: string
  org: string
  bucket: string
  token: string
  measurement: string
  tags: Record<string, string>
}

export interface InfluxRow {
  time: string
  sensor1?: number
  sensor2?: number
  sensor3?: number
  average?: number
  pump?: boolean
  valve?: boolean
  mode?: string
}

const parseTags = (raw: string) => {
  if (!raw) {
    return {}
  }

  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const [key, value] = pair.split('=')
      if (key && value) {
        acc[key.trim()] = value.trim()
      }
      return acc
    }, {})
}

const normalizeUrl = (url: string) => url.replace(/\/+$/, '')

export const getInfluxConfig = (): InfluxConfig => {
  const tags = parseTags(
    import.meta.env.VITE_INFLUX_TAGS ?? 'deviceId=esp32-01,location=greenhouse-a',
  )

  return {
    url: normalizeUrl(import.meta.env.VITE_INFLUX_URL ?? ''),
    org: import.meta.env.VITE_INFLUX_ORG ?? '',
    bucket: import.meta.env.VITE_INFLUX_BUCKET ?? 'soil_moisture',
    token: import.meta.env.VITE_INFLUX_TOKEN ?? '',
    measurement: import.meta.env.VITE_INFLUX_MEASUREMENT ?? 'soil_moisture',
    tags,
  }
}

export const canReadInflux = (config: InfluxConfig) =>
  Boolean(config.url && config.org && config.bucket && config.token)

const parseCsvLine = (line: string) => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
      continue
    }

    current += char
  }

  result.push(current)
  return result
}

const parseFluxCsv = (raw: string) => {
  const lines = raw.split(/\r?\n/).filter(Boolean)
  const dataLines = lines.filter((line) => !line.startsWith('#'))
  if (dataLines.length === 0) {
    return []
  }

  const header = parseCsvLine(dataLines[0])
  return dataLines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const record: Record<string, string> = {}
    header.forEach((key, index) => {
      record[key] = values[index] ?? ''
    })
    return record
  })
}

const toNumber = (value?: string) => {
  if (!value) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const toBoolean = (value?: string) => {
  if (!value) {
    return undefined
  }
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return undefined
}

const buildFluxQuery = (config: InfluxConfig) => {
  const tagFilters = Object.entries(config.tags)
    .map(([key, value]) => `r["${key}"] == "${value}"`)
    .join(' and ')

  const tagClause = tagFilters ? ` and ${tagFilters}` : ''

  return `from(bucket: "${config.bucket}")
  |> range(start: -6h)
  |> filter(fn: (r) => r._measurement == "${config.measurement}"${tagClause})
  |> filter(fn: (r) => r._field == "sensor1" or r._field == "sensor2" or r._field == "sensor3" or r._field == "average" or r._field == "pump" or r._field == "valve" or r._field == "mode")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> keep(columns: ["_time", "sensor1", "sensor2", "sensor3", "average", "pump", "valve", "mode"])
  |> sort(columns: ["_time"])
  |> tail(n: 20)
`
}

export const fetchInfluxHistory = async (config: InfluxConfig) => {
  if (!canReadInflux(config)) {
    throw new Error('InfluxDB config incomplete')
  }

  const response = await fetch(
    `${config.url}/api/v2/query?org=${encodeURIComponent(config.org)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.token}`,
        'Content-Type': 'application/vnd.flux',
        Accept: 'text/csv',
      },
      body: buildFluxQuery(config),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'InfluxDB query failed')
  }

  const csv = await response.text()
  const records = parseFluxCsv(csv)

  return records
    .map<InfluxRow>((record) => ({
      time: record._time,
      sensor1: toNumber(record.sensor1),
      sensor2: toNumber(record.sensor2),
      sensor3: toNumber(record.sensor3),
      average: toNumber(record.average),
      pump: toBoolean(record.pump),
      valve: toBoolean(record.valve),
      mode: record.mode || undefined,
    }))
    .filter((row) => row.time)
}
