import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputBoxProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const InputBox = forwardRef<HTMLInputElement, InputBoxProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          className={cn(
            'w-full rounded-2xl border border-gray-800 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus:ring-red-400',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    )
  }
)

InputBox.displayName = 'InputBox'
