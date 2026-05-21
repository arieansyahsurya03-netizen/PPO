export interface InfluxConfig {
  url: string
  org: string
  bucket: string
  token: string
  measurement: string
  tags: Record<string, string>
}

export interface InfluxSample {
  time: number
  sensor1: number
  sensor2: number
  sensor3: number
  average: number
  pump: boolean
  valve: boolean
  mode: string
}

const escapeKey = (value: string) => value.replace(/([ ,=])/g, '\\$1')

const escapeFieldValue = (value: string) =>
  `"${value.replace(/(["\\])/g, '\\$1')}"`

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

export const canWriteInflux = (config: InfluxConfig) =>
  Boolean(config.url && config.org && config.bucket && config.token)

const buildLineProtocol = (config: InfluxConfig, sample: InfluxSample) => {
  const tagEntries = Object.entries(config.tags)
  const tagPart = tagEntries.length
    ? ',' +
      tagEntries
        .map(([key, value]) =>
          `${escapeKey(key)}=${escapeKey(value)}`,
        )
        .join(',')
    : ''

  const fields: Record<string, number | boolean | string> = {
    sensor1: sample.sensor1,
    sensor2: sample.sensor2,
    sensor3: sample.sensor3,
    average: sample.average,
    pump: sample.pump,
    valve: sample.valve,
    mode: sample.mode,
  }

  const fieldPart = Object.entries(fields)
    .map(([key, value]) => {
      const fieldKey = escapeKey(key)
      if (typeof value === 'number') {
        return `${fieldKey}=${value.toFixed(2)}`
      }
      if (typeof value === 'boolean') {
        return `${fieldKey}=${value}`
      }
      return `${fieldKey}=${escapeFieldValue(value)}`
    })
    .join(',')

  return `${escapeKey(config.measurement)}${tagPart} ${fieldPart} ${sample.time}`
}

export const writeInfluxSample = async (
  config: InfluxConfig,
  sample: InfluxSample,
) => {
  if (!canWriteInflux(config)) {
    throw new Error('InfluxDB config incomplete')
  }

  const line = buildLineProtocol(config, sample)
  const response = await fetch(
    `${config.url}/api/v2/write?org=${encodeURIComponent(
      config.org,
    )}&bucket=${encodeURIComponent(config.bucket)}&precision=ms`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.token}`,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: line,
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'InfluxDB write failed')
  }
}
