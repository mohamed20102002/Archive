import React, { useRef, Suspense, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

interface NeuralBackgroundProps {
  speed?: number
}

// Neural network node
function NeuralNetwork({ speed = 1 }) {
  const groupRef = useRef<THREE.Group>(null)
  const pulsesRef = useRef<THREE.Group>(null)

  // Generate network structure
  const { nodes, connections, pulseData } = useMemo(() => {
    const layers = [5, 8, 10, 8, 5] // Network architecture
    const nodes: { position: [number, number, number]; layer: number }[] = []
    const connections: { start: THREE.Vector3; end: THREE.Vector3 }[] = []
    const pulseData: { start: THREE.Vector3; end: THREE.Vector3; delay: number }[] = []

    const layerSpacing = 2.5
    const startX = -((layers.length - 1) * layerSpacing) / 2

    // Create nodes for each layer
    layers.forEach((nodeCount, layerIndex) => {
      const x = startX + layerIndex * layerSpacing
      const startY = -((nodeCount - 1) * 0.8) / 2

      for (let i = 0; i < nodeCount; i++) {
        const y = startY + i * 0.8
        const z = (Math.random() - 0.5) * 0.5
        nodes.push({
          position: [x, y, z],
          layer: layerIndex
        })
      }
    })

    // Create connections between adjacent layers
    let nodeIndex = 0
    for (let l = 0; l < layers.length - 1; l++) {
      const currentLayerStart = nodeIndex
      const currentLayerEnd = nodeIndex + layers[l]
      const nextLayerStart = currentLayerEnd
      const nextLayerEnd = nextLayerStart + layers[l + 1]

      for (let i = currentLayerStart; i < currentLayerEnd; i++) {
        for (let j = nextLayerStart; j < nextLayerEnd; j++) {
          // Only connect some nodes (not all-to-all)
          if (Math.random() > 0.4) {
            const start = new THREE.Vector3(...nodes[i].position)
            const end = new THREE.Vector3(...nodes[j].position)
            connections.push({ start, end })

            // Some connections have pulses
            if (Math.random() > 0.6) {
              pulseData.push({ start, end, delay: Math.random() * 5 })
            }
          }
        }
      }
      nodeIndex += layers[l]
    }

    return { nodes, connections, pulseData }
  }, [])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1 * speed) * 0.2
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15 * speed) * 0.1
    }
  })

  return (
    <group ref={groupRef}>
      {/* Nodes */}
      {nodes.map((node, i) => (
        <NeuralNode key={i} position={node.position} layer={node.layer} speed={speed} index={i} />
      ))}

      {/* Connections */}
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
          <lineBasicMaterial color="#6366f1" transparent opacity={0.15} />
        </line>
      ))}

      {/* Signal pulses */}
      <group ref={pulsesRef}>
        {pulseData.map((pulse, i) => (
          <SignalPulse key={i} start={pulse.start} end={pulse.end} delay={pulse.delay} speed={speed} />
        ))}
      </group>
    </group>
  )
}

function NeuralNode({ position, layer, speed, index }: { position: [number, number, number]; layer: number; speed: number; index: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  const colors = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24']
  const color = colors[layer % colors.length]

  useFrame((state) => {
    if (ref.current) {
      // Pulsing effect
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2 * speed + index * 0.5) * 0.3
      ref.current.scale.setScalar(pulse)
    }
    if (glowRef.current) {
      const glow = 0.5 + Math.sin(state.clock.elapsedTime * 3 * speed + index * 0.3) * 0.3
      ;(glowRef.current.material as THREE.MeshBasicMaterial).opacity = glow * 0.3
    }
  })

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

function SignalPulse({ start, end, delay, speed }: { start: THREE.Vector3; end: THREE.Vector3; delay: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (ref.current) {
      const time = ((state.clock.elapsedTime * speed + delay) % 3) / 3
      const pos = new THREE.Vector3().lerpVectors(start, end, time)
      ref.current.position.copy(pos)
      ref.current.visible = time > 0.1 && time < 0.9

      // Fade in and out
      const opacity = time < 0.5 ? time * 2 : (1 - time) * 2
      ;(ref.current.material as THREE.MeshBasicMaterial).opacity = opacity
    }
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
    </mesh>
  )
}

// Floating data particles
function DataParticles({ speed = 1 }) {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const count = 200
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20
      positions[i * 3 + 1] = (Math.random() - 0.5) * 15
      positions[i * 3 + 2] = (Math.random() - 0.5) * 15
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
        color="#818cf8"
        size={0.03}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.5}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

// Binary code rain effect in background
function BinaryRain({ speed = 1 }) {
  const groupRef = useRef<THREE.Group>(null)

  const columns = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      x: (i - 7) * 1.5,
      z: -8 + Math.random() * 2,
      speed: 0.5 + Math.random() * 0.5,
      offset: Math.random() * 10
    }))
  }, [])

  return (
    <group ref={groupRef}>
      {columns.map((col, i) => (
        <BinaryColumn key={i} x={col.x} z={col.z} columnSpeed={col.speed} offset={col.offset} speed={speed} />
      ))}
    </group>
  )
}

function BinaryColumn({ x, z, columnSpeed, offset, speed }: { x: number; z: number; columnSpeed: number; offset: number; speed: number }) {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const count = 20
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x
      positions[i * 3 + 1] = i * 0.5 - 5
      positions[i * 3 + 2] = z
    }
    return positions
  }, [x, z])

  useFrame((state) => {
    if (ref.current) {
      const time = (state.clock.elapsedTime * columnSpeed * speed + offset) % 10
      ref.current.position.y = -time
    }
  })

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#22c55e"
        size={0.08}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

export function NeuralBackground({ speed = 1 }: NeuralBackgroundProps) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <NeuralNetwork speed={speed} />
          <DataParticles speed={speed} />
          <BinaryRain speed={speed} />
        </Suspense>
      </Canvas>
    </div>
  )
}
