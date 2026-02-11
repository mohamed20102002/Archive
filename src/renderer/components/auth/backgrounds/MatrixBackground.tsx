import React, { useRef, Suspense, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface MatrixBackgroundProps {
  speed?: number
}

// Matrix rain column
function MatrixColumn({ x, speed = 1, columnIndex }: { x: number; speed: number; columnIndex: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const [chars, setChars] = useState<string[]>([])

  const columnSpeed = useMemo(() => 0.5 + Math.random() * 1.5, [])
  const startDelay = useMemo(() => Math.random() * 5, [])
  const columnLength = useMemo(() => 10 + Math.floor(Math.random() * 15), [])

  // Generate random characters
  useEffect(() => {
    const matrixChars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const newChars = Array.from({ length: columnLength }).map(() =>
      matrixChars[Math.floor(Math.random() * matrixChars.length)]
    )
    setChars(newChars)
  }, [columnLength])

  useFrame((state) => {
    if (groupRef.current) {
      const time = (state.clock.elapsedTime * columnSpeed * speed + startDelay) % 8
      groupRef.current.position.y = 8 - time * 3
    }
  })

  return (
    <group ref={groupRef} position={[x, 0, 0]}>
      {chars.map((_, i) => (
        <MatrixChar
          key={i}
          y={-i * 0.4}
          isHead={i === 0}
          fadePosition={i / columnLength}
          speed={speed}
          charIndex={i}
          columnIndex={columnIndex}
        />
      ))}
    </group>
  )
}

function MatrixChar({ y, isHead, fadePosition, speed, charIndex, columnIndex }: {
  y: number
  isHead: boolean
  fadePosition: number
  speed: number
  charIndex: number
  columnIndex: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      // Flicker effect
      const flicker = Math.sin(state.clock.elapsedTime * 10 * speed + charIndex + columnIndex * 0.5) > 0.3
      meshRef.current.visible = flicker || isHead

      // Scale variation
      const scale = isHead ? 1.2 : 0.8 + Math.sin(state.clock.elapsedTime * 5 + charIndex) * 0.2
      meshRef.current.scale.setScalar(scale)
    }
  })

  const opacity = isHead ? 1 : Math.max(0.1, 1 - fadePosition * 1.2)
  const color = isHead ? '#ffffff' : '#22c55e'

  return (
    <mesh ref={meshRef} position={[0, y, 0]}>
      <planeGeometry args={[0.25, 0.35]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Glowing orbs in the background
function BackgroundOrbs({ speed = 1 }) {
  const groupRef = useRef<THREE.Group>(null)

  const orbs = useMemo(() => {
    return Array.from({ length: 8 }).map(() => ({
      position: [
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 10,
        -5 - Math.random() * 5
      ] as [number, number, number],
      scale: 0.5 + Math.random() * 1,
      pulseSpeed: 0.5 + Math.random() * 1
    }))
  }, [])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const orb = orbs[i]
        const pulse = 1 + Math.sin(state.clock.elapsedTime * orb.pulseSpeed * speed) * 0.3
        child.scale.setScalar(orb.scale * pulse)
      })
    }
  })

  return (
    <group ref={groupRef}>
      {orbs.map((orb, i) => (
        <mesh key={i} position={orb.position}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.05} />
        </mesh>
      ))}
    </group>
  )
}

// Horizontal scan lines
function ScanLines({ speed = 1 }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.5 * speed) * 5
    }
  })

  return (
    <mesh ref={ref} position={[0, 0, 1]}>
      <planeGeometry args={[20, 0.02]} />
      <meshBasicMaterial color="#22c55e" transparent opacity={0.3} />
    </mesh>
  )
}

// Digital grid floor
function DigitalGrid({ speed = 1 }) {
  const ref = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.z = (state.clock.elapsedTime * speed * 0.5) % 2
    }
  })

  const lines = useMemo(() => {
    const horizontalLines = []
    const verticalLines = []

    // Horizontal lines
    for (let i = -10; i <= 10; i += 1) {
      horizontalLines.push(i)
    }

    // Vertical lines
    for (let i = -15; i <= 15; i += 1) {
      verticalLines.push(i)
    }

    return { horizontalLines, verticalLines }
  }, [])

  return (
    <group ref={ref} position={[0, -6, 0]} rotation={[-Math.PI / 3, 0, 0]}>
      {lines.horizontalLines.map((z, i) => (
        <line key={`h-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([-15, 0, z, 15, 0, z])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#22c55e" transparent opacity={0.2} />
        </line>
      ))}
      {lines.verticalLines.map((x, i) => (
        <line key={`v-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([x, 0, -10, x, 0, 10])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#22c55e" transparent opacity={0.15} />
        </line>
      ))}
    </group>
  )
}

export function MatrixBackground({ speed = 1 }: MatrixBackgroundProps) {
  // Generate column positions
  const columns = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      x: (i - 15) * 0.6 + (Math.random() - 0.5) * 0.3
    }))
  }, [])

  return (
    <div className="absolute inset-0 bg-black">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.1} />

          {/* Matrix rain */}
          {columns.map((col, i) => (
            <MatrixColumn key={i} x={col.x} speed={speed} columnIndex={i} />
          ))}

          <BackgroundOrbs speed={speed} />
          <ScanLines speed={speed} />
          <DigitalGrid speed={speed} />

          {/* Vignette effect */}
          <mesh position={[0, 0, 5]}>
            <planeGeometry args={[20, 15]} />
            <meshBasicMaterial color="#000000" transparent opacity={0} />
          </mesh>
        </Suspense>
      </Canvas>

      {/* CSS overlay for additional effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black opacity-60" />
      </div>
    </div>
  )
}
