import clsx from 'clsx'
import { useState } from 'react'
import { vehicleImageUrl } from '../../utils/format'

const TEINTES = ['#0B57D0', '#0F766E', '#B45309', '#7C3AED', '#BE123C', '#334155']

/** Illustration générique (aucune marque) quand le véhicule n'a pas encore de photo. */
function CarIllustration({ color }) {
  return (
    <svg viewBox="0 0 320 160" className="h-full w-full" role="img" aria-hidden>
      <ellipse cx="160" cy="132" rx="118" ry="10" fill="#0F1115" opacity=".08" />
      <path
        d="M44 112c0-10 6-18 16-21l30-9 26-26c6-6 14-9 22-9h46c9 0 17 4 23 10l24 25 33 7c11 2 19 12 19 23v8c0 5-4 9-9 9H53c-5 0-9-4-9-9v-8z"
        fill={color}
      />
      <path d="M125 60c4-4 9-6 15-6h20v29h-56l21-23zM172 54h14c6 0 11 2 15 6l22 23h-51V54z" fill="#E8F0FE" opacity=".95" />
      <rect x="226" y="98" width="20" height="7" rx="3.5" fill="#FDE68A" />
      <rect x="54" y="100" width="16" height="6" rx="3" fill="#FCA5A5" />
      {[100, 226].map((x) => (
        <g key={x}>
          <circle cx={x} cy="122" r="19" fill="#1F2937" />
          <circle cx={x} cy="122" r="9" fill="#D1D5DB" />
        </g>
      ))}
    </svg>
  )
}

export function VehicleImage({ vehicle, className, rounded = 'rounded-xl' }) {
  const [failed, setFailed] = useState(false)
  const src = vehicleImageUrl(vehicle?.image_url)
  const color = TEINTES[(vehicle?.id || 0) % TEINTES.length]
  return (
    <div className={clsx('relative overflow-hidden bg-gradient-to-br from-[#F3F6FC] to-[#E6EEFC]', rounded, className)}>
      {src && !failed ? (
        <img src={src} alt={`${vehicle.marque} ${vehicle.modele}`} loading="lazy" onError={() => setFailed(true)}
          className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-4">
          <CarIllustration color={color} />
        </div>
      )}
    </div>
  )
}
