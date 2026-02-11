import React, { useRef, Suspense, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

interface FissionBackgroundProps {
  speed?: number
}

// Uranium-235 Nucleus
function Uranium235({ onFission, speed = 1 }: { onFission: () => void; speed: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const nucleusRef = useRef<THREE.Points>(null)
  const [fissioning, setFissioning] = useState(false)
  const [fissionProgress, setFissionProgress] = useState(0)
  const fissionTimeRef = useRef(0)

  // Create nucleus particles (protons and neutrons)
  const { protons, neutrons } = useMemo(() => {
    const protonCount = 92 // U-235 has 92 protons
    const neutronCount = 143 // U-235 has 143 neutrons

    const protons = new Float32Array(protonCount * 3)
    const neutrons = new Float32Array(neutronCount * 3)

    // Arrange protons in a sphere
    for (let i = 0; i < protonCount; i++) {
      const radius = 0.8 + Math.random() * 0.3
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      protons[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      protons[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      protons[i * 3 + 2] = radius * Math.cos(phi)
    }

    // Arrange neutrons
    for (let i = 0; i < neutronCount; i++) {
      const radius = 0.7 + Math.random() * 0.4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      neutrons[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      neutrons[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      neutrons[i * 3 + 2] = radius * Math.cos(phi)
    }

    return { protons, neutrons }
  }, [])

  useFrame((state, delta) => {
    if (groupRef.current && !fissioning) {
      groupRef.current.rotation.x += delta * 0.2 * speed
      groupRef.current.rotation.y += delta * 0.3 * speed

      // Slight pulsing effect
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2 * speed) * 0.05
      groupRef.current.scale.setScalar(pulse)
    }

    if (fissioning) {
      fissionTimeRef.current += delta * speed
      const progress = Math.min(fissionTimeRef.current / 2, 1) // 2 seconds for fission
      setFissionProgress(progress)

      if (progress >= 1) {
        setFissioning(false)
        fissionTimeRef.current = 0
        setFissionProgress(0)
        onFission()
      }
    }
  })

  // Trigger fission periodically
  useFrame((state) => {
    if (!fissioning && Math.floor(state.clock.elapsedTime * speed) % 8 === 0 &&
        state.clock.elapsedTime * speed % 8 < 0.1) {
      setFissioning(true)
    }
  })

  if (fissioning) {
    return <FissionEffect progress={fissionProgress} protons={protons} neutrons={neutrons} />
  }

  return (
    <group ref={groupRef}>
      {/* Protons (red) */}
      <Points positions={protons} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#ef4444"
          size={0.12}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
      {/* Neutrons (blue) */}
      <Points positions={neutrons} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#3b82f6"
          size={0.1}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
      {/* Glow effect */}
      <mesh>
        <sphereGeometry args={[1.3, 32, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.15} />
      </mesh>
      {/* Label */}
      <mesh position={[0, -1.8, 0]}>
        <planeGeometry args={[1.5, 0.4]} />
        <meshBasicMaterial color="#1e293b" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// Fission effect when nucleus splits
function FissionEffect({ progress, protons, neutrons }: { progress: number; protons: Float32Array; neutrons: Float32Array }) {
  const leftGroupRef = useRef<THREE.Group>(null)
  const rightGroupRef = useRef<THREE.Group>(null)
  const energyRef = useRef<THREE.Group>(null)

  // Split particles into two groups (Barium-141 and Krypton-92)
  const { leftProtons, leftNeutrons, rightProtons, rightNeutrons, freeNeutrons } = useMemo(() => {
    const leftProtonCount = 56 // Barium
    const rightProtonCount = 36 // Krypton
    const leftNeutronCount = 85
    const rightNeutronCount = 55
    const freeNeutronCount = 3 // Released neutrons

    const leftProtons = new Float32Array(leftProtonCount * 3)
    const rightProtons = new Float32Array(rightProtonCount * 3)
    const leftNeutrons = new Float32Array(leftNeutronCount * 3)
    const rightNeutrons = new Float32Array(rightNeutronCount * 3)
    const freeNeutrons = new Float32Array(freeNeutronCount * 3)

    // Copy and rearrange particles
    for (let i = 0; i < leftProtonCount; i++) {
      const radius = 0.5 + Math.random() * 0.2
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      leftProtons[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      leftProtons[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      leftProtons[i * 3 + 2] = radius * Math.cos(phi)
    }

    for (let i = 0; i < rightProtonCount; i++) {
      const radius = 0.4 + Math.random() * 0.2
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      rightProtons[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      rightProtons[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      rightProtons[i * 3 + 2] = radius * Math.cos(phi)
    }

    for (let i = 0; i < leftNeutronCount; i++) {
      const radius = 0.4 + Math.random() * 0.3
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      leftNeutrons[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      leftNeutrons[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      leftNeutrons[i * 3 + 2] = radius * Math.cos(phi)
    }

    for (let i = 0; i < rightNeutronCount; i++) {
      const radius = 0.35 + Math.random() * 0.2
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      rightNeutrons[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      rightNeutrons[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      rightNeutrons[i * 3 + 2] = radius * Math.cos(phi)
    }

    // Free neutrons shoot out
    for (let i = 0; i < freeNeutronCount; i++) {
      const angle = (i / freeNeutronCount) * Math.PI * 2 + Math.PI / 6
      freeNeutrons[i * 3] = Math.cos(angle) * 0.2
      freeNeutrons[i * 3 + 1] = Math.sin(angle) * 0.2
      freeNeutrons[i * 3 + 2] = 0
    }

    return { leftProtons, leftNeutrons, rightProtons, rightNeutrons, freeNeutrons }
  }, [])

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
  const easedProgress = easeOutCubic(progress)

  // Separation distance
  const separation = easedProgress * 4

  // Energy wave expansion
  const energyScale = easedProgress * 8
  const energyOpacity = Math.max(0, 1 - progress * 1.5)

  return (
    <group>
      {/* Left fragment (Barium-141) */}
      <group ref={leftGroupRef} position={[-separation, easedProgress * 0.5, 0]} rotation={[0, 0, easedProgress * 0.5]}>
        <Points positions={leftProtons} stride={3} frustumCulled={false}>
          <PointMaterial transparent color="#ef4444" size={0.12} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
        </Points>
        <Points positions={leftNeutrons} stride={3} frustumCulled={false}>
          <PointMaterial transparent color="#3b82f6" size={0.1} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
        </Points>
        <mesh>
          <sphereGeometry args={[0.8, 32, 32]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.1} />
        </mesh>
      </group>

      {/* Right fragment (Krypton-92) */}
      <group ref={rightGroupRef} position={[separation, -easedProgress * 0.5, 0]} rotation={[0, 0, -easedProgress * 0.5]}>
        <Points positions={rightProtons} stride={3} frustumCulled={false}>
          <PointMaterial transparent color="#ef4444" size={0.1} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
        </Points>
        <Points positions={rightNeutrons} stride={3} frustumCulled={false}>
          <PointMaterial transparent color="#3b82f6" size={0.08} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
        </Points>
        <mesh>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.1} />
        </mesh>
      </group>

      {/* Free neutrons shooting out */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2 + Math.PI / 6
        const distance = easedProgress * 6
        return (
          <mesh key={i} position={[Math.cos(angle) * distance, Math.sin(angle) * distance, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={1 - progress * 0.5} />
          </mesh>
        )
      })}

      {/* Energy release waves */}
      <group ref={energyRef}>
        {[0, 0.2, 0.4].map((delay, i) => {
          const waveProgress = Math.max(0, progress - delay)
          const waveScale = waveProgress * 8
          const waveOpacity = Math.max(0, 0.4 - waveProgress * 0.8)
          return (
            <mesh key={i} scale={[waveScale, waveScale, waveScale]}>
              <ringGeometry args={[0.8, 1, 32]} />
              <meshBasicMaterial color="#fbbf24" transparent opacity={waveOpacity} side={THREE.DoubleSide} />
            </mesh>
          )
        })}
      </group>

      {/* Bright flash */}
      <mesh scale={[1 + progress * 2, 1 + progress * 2, 1]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={Math.max(0, 0.8 - progress * 2)} />
      </mesh>

      {/* Gamma rays */}
      {progress > 0.1 && progress < 0.8 && (
        <group>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2
            const length = (progress - 0.1) * 10
            return (
              <mesh key={i} position={[0, 0, 0]} rotation={[0, 0, angle]}>
                <boxGeometry args={[length, 0.02, 0.02]} />
                <meshBasicMaterial color="#fef08a" transparent opacity={0.6 - progress * 0.5} />
              </mesh>
            )
          })}
        </group>
      )}
    </group>
  )
}

// Incoming neutron that triggers fission
function IncomingNeutron({ speed = 1 }: { speed: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const trailRef = useRef<THREE.Points>(null)

  const trailPositions = useMemo(() => {
    const positions = new Float32Array(20 * 3)
    for (let i = 0; i < 20; i++) {
      positions[i * 3] = -8 - i * 0.3
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
    }
    return positions
  }, [])

  useFrame((state) => {
    if (ref.current) {
      const time = (state.clock.elapsedTime * speed) % 8
      if (time < 2) {
        // Neutron approaching
        ref.current.visible = true
        ref.current.position.x = -8 + time * 4
        ref.current.position.y = Math.sin(time * 3) * 0.1
      } else {
        ref.current.visible = false
      }
    }

    if (trailRef.current) {
      const time = (state.clock.elapsedTime * speed) % 8
      trailRef.current.visible = time < 2
      if (time < 2) {
        trailRef.current.position.x = time * 4
      }
    }
  })

  return (
    <>
      <mesh ref={ref}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>
      <Points ref={trailRef} positions={trailPositions} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#93c5fd"
          size={0.06}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.5}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </>
  )
}

// Background radiation particles
function RadiationParticles({ speed = 1 }) {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const count = 300
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20
    }
    return positions
  }, [])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02 * speed
      ref.current.rotation.x = state.clock.elapsedTime * 0.01 * speed
    }
  })

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#fbbf24"
        size={0.02}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

// Chain reaction hint - small nuclei in background
function BackgroundNuclei({ speed = 1 }) {
  const groupRef = useRef<THREE.Group>(null)

  const nuclei = useMemo(() => {
    return Array.from({ length: 6 }).map(() => ({
      position: [
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 10,
        -5 - Math.random() * 5
      ] as [number, number, number],
      scale: 0.2 + Math.random() * 0.2
    }))
  }, [])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        child.rotation.x = state.clock.elapsedTime * 0.3 * speed
        child.rotation.y = state.clock.elapsedTime * 0.2 * speed
      })
    }
  })

  return (
    <group ref={groupRef}>
      {nuclei.map((nucleus, i) => (
        <mesh key={i} position={nucleus.position} scale={nucleus.scale}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.2} />
        </mesh>
      ))}
    </group>
  )
}

export function FissionBackground({ speed = 1 }: FissionBackgroundProps) {
  const [fissionCount, setFissionCount] = useState(0)

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-orange-950 to-slate-900">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <pointLight position={[5, 5, 5]} intensity={0.5} color="#fbbf24" />

          <Uranium235 onFission={() => setFissionCount(c => c + 1)} speed={speed} />
          <IncomingNeutron speed={speed} />
          <RadiationParticles speed={speed} />
          <BackgroundNuclei speed={speed} />

          {/* Hazard glow */}
          <mesh position={[0, 0, -5]}>
            <circleGeometry args={[8, 32]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.03} />
          </mesh>
        </Suspense>
      </Canvas>

      {/* Fission info overlay */}
      <div className="absolute bottom-4 left-4 text-xs text-amber-500/60 font-mono">
        <div>U-235 Nuclear Fission</div>
        <div className="text-amber-500/40">²³⁵U + n → ¹⁴¹Ba + ⁹²Kr + 3n + Energy</div>
      </div>
    </div>
  )
}
