'use client'

import { useEffect, useRef, useState } from 'react'
import { PrimaryButton } from './ui/primary_button'
import { SecondaryButton } from './ui/secondary_button'
import toast from 'react-hot-toast'

interface WhiteboardProps {
  onSave: (imageUrl: string) => void
  onClose: () => void
}

export function Whiteboard({ onSave, onClose }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(2)
  const [isUploading, setIsUploading] = useState(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = 800
    canvas.height = 600

    // Set initial canvas style
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDrawing(true)
    lastPoint.current = { x, y }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPoint.current) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.lineTo(x, y)
    ctx.stroke()

    lastPoint.current = { x, y }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    lastPoint.current = null
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsUploading(true)
    
    try {
      // Get the image data as base64
      const imageData = canvas.toDataURL('image/png')
      
      // Upload to Supabase Storage via our API
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to upload image')
      }
      
      const data = await response.json()
      onSave(data.url)
      toast.success('Skiss sparad!')
    } catch (error) {
      console.error('Error saving whiteboard:', error)
      toast.error('Kunde inte spara skissen. Försök igen.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-[850px]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Whiteboard</h2>
          <div className="flex gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer"
            />
            <select
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="border rounded px-2"
            >
              <option value="1">Thin</option>
              <option value="2">Medium</option>
              <option value="4">Thick</option>
              <option value="8">Extra Thick</option>
            </select>
            <SecondaryButton onClick={clearCanvas}>Clear</SecondaryButton>
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSave} isLoading={isUploading}>Save</PrimaryButton>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="border border-gray-300 rounded-lg cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>
    </div>
  )
} 