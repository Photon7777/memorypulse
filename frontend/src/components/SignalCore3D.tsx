import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface SignalCore3DProps {
  pressure?: number | null
  outlookChange?: number | null
}

export function SignalCore3D({ pressure = 50, outlookChange = 0 }: SignalCore3DProps) {
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

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100)
    camera.position.set(0, 2.25, 7.8)
    camera.lookAt(0, 0.15, 0)

    const sculpture = new THREE.Group()
    sculpture.rotation.set(-0.12, -0.34, 0)
    scene.add(sculpture)

    const indigo = new THREE.Color(0x6e7bff)
    const cyan = new THREE.Color(0x47c8ff)
    const amber = new THREE.Color(0xf7b955)
    const coral = new THREE.Color(0xff6b7a)
    const pressureLevel = THREE.MathUtils.clamp((pressure ?? 50) / 100, 0, 1)
    const outlookLevel = THREE.MathUtils.clamp(Math.abs(outlookChange ?? 0) / 100, 0, 1)

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.05, 0.16, 64),
      new THREE.MeshPhysicalMaterial({ color: 0x10152a, metalness: 0.82, roughness: 0.28, clearcoat: 0.65 }),
    )
    base.position.y = -1.22
    sculpture.add(base)
    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.75, 0.018, 8, 120),
      new THREE.MeshBasicMaterial({ color: indigo, transparent: true, opacity: 0.7 }),
    )
    baseRing.position.y = -1.11
    baseRing.rotation.x = Math.PI / 2
    sculpture.add(baseRing)

    const stack = new THREE.Group()
    stack.position.set(0, -0.2, 0)
    sculpture.add(stack)
    for (let index = 0; index < 5; index += 1) {
      const layer = new THREE.Mesh(
        new THREE.BoxGeometry(1.72 - index * 0.055, 0.16, 1.28 - index * 0.04, 3, 1, 3),
        new THREE.MeshPhysicalMaterial({
          color: index % 2 ? 0x1c2550 : 0x161d3e,
          metalness: 0.58,
          roughness: 0.22,
          clearcoat: 0.82,
          emissive: index === 4 ? indigo : new THREE.Color(0x090c1c),
          emissiveIntensity: index === 4 ? 0.18 + pressureLevel * 0.38 : 0.08,
        }),
      )
      layer.position.y = index * 0.25
      layer.rotation.y = (index - 2) * 0.035
      stack.add(layer)
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(layer.geometry),
        new THREE.LineBasicMaterial({ color: index === 4 ? amber : indigo, transparent: true, opacity: 0.34 + index * 0.07 }),
      )
      edge.position.copy(layer.position)
      edge.rotation.copy(layer.rotation)
      stack.add(edge)
    }

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.22, 0.56),
      new THREE.MeshPhysicalMaterial({ color: 0x222d62, metalness: 0.48, roughness: 0.16, clearcoat: 1, emissive: indigo, emissiveIntensity: 0.42 + outlookLevel * 0.35 }),
    )
    cap.position.y = 1.18
    stack.add(cap)

    const routeMaterial = (color: THREE.Color) => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.64 })
    const pulseMaterial = (color: THREE.Color) => new THREE.MeshBasicMaterial({ color, toneMapped: false })
    const routes: Array<{ curve: THREE.CatmullRomCurve3; pulse: THREE.Mesh; offset: number }> = []
    const endpoints = [
      { position: new THREE.Vector3(-2.55, -0.7, 0.25), color: cyan, size: new THREE.Vector3(0.92, 0.48, 0.22) },
      { position: new THREE.Vector3(2.5, -0.68, 0.12), color: amber, size: new THREE.Vector3(0.98, 0.56, 0.18) },
      { position: new THREE.Vector3(0.25, -0.66, -2.2), color: coral, size: new THREE.Vector3(0.54, 0.78, 0.15) },
    ]
    endpoints.forEach((endpoint, index) => {
      const device = new THREE.Mesh(
        new THREE.BoxGeometry(endpoint.size.x, endpoint.size.y, endpoint.size.z),
        new THREE.MeshPhysicalMaterial({ color: 0x151c38, metalness: 0.46, roughness: 0.3, clearcoat: 0.65, emissive: endpoint.color, emissiveIntensity: 0.12 }),
      )
      device.position.copy(endpoint.position)
      sculpture.add(device)
      const deviceEdge = new THREE.LineSegments(
        new THREE.EdgesGeometry(device.geometry),
        new THREE.LineBasicMaterial({ color: endpoint.color, transparent: true, opacity: 0.72 }),
      )
      deviceEdge.position.copy(endpoint.position)
      sculpture.add(deviceEdge)

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.2, 0),
        new THREE.Vector3(endpoint.position.x * 0.42, -0.92, endpoint.position.z * 0.4),
        new THREE.Vector3(endpoint.position.x * 0.76, -1.02, endpoint.position.z * 0.78),
        endpoint.position.clone(),
      ])
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
        routeMaterial(endpoint.color),
      )
      sculpture.add(line)
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), pulseMaterial(endpoint.color))
      sculpture.add(pulse)
      routes.push({ curve, pulse, offset: index / endpoints.length })
    })

    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(2.08, 0.014, 8, 120),
      new THREE.MeshBasicMaterial({ color: cyan, transparent: true, opacity: 0.34 }),
    )
    orbit.position.y = 0.05
    orbit.rotation.x = Math.PI / 2.4
    sculpture.add(orbit)

    scene.add(new THREE.HemisphereLight(0x9ca6ff, 0x080a18, 1.45))
    const key = new THREE.PointLight(indigo, 18 + pressureLevel * 14, 12)
    key.position.set(3.2, 4.4, 3.4)
    scene.add(key)
    const rim = new THREE.PointLight(amber, 12 + outlookLevel * 10, 10)
    rim.position.set(-3.2, 0.2, 2.5)
    scene.add(rim)

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
    const started = performance.now()
    const animate = (now: number) => {
      if (!visible) return
      sculpture.rotation.y += (pointerX * 0.18 - 0.34 - sculpture.rotation.y) * 0.028
      sculpture.rotation.x += (-0.12 - pointerY * 0.08 - sculpture.rotation.x) * 0.028
      stack.position.y = -0.2 + Math.sin((now - started) / 1700) * 0.035
      routes.forEach((route) => {
        const progress = (((now - started) / (2900 - pressureLevel * 700)) + route.offset) % 1
        route.pulse.position.copy(route.curve.getPoint(progress))
      })
      render()
      frame = window.requestAnimationFrame(animate)
    }
    const pointer = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect()
      pointerX = (event.clientX - bounds.left) / bounds.width - 0.5
      pointerY = (event.clientY - bounds.top) / bounds.height - 0.5
    }
    const resetPointer = () => { pointerX = 0; pointerY = 0 }
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
    element.addEventListener('pointerleave', resetPointer)
    if (reducedMotion) {
      routes.forEach((route, index) => route.pulse.position.copy(route.curve.getPoint(0.35 + index * 0.2)))
      render()
    } else frame = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frame)
      element.removeEventListener('pointermove', pointer)
      element.removeEventListener('pointerleave', resetPointer)
      resize.disconnect()
      visibility.disconnect()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments || object instanceof THREE.Line) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer.dispose()
    }
  }, [outlookChange, pressure])

  return <canvas className="signal-core-canvas" ref={canvas} aria-hidden="true" />
}
