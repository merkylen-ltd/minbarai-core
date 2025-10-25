'use client'

import React, { useState } from 'react'
import { TranslationVariant, TRANSLATION_VARIANTS } from './types'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ChevronDown, CheckCircle2 } from 'lucide-react'
import { cn } from '@/utils/cn'

interface TranslationVariantSelectorProps {
  value: TranslationVariant
  onChange: (variant: TranslationVariant) => void
  disabled: boolean
}

export const TranslationVariantSelector: React.FC<TranslationVariantSelectorProps> = ({
  value,
  onChange,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false)
  
  const selectedVariant = TRANSLATION_VARIANTS.find(v => v.value === value)
  
  const handleSelect = (variant: TranslationVariant) => {
    onChange(variant)
    setIsOpen(false)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className="h-6 px-2 bg-transparent border-none text-white hover:bg-white/10 text-xs font-body min-w-[100px] w-full justify-between shadow-none"
          title={`Current mode: ${selectedVariant?.label || 'Select mode'}`}
        >
          <span className="truncate">{selectedVariant?.label || 'Select mode'}</span>
          <ChevronDown className="h-3 w-3 text-neutral-400 ml-1 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        className="w-48"
        align="start"
      >
        {TRANSLATION_VARIANTS.map((variant) => (
          <DropdownMenuItem
            key={variant.value}
            onClick={() => handleSelect(variant.value)}
            className={cn(
              "flex items-center justify-between",
              value === variant.value && "bg-accent-500/30"
            )}
            title={variant.description || `Select ${variant.label} mode`}
          >
            <div className="flex flex-col">
              <span className="text-sm font-body">{variant.label}</span>
              {variant.description && (
                <span className="text-xs text-neutral-400">{variant.description}</span>
              )}
            </div>
            {value === variant.value && (
              <CheckCircle2 className="h-4 w-4 text-accent-400 flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

