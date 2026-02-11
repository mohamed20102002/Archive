import React, { useRef, Suspense, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

interface GalaxyBackgroundProps {
  speed?: number
}

function Galaxy({ speed = 1 }) {
  const galaxyRef = useRef<THREE.Points>(null)
  const coreRef = useRef<THREE.Points>(null)

  const { positions, colors } = useMemo(() => {
    const count = 5000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const branches = 5
    const spin = 1.5
    const randomness = 0.5
    const randomnessPower = 3

    const colorInside = new THREE.Color('#ff6030')
    const colorOutside = new THREE.Color('#1b3984')

    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 5
      const branchAngle = ((i % branches) / branches) * Math.PI * 2
      const spinAngle = radius * spin

      const randomX = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * radius
      const randomY = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * radius * 0.3
      const randomZ = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * radius

      positions[i * 3] = Math.cos(branchAngle + spinAngle) * radius + randomX
      positions[i * 3 + 1] = randomY
      positions[i * 3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ

      // Color gradient from inside to outside
      const mixedColor = colorInside.clone()
      mixedColor.lerp(colorOutside, radius / 5)
      colors[i * 3] = mixedColor.r
      colors[i * 3 + 1] = mixedColor.g
      colors[i * 3 + 2] = mixedColor.b
    }

    return { positions, colors }
  }, [])

  const corePositions = useMemo(() => {
    const count = 500
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 0.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.3
      positions[i * 3 + 2] = radius * Math.cos(phi)
    }
    return positions
  }, [])

  useFrame((state) => {
    if (galaxyRef.current) {
      galaxyRef.current.rotation.y = state.clock.elapsedTime * 0.05 * speed
    }
    if (coreRef.current) {
      coreRef.current.rotation.y = state.clock.elapsedTime * 0.1 * speed
    }
  })

  return (
    <group rotation={[0.5, 0, 0.3]}>
      <Points ref={galaxyRef} positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          vertexColors
          size={0.03}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </Points>
      <Points ref={coreRef} positions={corePositions} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#ffaa00"
          size={0.05}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </group>
  )
}

function Stars({ speed = 1 }) {
  const starsRef = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const count = 1000
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const radius = 15 + Math.random() * 15
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi)
    }
    return positions
  }, [])

  useFrame((state) => {
    if (starsRef.current) {
      starsRef.current.rotation.y = state.clock.elapsedTime * 0.01 * speed
      starsRef.current.rotation.x = state.clock.elapsedTime * 0.005 * speed
    }
  })

  return (
    <Points ref={starsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#ffffff"
        size={0.02}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.8}
      />
    </Points>
  )
}

function ShootingStars({ speed = 1 }) {
  const groupRef = useRef<THREE.Group>(null)

  const stars = useMemo(() => {
    return Array.from({ length: 5 }, () => ({
      startPos: [(Math.random() - 0.5) * 20, Math.random() * 10 + 5, -10] as [number, number, number],
      speed: Math.random() * 2 + 1,
      delay: Math.random() * 10
    }))
  }, [])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const star = stars[i]
        const time = (state.clock.elapsedTime * speed + star.delay) % 5
        const progress = time / 2

        if (progress < 1) {
          child.visible = true
          child.position.x = star.startPos[0] + progress * 10
          child.position.y = star.startPos[1] - progress * 8
          child.position.z = star.startPos[2] + progress * 5
          ;(child as THREE.Mesh).material = new THREE.MeshBasicMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: 1 - progress
          })
        } else {
          child.visible = false
        }
      })
    }
  })

  return (
    <group ref={groupRef}>
      {stars.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}

export function GalaxyBackground({ speed = 1 }: GalaxyBackgroundProps) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-950 to-indigo-950">
      <Canvas
        camera={{ position: [0, 3, 8], fov: 60 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.1} />
          <Galaxy speed={speed} />
          <Stars speed={speed} />
          <ShootingStars speed={speed} />
        </Suspense>
      </Canvas>
    </div>
  )
}
