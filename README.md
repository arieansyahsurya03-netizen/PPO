# IoT Soil Moisture Monitoring Dashboard

Single-page dashboard for simulated soil moisture monitoring using React, TypeScript, Tailwind CSS, Recharts, and lucide-react.

## Features

- Real-time clock and connection status
- Three simulated soil moisture sensors with dynamic thresholds
- Auto and manual control modes for pump and solenoid valve indicators
- Historical chart with the last 20 data points

## Scripts

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

## Notes

Dummy sensor values update every 2 seconds to mimic real device behavior.

## InfluxDB Live Data

The dashboard reads sensor data directly from InfluxDB. Copy `.env.example` to `.env` and fill in the values.

Required values:

- VITE_INFLUX_URL
- VITE_INFLUX_ORG
- VITE_INFLUX_BUCKET
- VITE_INFLUX_TOKEN

Optional values (defaults shown in `.env.example`):

- VITE_INFLUX_MEASUREMENT
- VITE_INFLUX_TAGS

Bucket and tags used by default:

- Bucket: `soil_moisture`
- Measurement: `soil_moisture`
- Tags: `deviceId=esp32-01`, `location=greenhouse-a`

Create the bucket in your InfluxDB UI and use an API token with read access. For production, do not expose tokens in the browser. Use a backend proxy instead.
