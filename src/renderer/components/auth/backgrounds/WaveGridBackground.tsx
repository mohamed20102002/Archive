import React, { useRef, Suspense, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

interface WaveGridBackgroundProps {
  speed?: number
}

function WaveGrid({ speed = 1 }) {
  const meshRef = useRef<THREE.Points>(null)
  const gridSize = 40
  const spacing = 0.4

  const positions = useMemo(() => {
    const pos = new Float32Array(gridSize * gridSize * 3)
    let index = 0
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        pos[index++] = (i - gridSize / 2) * spacing
        pos[index++] = 0
        pos[index++] = (j - gridSize / 2) * spacing
      }
    }
    return pos
  }, [])

  useFrame((state) => {
    if (meshRef.current) {
      const positions = meshRef.current.geometry.attributes.position.array as Float32Array
      const time = state.clock.elapsedTime * speed

      let index = 0
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const x = (i - gridSize / 2) * spacing
          const z = (j - gridSize / 2) * spacing
          const distance = Math.sqrt(x * x + z * z)

          // Multiple wave interference pattern
          const wave1 = Math.sin(distance * 0.5 - time * 2) * 0.5
          const wave2 = Math.sin(distance * 0.3 + time * 1.5) * 0.3
          const wave3 = Math.cos(x * 0.5 + time) * Math.sin(z * 0.5 + time) * 0.2

          positions[index + 1] = wave1 + wave2 + wave3
          index += 3
        }
      }
      meshRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <Points ref={meshRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#06b6d4"
        size={0.08}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

function FloatingRings({ speed = 1 }) {
  const groupRef = useRef<THREE.Group>(null)

  const rings = useMemo(() => {
    return [
      { radius: 3, y: -1, color: '#06b6d4', rotationSpeed: 0.3 },
      { radius: 4, y: 0, color: '#0ea5e9', rotationSpeed: -0.2 },
      { radius: 5, y: 1, color: '#3b82f6', rotationSpeed: 0.15 },
    ]
  }, [])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        child.rotation.z = state.clock.elapsedTime * rings[i].rotationSpeed * speed
        child.position.y = rings[i].y + Math.sin(state.clock.elapsedTime * speed + i) * 0.2
      })
    }
  })

  return (
    <group ref={groupRef} rotation={[Math.PI / 3, 0, 0]} position={[0, 2, -3]}>
      {rings.map((ring, i) => (
        <mesh key={i} position={[0, ring.y, 0]}>
          <torusGeometry args={[ring.radius, 0.02, 8, 100]} />
          <meshBasicMaterial color={ring.color} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function AmbientParticles({ speed = 1 }) {
  const ref = useRef<THREE.Points>(null)

  const particles = useMemo(() => {
    const positions = new Float32Array(200 * 3)
    for (let i = 0; i < 200; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20
    }
    return positions
  }, [])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02 * speed
    }
  })

  return (
    <Points ref={ref} positions={particles} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#22d3ee"
        size={0.04}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.5}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

export function WaveGridBackground({ speed = 1 }: WaveGridBackgroundProps) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900">
      <Canvas
        camera={{ position: [0, 6, 10], fov: 60, near: 0.1, far: 100 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <WaveGrid speed={speed} />
          <FloatingRings speed={speed} />
          <AmbientParticles speed={speed} />
        </Suspense>
      </Canvas>
    </div>
  )
}
