import React, { useRef, Suspense, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

interface ParticlesBackgroundProps {
  speed?: number
}

function FloatingParticles({ count = 1000, speed = 1 }) {
  const ref = useRef<THREE.Points>(null)

  const [positions, colors] = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const colorPalette = [
      new THREE.Color('#60a5fa'),
      new THREE.Color('#a78bfa'),
      new THREE.Color('#f472b6'),
      new THREE.Color('#34d399'),
    ]

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 15
      positions[i * 3 + 1] = (Math.random() - 0.5) * 15
      positions[i * 3 + 2] = (Math.random() - 0.5) * 15

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)]
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    return [positions, colors]
  }, [count])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * 0.05 * speed
      ref.current.rotation.y = state.clock.elapsedTime * 0.08 * speed

      // Gentle floating motion
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.5 * speed) * 0.3
    }
  })

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        vertexColors
        size={0.05}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

function ConnectingLines({ count = 100, speed = 1 }) {
  const ref = useRef<THREE.Group>(null)

  const lines = useMemo(() => {
    const lineData = []
    for (let i = 0; i < count; i++) {
      const start = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      )
      const end = new THREE.Vector3(
        start.x + (Math.random() - 0.5) * 2,
        start.y + (Math.random() - 0.5) * 2,
        start.z + (Math.random() - 0.5) * 2
      )
      lineData.push({ start, end })
    }
    return lineData
  }, [count])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.03 * speed
    }
  })

  return (
    <group ref={ref}>
      {lines.map((line, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([...line.start.toArray(), ...line.end.toArray()])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#6366f1" transparent opacity={0.2} />
        </line>
      ))}
    </group>
  )
}

function GlowingSpheres({ count = 20, speed = 1 }) {
  const ref = useRef<THREE.Group>(null)

  const spheres = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      ] as [number, number, number],
      scale: Math.random() * 0.3 + 0.1,
      color: ['#60a5fa', '#a78bfa', '#f472b6', '#34d399'][Math.floor(Math.random() * 4)]
    }))
  }, [count])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02 * speed
      ref.current.children.forEach((child, i) => {
        child.position.y += Math.sin(state.clock.elapsedTime * speed + i) * 0.002
      })
    }
  })

  return (
    <group ref={ref}>
      {spheres.map((sphere, i) => (
        <mesh key={i} position={sphere.position} scale={sphere.scale}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={sphere.color} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

export function ParticlesBackground({ speed = 1 }: ParticlesBackgroundProps) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <FloatingParticles count={800} speed={speed} />
          <ConnectingLines count={50} speed={speed} />
          <GlowingSpheres count={15} speed={speed} />
        </Suspense>
      </Canvas>
    </div>
  )
}
