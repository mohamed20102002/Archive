import React, { useRef, Suspense, useMemo, createContext, useContext } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

// Context for animation speed
const SpeedContext = createContext(1)

interface AtomBackgroundProps {
  speed?: number
}

// Animated particle sphere that mimics atom electron orbits
function ParticleAtom() {
  const ref = useRef<THREE.Points>(null)
  const orbitsRef = useRef<THREE.Group>(null)
  const speedMultiplier = useContext(SpeedContext)

  const nucleusParticles = useMemo(() => {
    const particles = new Float32Array(2500 * 3)
    for (let i = 0; i < 2500; i++) {
      const radius = Math.random() * 0.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      particles[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      particles[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      particles[i * 3 + 2] = radius * Math.cos(phi)
    }
    return particles
  }, [])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * 0.1 * speedMultiplier
      ref.current.rotation.y = state.clock.elapsedTime * 0.15 * speedMultiplier
    }
    if (orbitsRef.current) {
      orbitsRef.current.rotation.y = state.clock.elapsedTime * 0.2 * speedMultiplier
    }
  })

  return (
    <group>
      <Points ref={ref} positions={nucleusParticles} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#60a5fa"
          size={0.08}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
      <group ref={orbitsRef}>
        <ElectronOrbit radius={1.5} baseSpeed={1} tilt={0} color="#3b82f6" />
        <ElectronOrbit radius={2} baseSpeed={0.8} tilt={Math.PI / 3} color="#60a5fa" />
        <ElectronOrbit radius={2.5} baseSpeed={0.6} tilt={-Math.PI / 4} color="#93c5fd" />
      </group>
    </group>
  )
}

function ElectronOrbit({ radius, baseSpeed, tilt, color }: { radius: number; baseSpeed: number; tilt: number; color: string }) {
  const electronRef = useRef<THREE.Mesh>(null)
  const speedMultiplier = useContext(SpeedContext)

  const orbitParticles = useMemo(() => {
    const particles = new Float32Array(1000 * 3)
    for (let i = 0; i < 1000; i++) {
      const angle = (i / 1000) * Math.PI * 2
      particles[i * 3] = Math.cos(angle) * radius
      particles[i * 3 + 1] = 0
      particles[i * 3 + 2] = Math.sin(angle) * radius
    }
    return particles
  }, [radius])

  useFrame((state) => {
    const time = state.clock.elapsedTime * baseSpeed * speedMultiplier
    if (electronRef.current) {
      electronRef.current.position.x = Math.cos(time) * radius
      electronRef.current.position.z = Math.sin(time) * radius
    }
  })

  return (
    <group rotation={[tilt, 0, 0]}>
      <Points positions={orbitParticles} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color={color}
          size={0.02}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </Points>
      <mesh ref={electronRef}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

function BackgroundParticles({ count = 500 }) {
  const ref = useRef<THREE.Points>(null)
  const speedMultiplier = useContext(SpeedContext)

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20
    }
    return positions
  }, [count])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * 0.02 * speedMultiplier
      ref.current.rotation.y = state.clock.elapsedTime * 0.03 * speedMultiplier
    }
  })

  return (
    <Points ref={ref} positions={particles} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#6366f1"
        size={0.03}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

export function AtomBackground({ speed = 1 }: AtomBackgroundProps) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 60 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <SpeedContext.Provider value={speed}>
          <Suspense fallback={null}>
            <BackgroundParticles count={5000} />
          </Suspense>
        </SpeedContext.Provider>
      </Canvas>
    </div>
  )
}
