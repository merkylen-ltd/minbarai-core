'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronDown, 
  Search, 
  ArrowRightLeft, 
  Globe,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { 
  LanguageConfig, 
  getLanguageConfig, 
  searchLanguages,
  POPULAR_LANGUAGES,
  getAllLanguages,
  isRTL,
  getLanguageFamily
} from '@/constants/languages'

interface LanguageSelectorProps {
  value: string
  onChange: (language: string) => void
  placeholder?: string
  showPopularOnly?: boolean
  excludeLanguages?: string[]
  disabled?: boolean
  variant?: 'default' | 'compact' | 'minimal'
  showLanguageInfo?: boolean
  className?: string
}

export function LanguageSelector({
  value,
  onChange,
  placeholder = 'Select language',
  showPopularOnly = true,
  excludeLanguages = [],
  disabled = false,
  variant = 'default',
  showLanguageInfo = true,
  className
}: LanguageSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const selectedConfig = getLanguageConfig(value)

  // Filter and search languages
  const filteredLanguages = useMemo(() => {
    const baseLanguages = showPopularOnly 
      ? POPULAR_LANGUAGES.map(getLanguageConfig)
      : getAllLanguages()
    
    let filtered = baseLanguages.filter(lang => 
      !excludeLanguages.includes(lang.code)
    )

    if (searchQuery.trim()) {
      filtered = searchLanguages(searchQuery.trim()).filter(lang =>
        !excludeLanguages.includes(lang.code)
      )
    }

    return filtered.slice(0, 200) // Limit results for performance
  }, [showPopularOnly, excludeLanguages, searchQuery])

  // Group languages by popularity and alphabetically
  const groupedLanguages = useMemo(() => {
    const popular: LanguageConfig[] = []
    const others: LanguageConfig[] = []

    filteredLanguages.forEach(lang => {
      if (POPULAR_LANGUAGES.includes(lang.code)) {
        popular.push(lang)
      } else {
        others.push(lang)
      }
    })

    // Sort alphabetically
    popular.sort((a, b) => a.name.localeCompare(b.name))
    others.sort((a, b) => a.name.localeCompare(b.name))

    return { popular, others }
  }, [filteredLanguages])

  const handleLanguageSelect = (language: string) => {
    onChange(language)
    setIsOpen(false)
    setSearchQuery('')
  }

  const getLanguageDisplayText = (config: LanguageConfig) => {
    switch (variant) {
      case 'compact':
        return config.name
      case 'minimal':
        return config.name
      default:
        return config.name
    }
  }

  const getButtonContent = () => {
    if (variant === 'compact') {
      return (
        <div className="flex items-center space-x-1">
          <span className="font-body text-sm text-white">{getLanguageDisplayText(selectedConfig)}</span>
          <ChevronDown className="h-3 w-3 text-neutral-400" />
        </div>
      )
    }

    if (variant === 'minimal') {
      return (
        <div className="flex items-center space-x-2">
          <span className="font-body text-white">{getLanguageDisplayText(selectedConfig)}</span>
          <ChevronDown className="h-4 w-4 text-neutral-400" />
        </div>
      )
    }

    return (
      <div className="flex items-center space-x-2">
        <Globe className="h-4 w-4" />
        <span className="font-body">{getLanguageDisplayText(selectedConfig)}</span>
        {showLanguageInfo && (
          <div className="flex items-center space-x-1">
            {isRTL(selectedConfig.code) && (
              <Badge variant="secondary" className="text-xs">RTL</Badge>
            )}
            {selectedConfig.family !== 'latin' && (
              <Badge variant="outline" className="text-xs capitalize">
                {selectedConfig.family}
              </Badge>
            )}
          </div>
        )}
        <ChevronDown className="h-4 w-4" />
      </div>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-between min-h-[44px] md:min-h-0",
            variant === 'compact' && "h-8 md:h-8 px-2 bg-transparent border-white/20 text-white hover:bg-white/10",
            variant === 'minimal' && "border-none shadow-none bg-transparent text-white hover:bg-white/10",
            className
          )}
        >
          {getButtonContent()}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        className="w-80 max-h-96 overflow-hidden bg-primary-800 border border-accent-500/20"
        align="start"
      >
        {/* Search input */}
        <div className="p-2 border-b border-accent-500/20">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search languages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-primary-700 border-accent-500/20 text-white placeholder-neutral-400"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {/* Popular languages */}
          {groupedLanguages.popular.length > 0 && !searchQuery && (
            <>
              <DropdownMenuLabel className="text-xs text-neutral-400 px-2 py-1">
                Popular Languages
              </DropdownMenuLabel>
              {groupedLanguages.popular.map((language) => (
                <LanguageMenuItem
                  key={language.code}
                  language={language}
                  isSelected={language.code === value}
                  onSelect={() => handleLanguageSelect(language.code)}
                  showInfo={showLanguageInfo}
                />
              ))}
              {groupedLanguages.others.length > 0 && <DropdownMenuSeparator />}
            </>
          )}

          {/* Other languages */}
          {groupedLanguages.others.length > 0 && !searchQuery && (
            <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1">
              All Languages
            </DropdownMenuLabel>
          )}

          {/* Search results or all languages */}
          {(searchQuery ? filteredLanguages : groupedLanguages.others).map((language) => (
            <LanguageMenuItem
              key={language.code}
              language={language}
              isSelected={language.code === value}
              onSelect={() => handleLanguageSelect(language.code)}
              showInfo={showLanguageInfo}
            />
          ))}

          {/* No results */}
          {filteredLanguages.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mx-auto mb-2" />
              No languages found
            </div>
          )}
        </div>

        {/* Footer info */}
        {!searchQuery && (
          <div className="border-t p-2 text-xs text-muted-foreground">
            {filteredLanguages.length} of {showPopularOnly ? POPULAR_LANGUAGES.length : getAllLanguages().length} languages
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface LanguageMenuItemProps {
  language: LanguageConfig
  isSelected: boolean
  onSelect: () => void
  showInfo?: boolean
}

function LanguageMenuItem({ 
  language, 
  isSelected, 
  onSelect, 
  showInfo = true 
}: LanguageMenuItemProps) {
  return (
    <DropdownMenuItem 
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between px-2 py-2 cursor-pointer text-white hover:bg-accent-500/20 min-h-[44px] md:min-h-0",
        isSelected && "bg-accent-500/30"
      )}
    >
      <div className="flex items-center space-x-2 flex-1">
        <div 
          className={cn(
            "text-sm font-body text-white",
            isRTL(language.code) && "text-right"
          )}
          dir={isRTL(language.code) ? 'rtl' : 'ltr'}
        >
          {language.name}
        </div>
        
        {showInfo && (
          <div className="flex items-center space-x-1">
            <Badge variant="secondary" className="text-xs bg-accent-500/20 text-accent-300">
              {language.code.toUpperCase()}
            </Badge>
            
            {isRTL(language.code) && (
              <Badge variant="outline" className="text-xs border-accent-500/30 text-accent-300">RTL</Badge>
            )}
            
            {language.family !== 'latin' && (
              <Badge variant="outline" className="text-xs capitalize border-accent-500/30 text-accent-300">
                {language.family}
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {isSelected && (
        <CheckCircle2 className="h-4 w-4 text-accent-400" />
      )}
    </DropdownMenuItem>
  )
}

// Language pair selector component
interface LanguagePairSelectorProps {
  sourceLanguage: string
  targetLanguage: string
  onSourceChange: (language: string) => void
  onTargetChange: (language: string) => void
  onSwap?: () => void
  disabled?: boolean
  showPopularOnly?: boolean
  className?: string
}

export function LanguagePairSelector({
  sourceLanguage,
  targetLanguage,
  onSourceChange,
  onTargetChange,
  onSwap,
  disabled = false,
  showPopularOnly = true,
  className
}: LanguagePairSelectorProps) {
  return (
    <div className={cn("flex items-center space-x-3", className)}>
      <div className="flex-1">
        <LanguageSelector
          value={sourceLanguage}
          onChange={onSourceChange}
          excludeLanguages={[targetLanguage]}
          disabled={disabled}
          showPopularOnly={showPopularOnly}
          placeholder="Source language"
          variant="minimal"
        />
      </div>
      
      {onSwap && (
        <button
          onClick={onSwap}
          disabled={disabled}
          className="p-1.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
          title="Swap languages"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </button>
      )}
      
      <div className="flex-1">
        <LanguageSelector
          value={targetLanguage}
          onChange={onTargetChange}
          excludeLanguages={[sourceLanguage]}
          disabled={disabled}
          showPopularOnly={showPopularOnly}
          placeholder="Target language"
          variant="minimal"
        />
      </div>
    </div>
  )
}

export default LanguageSelector
