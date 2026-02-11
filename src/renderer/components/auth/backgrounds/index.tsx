import React from 'react'
import { AtomBackground } from './AtomBackground'
import { ParticlesBackground } from './ParticlesBackground'
import { DNABackground } from './DNABackground'
import { WaveGridBackground } from './WaveGridBackground'
import { GalaxyBackground } from './GalaxyBackground'
import { FissionBackground } from './FissionBackground'
import { NeuralBackground } from './NeuralBackground'
import { MatrixBackground } from './MatrixBackground'

export type BackgroundStyle = 'atom' | 'particles' | 'dna' | 'wave' | 'galaxy' | 'fission' | 'neural' | 'matrix' | 'none'

export const BACKGROUND_OPTIONS: { value: BackgroundStyle; label: string; description: string }[] = [
  { value: 'atom', label: 'Atom', description: 'Animated atomic structure with orbiting electrons' },
  { value: 'particles', label: 'Particles', description: 'Floating colorful particles with connections' },
  { value: 'dna', label: 'DNA Helix', description: 'Rotating double helix DNA structure' },
  { value: 'wave', label: 'Wave Grid', description: 'Animated wave interference pattern' },
  { value: 'galaxy', label: 'Galaxy', description: 'Spiral galaxy with stars and shooting stars' },
  { value: 'fission', label: 'Fission', description: 'U-235 nuclear fission chain reaction' },
  { value: 'neural', label: 'Neural Net', description: 'Animated neural network with signal pulses' },
  { value: 'matrix', label: 'Matrix', description: 'Matrix-style digital rain effect' },
  { value: 'none', label: 'None', description: 'Simple gradient background without animation' },
]

interface LoginBackgroundProps {
  style?: BackgroundStyle
  speed?: number
}

export function LoginBackground({ style = 'atom', speed = 1 }: LoginBackgroundProps) {
  switch (style) {
    case 'atom':
      return <AtomBackground speed={speed} />
    case 'particles':
      return <ParticlesBackground speed={speed} />
    case 'dna':
      return <DNABackground speed={speed} />
    case 'wave':
      return <WaveGridBackground speed={speed} />
    case 'galaxy':
      return <GalaxyBackground speed={speed} />
    case 'fission':
      return <FissionBackground speed={speed} />
    case 'neural':
      return <NeuralBackground speed={speed} />
    case 'matrix':
      return <MatrixBackground speed={speed} />
    case 'none':
      return <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950" />
    default:
      return <AtomBackground speed={speed} />
  }
}

export { AtomBackground } from './AtomBackground'
export { ParticlesBackground } from './ParticlesBackground'
export { DNABackground } from './DNABackground'
export { WaveGridBackground } from './WaveGridBackground'
export { GalaxyBackground } from './GalaxyBackground'
export { FissionBackground } from './FissionBackground'
export { NeuralBackground } from './NeuralBackground'
export { MatrixBackground } from './MatrixBackground'
