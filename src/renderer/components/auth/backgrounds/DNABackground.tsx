import React, { useRef, Suspense, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

interface DNABackgroundProps {
  speed?: number
}

function DNAHelix({ speed = 1 }) {
  const groupRef = useRef<THREE.Group>(null)
  const particlesRef = useRef<THREE.Points>(null)

  const { spheres, connections, particles } = useMemo(() => {
    const spheres: { position: [number, number, number]; color: string; strand: number }[] = []
    const connections: { start: THREE.Vector3; end: THREE.Vector3 }[] = []

    const helixHeight = 12
    const radius = 1.2
    const turns = 3
    const pointsPerTurn = 20

    for (let i = 0; i < turns * pointsPerTurn; i++) {
      const t = i / pointsPerTurn
      const angle = t * Math.PI * 2
      const y = (i / (turns * pointsPerTurn)) * helixHeight - helixHeight / 2

      // Strand 1
      const x1 = Math.cos(angle) * radius
      const z1 = Math.sin(angle) * radius
      spheres.push({
        position: [x1, y, z1],
        color: '#60a5fa',
        strand: 1
      })

      // Strand 2 (opposite side)
      const x2 = Math.cos(angle + Math.PI) * radius
      const z2 = Math.sin(angle + Math.PI) * radius
      spheres.push({
        position: [x2, y, z2],
        color: '#f472b6',
        strand: 2
      })

      // Connection between strands (base pairs)
      if (i % 2 === 0) {
        connections.push({
          start: new THREE.Vector3(x1, y, z1),
          end: new THREE.Vector3(x2, y, z2)
        })
      }
    }

    // Background particles
    const particles = new Float32Array(300 * 3)
    for (let i = 0; i < 300; i++) {
      particles[i * 3] = (Math.random() - 0.5) * 20
      particles[i * 3 + 1] = (Math.random() - 0.5) * 20
      particles[i * 3 + 2] = (Math.random() - 0.5) * 20
    }

    return { spheres, connections, particles }
  }, [])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2 * speed
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5 * speed) * 0.5
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05 * speed
      particlesRef.current.rotation.x = state.clock.elapsedTime * 0.03 * speed
    }
  })

  return (
    <>
      <group ref={groupRef}>
        {/* DNA spheres */}
        {spheres.map((sphere, i) => (
          <mesh key={i} position={sphere.position}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color={sphere.color} transparent opacity={0.9} />
          </mesh>
        ))}

        {/* Base pair connections */}
        {connections.map((conn, i) => (
          <line key={`conn-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([...conn.start.toArray(), ...conn.end.toArray()])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#a78bfa" transparent opacity={0.5} />
          </line>
        ))}

        {/* Helix backbone lines */}
        <HelixBackbone spheres={spheres.filter(s => s.strand === 1)} color="#60a5fa" />
        <HelixBackbone spheres={spheres.filter(s => s.strand === 2)} color="#f472b6" />
      </group>

      {/* Background particles */}
      <Points ref={particlesRef} positions={particles} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#6366f1"
          size={0.03}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.5}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </>
  )
}

function HelixBackbone({ spheres, color }: { spheres: { position: [number, number, number] }[]; color: string }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(spheres.length * 3)
    spheres.forEach((s, i) => {
      arr[i * 3] = s.position[0]
      arr[i * 3 + 1] = s.position[1]
      arr[i * 3 + 2] = s.position[2]
    })
    return arr
  }, [spheres])

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={spheres.length}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.6} />
    </line>
  )
}

export function DNABackground({ speed = 1 }: DNABackgroundProps) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          <DNAHelix speed={speed} />
        </Suspense>
      </Canvas>
    </div>
  )
}
