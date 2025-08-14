'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from './ui/button'
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
  const [drawingHistory, setDrawingHistory] = useState<ImageData[]>([])
  const [currentStep, setCurrentStep] = useState(-1)
  const [mode, setMode] = useState<'whiteboard' | 'grid'>('whiteboard')
  const [gridConfig, setGridConfig] = useState({ rows: 16, cols: 8 })
  const [gridData, setGridData] = useState<string[][]>(Array(16).fill(null).map(() => Array(8).fill('')))
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = 800
    canvas.height = 600

    // Set initial canvas style - transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Make canvas background transparent
    canvas.style.background = 'transparent'
    
    // Save initial state
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setDrawingHistory([imageData])
    setCurrentStep(0)
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'grid') return // Don't draw in grid mode
    
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
    if (!isDrawing || !lastPoint.current || mode === 'grid') return

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
    
    // Save the current state to history
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setDrawingHistory(prev => {
      const newHistory = prev.slice(0, currentStep + 1)
      newHistory.push(imageData)
      return newHistory
    })
    setCurrentStep(prev => prev + 1)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Clear grid data if in grid mode
    if (mode === 'grid') {
      setGridData(Array(gridConfig.rows).fill(null).map(() => Array(gridConfig.cols).fill('')))
    }
    
    // Save cleared state to history
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setDrawingHistory(prev => {
      const newHistory = prev.slice(0, currentStep + 1)
      newHistory.push(imageData)
      return newHistory
    })
    setCurrentStep(prev => prev + 1)
  }

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Calculate cell size to fill the entire canvas
    const cellWidth = canvas.width / gridConfig.cols
    const cellHeight = canvas.height / gridConfig.rows

    // Draw white background for entire canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid border
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, canvas.width, canvas.height)

    // Draw vertical lines
    for (let i = 1; i < gridConfig.cols; i++) {
      ctx.beginPath()
      ctx.moveTo(i * cellWidth, 0)
      ctx.lineTo(i * cellWidth, canvas.height)
      ctx.stroke()
    }

    // Draw horizontal lines
    for (let i = 1; i < gridConfig.rows; i++) {
      ctx.beginPath()
      ctx.moveTo(0, i * cellHeight)
      ctx.lineTo(canvas.width, i * cellHeight)
      ctx.stroke()
    }

    // Draw cell text
    ctx.fillStyle = '#000000'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let row = 0; row < gridConfig.rows; row++) {
      for (let col = 0; col < gridConfig.cols; col++) {
        const cellX = col * cellWidth + cellWidth / 2
        const cellY = row * cellHeight + cellHeight / 2
        const cellText = gridData[row][col] || ''
        
        if (cellText) {
          ctx.fillText(cellText, cellX, cellY)
        }
      }
    }
  }

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw grid if in grid mode
    if (mode === 'grid') {
      drawGrid(ctx)
    }
  }, [mode, drawGrid])

  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas, gridData, gridConfig])

  const undo = () => {
    if (currentStep > 0) {
      const canvas = canvasRef.current
      if (!canvas) return
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      const previousStep = currentStep - 1
      const imageData = drawingHistory[previousStep]
      
      ctx.putImageData(imageData, 0, 0)
      setCurrentStep(previousStep)
    }
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsUploading(true)
    
    try {
      // Create a temporary canvas to combine drawing and grid
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const tempCtx = tempCanvas.getContext('2d')
      
      if (!tempCtx) {
        throw new Error('Could not get canvas context')
      }
      
      // Draw the original canvas content
      tempCtx.drawImage(canvas, 0, 0)
      
      // Draw grid on top if in grid mode
      if (mode === 'grid') {
        drawGrid(tempCtx)
      }
      
      // Get the combined image data
      const imageData = tempCanvas.toDataURL('image/png')
      
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

  const updateGridSize = (newRows: number, newCols: number) => {
    setGridConfig({ rows: newRows, cols: newCols })
    setGridData(Array(newRows).fill(null).map(() => Array(newCols).fill('')))
  }

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-30 flex items-center justify-center z-50 ">
      <div className="bg-white rounded-lg p-4 w-[850px] border-gray-600 border-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {mode === 'whiteboard' ? 'Whiteboard' : 'Rutnät'}
          </h2>
          <div className="flex gap-2">
            {/* Mode Toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden shadow-sm">
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'whiteboard' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-r border-gray-300'
                }`}
                onClick={() => setMode('whiteboard')}
              >
                Whiteboard
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'grid' 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setMode('grid')}
              >
                Rutnät
              </button>
            </div>

            {/* Grid size controls - only show in grid mode */}
            {mode === 'grid' && (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={gridConfig.rows}
                  onChange={(e) => {
                    const rows = parseInt(e.target.value) || 1
                    updateGridSize(rows, gridConfig.cols)
                  }}
                  className="w-12 border rounded px-2 py-1 text-sm text-center"
                  title="Antal rader"
                />
                <span className="text-sm font-medium">x</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={gridConfig.cols}
                  onChange={(e) => {
                    const cols = parseInt(e.target.value) || 1
                    updateGridSize(gridConfig.rows, cols)
                  }}
                  className="w-12 border rounded px-2 py-1 text-sm text-center"
                  title="Antal kolumner"
                />
              </div>
            )}

            {/* Drawing tools - only show in whiteboard mode */}
            {mode === 'whiteboard' && (
              <>
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
              </>
            )}

            <Button variant="outline" onClick={undo} disabled={currentStep <= 0}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              Ångra
            </Button>
            <Button variant="outline" onClick={clearCanvas}>Rensa</Button>
            <Button variant="outline" onClick={onClose}>Avbryt</Button>
            <Button variant="outline" onClick={handleSave} disabled={isUploading}>
              {isUploading ? 'Sparar...' : 'Spara'}
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <canvas
            ref={canvasRef}
            className={`border border-gray-300 rounded-lg ${
              mode === 'whiteboard' ? 'cursor-crosshair' : 'cursor-default'
            }`}
            style={{ backgroundColor: 'transparent' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />

          {/* Grid Editor Overlay */}
          {mode === 'grid' && (
            <div className="absolute inset-0 pointer-events-none">
              <div 
                className="grid bg-white/90 border-2 border-blue-500 pointer-events-auto w-full h-full"
                style={{ 
                  gridTemplateColumns: `repeat(${gridConfig.cols}, 1fr)`, 
                  gridTemplateRows: `repeat(${gridConfig.rows}, 1fr)` 
                }}
              >
                {gridData.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className="border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-blue-50 bg-white"
                      onClick={() => setEditingCell({ row: rowIndex, col: colIndex })}
                    >
                      {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => {
                            const newGridData = [...gridData]
                            newGridData[rowIndex][colIndex] = e.target.value
                            setGridData(newGridData)
                          }}
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setEditingCell(null)
                            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                              e.preventDefault()
                              
                              let newRow = editingCell.row
                              let newCol = editingCell.col
                              
                              switch (e.key) {
                                case 'ArrowUp':
                                  newRow = Math.max(0, editingCell.row - 1)
                                  break
                                case 'ArrowDown':
                                  newRow = Math.min(gridConfig.rows - 1, editingCell.row + 1)
                                  break
                                case 'ArrowLeft':
                                  newCol = Math.max(0, editingCell.col - 1)
                                  break
                                case 'ArrowRight':
                                  newCol = Math.min(gridConfig.cols - 1, editingCell.col + 1)
                                  break
                              }
                              
                              setEditingCell({ row: newRow, col: newCol })
                            }
                          }}
                          className="w-full h-full text-center border-none outline-none bg-white"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-black">{cell}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 