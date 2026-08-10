import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function SignalCore3D() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvas.current) return
    const element = canvas.current
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas: element, alpha: true, antialias: true, powerPreference: 'low-power' })
    } catch {
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 1.1, 6.2)

    const core = new THREE.Group()
    core.rotation.set(-0.48, -0.55, 0.08)
    scene.add(core)

    const chip = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.34, 1.55, 4, 1, 4),
      new THREE.MeshPhysicalMaterial({ color: 0x163f3a, metalness: 0.72, roughness: 0.22, clearcoat: 0.75, clearcoatRoughness: 0.18 }),
    )
    core.add(chip)
    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.38, 0.84),
      new THREE.MeshPhysicalMaterial({ color: 0x071413, metalness: 0.5, roughness: 0.28, emissive: 0x0d2d29, emissiveIntensity: 0.35 }),
    )
    inset.position.y = 0.05
    core.add(inset)
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.58, 0.37, 1.58)),
      new THREE.LineBasicMaterial({ color: 0x64b8a9, transparent: true, opacity: 0.72 }),
    )
    core.add(edge)

    const pinMaterial = new THREE.MeshStandardMaterial({ color: 0xd7a353, metalness: 0.86, roughness: 0.24 })
    for (let index = 0; index < 12; index += 1) {
      const offset = -1.1 + index * 0.2
      for (const side of [-1, 1]) {
        const pin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.34), pinMaterial)
        pin.position.set(offset, -0.02, side * 0.93)
        core.add(pin)
      }
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.25, 0.012, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x64b8a9, transparent: true, opacity: 0.5 }),
    )
    ring.rotation.x = Math.PI / 2.15
    scene.add(ring)

    const pointPositions = new Float32Array(210 * 3)
    for (let index = 0; index < pointPositions.length; index += 3) {
      const angle = Math.random() * Math.PI * 2
      const radius = 2.5 + Math.random() * 2.2
      pointPositions[index] = Math.cos(angle) * radius
      pointPositions[index + 1] = (Math.random() - 0.5) * 3.5
      pointPositions[index + 2] = Math.sin(angle) * radius
    }
    const pointsGeometry = new THREE.BufferGeometry()
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3))
    const points = new THREE.Points(
      pointsGeometry,
      new THREE.PointsMaterial({ color: 0x64b8a9, size: 0.025, transparent: true, opacity: 0.52 }),
    )
    scene.add(points)

    scene.add(new THREE.AmbientLight(0xe9fff8, 1.4))
    const key = new THREE.PointLight(0x64b8a9, 16, 12)
    key.position.set(3, 4, 3)
    scene.add(key)
    const warm = new THREE.PointLight(0xd7a353, 10, 10)
    warm.position.set(-3, -2, 2)
    scene.add(warm)

    let frame = 0
    let visible = true
    let pointerX = 0
    let pointerY = 0
    const render = () => {
      const width = Math.max(1, element.clientWidth)
      const height = Math.max(1, element.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }
    const animate = () => {
      if (!visible) return
      core.rotation.y += (pointerX * 0.18 - core.rotation.y - 0.55) * 0.025
      core.rotation.x += (-0.48 - pointerY * 0.12 - core.rotation.x) * 0.025
      ring.rotation.z += 0.0018
      points.rotation.y -= 0.0007
      render()
      frame = window.requestAnimationFrame(animate)
    }
    const pointer = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect()
      pointerX = (event.clientX - bounds.left) / bounds.width - 0.5
      pointerY = (event.clientY - bounds.top) / bounds.height - 0.5
    }
    const resize = new ResizeObserver(render)
    resize.observe(element)
    const visibility = new IntersectionObserver(([entry]) => {
      const nextVisible = entry.isIntersecting
      if (nextVisible === visible) return
      visible = nextVisible
      window.cancelAnimationFrame(frame)
      if (visible && !reducedMotion) frame = window.requestAnimationFrame(animate)
    })
    visibility.observe(element)
    element.addEventListener('pointermove', pointer)
    if (reducedMotion) render()
    else frame = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frame)
      element.removeEventListener('pointermove', pointer)
      resize.disconnect()
      visibility.disconnect()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer.dispose()
    }
  }, [])

  return <canvas className="signal-core-canvas" ref={canvas} aria-hidden="true" />
}
