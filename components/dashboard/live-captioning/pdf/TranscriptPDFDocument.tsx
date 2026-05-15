'use client'

import { Document, Page, View, Text, Font, StyleSheet } from '@react-pdf/renderer'

// Register fonts at module level (before component)
Font.register({
  family: 'Amiri',
  fonts: [
    { src: '/fonts/Amiri-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Amiri-Bold.ttf', fontWeight: 'bold' },
  ],
})

// Fallback to Helvetica for Latin text since Inter download failed
// @react-pdf/renderer includes Helvetica by default
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
    paddingBottom: 40,
    paddingLeft: 0,
    paddingRight: 0,
  },
  header: {
    backgroundColor: '#0D1B20',
    paddingHorizontal: 40,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // MinbarAI 3D cube logo — visual representation using layered rectangles
  // Approximates the isometric cube design from components/ui/logo-brand.tsx
  headerLogo: {
    width: 20,
    height: 20,
    backgroundColor: '#55a39a',
    borderRadius: 2,
  },
  headerLogoDetail: {
    width: 3,
    height: 3,
    backgroundColor: '#70b3aa',
  },
  headerBrandText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerPageNum: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#9CA3AF',
  },
  metaSection: {
    marginHorizontal: 40,
    marginTop: 24,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  metaTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: '#0D1B20',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#6B7280',
    width: 100,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1F2937',
    flex: 1,
  },
  accentDot: {
    width: 8,
    height: 8,
    backgroundColor: '#55a39a',
    borderRadius: 4,
    marginRight: 8,
    marginTop: 1,
  },
  section: {
    marginHorizontal: 40,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#0D1B20',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionDivider: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#55a39a',
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 11,
    lineHeight: 1.7,
    color: '#1F2937',
  },
  rtlText: {
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  footerText: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#9CA3AF',
  },
  footerAccent: {
    color: '#55a39a',
  },
})

export interface TranscriptPDFDocumentProps {
  sourceText: string
  translationText: string
  sourceLangName: string
  targetLangName: string
  sourceIsRTL: boolean
  targetIsRTL: boolean
  sourceFontFamily: 'Amiri' | 'Helvetica'
  targetFontFamily: 'Amiri' | 'Helvetica'
  translationVariant: string
  sessionStartedAt: string | null
  generatedAt: Date
}

export function TranscriptPDFDocument(props: TranscriptPDFDocumentProps) {
  const {
    sourceText,
    translationText,
    sourceLangName,
    targetLangName,
    sourceIsRTL,
    targetIsRTL,
    sourceFontFamily,
    targetFontFamily,
    translationVariant,
    sessionStartedAt,
    generatedAt,
  } = props

  const formattedDate = generatedAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const formattedGenerated = generatedAt.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const formattedSessionStart = sessionStartedAt
    ? new Date(sessionStartedAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'N/A'

  const variantLabels: Record<string, string> = {
    normal: 'Normal',
    quran: 'Quran',
    hadith: 'Hadith',
    quran_hadith: 'Quran & Hadith',
  }

  const trimmedSource = sourceText.trim()
  const trimmedTranslation = translationText.trim()

  return (
    <Document
      title="MinbarAI Khutba Transcript"
      author="MinbarAI"
      creator="MinbarAI.com"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header} fixed>
          <View style={styles.headerBrand}>
            {/* MinbarAI 3D cube logo — isometric design from logo-brand.tsx */}
            <View style={[styles.headerLogo, { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }]}>
              {/* Left face shadow to suggest depth */}
              <View style={[styles.headerLogoDetail, { backgroundColor: '#4a9e93' }]} />
              {/* Right face highlight */}
              <View style={[styles.headerLogoDetail, { backgroundColor: '#70b3aa' }]} />
            </View>
            <Text style={styles.headerBrandText}>MinbarAI</Text>
          </View>
          <Text
            style={styles.headerPageNum}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>

        {/* ── Metadata block ── */}
        <View style={styles.metaSection}>
          <Text style={styles.metaTitle}>Khutba Transcript</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{formattedDate}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Session Start</Text>
            <Text style={styles.metaValue}>{formattedSessionStart}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Generated</Text>
            <Text style={styles.metaValue}>{formattedGenerated}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Source</Text>
            <Text style={styles.metaValue}>{sourceLangName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Translation</Text>
            <Text style={styles.metaValue}>{targetLangName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Mode</Text>
            <Text style={styles.metaValue}>
              {variantLabels[translationVariant] ?? translationVariant}
            </Text>
          </View>
        </View>

        {/* ── Source section ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.accentDot} />
            <Text style={styles.sectionTitle}>Source — {sourceLangName}</Text>
          </View>
          <View style={styles.sectionDivider} />
          {trimmedSource ? (
            <Text
              style={
                sourceIsRTL
                  ? [styles.bodyText, { fontFamily: sourceFontFamily }, styles.rtlText]
                  : [styles.bodyText, { fontFamily: sourceFontFamily }]
              }
            >
              {trimmedSource}
            </Text>
          ) : (
            <Text style={styles.emptyText}>No source text recorded.</Text>
          )}
        </View>

        {/* ── Translation section ── */}
        <View style={[styles.section, { marginTop: 28 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.accentDot} />
            <Text style={styles.sectionTitle}>
              Translation — {targetLangName}
            </Text>
          </View>
          <View style={styles.sectionDivider} />
          {trimmedTranslation ? (
            <Text
              style={
                targetIsRTL
                  ? [styles.bodyText, { fontFamily: targetFontFamily }, styles.rtlText]
                  : [styles.bodyText, { fontFamily: targetFontFamily }]
              }
            >
              {trimmedTranslation}
            </Text>
          ) : (
            <Text style={styles.emptyText}>No translation recorded.</Text>
          )}
        </View>

        {/* ── Footer (fixed, appears on every page) ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by{' '}
            <Text style={styles.footerAccent}>MinbarAI.com</Text>
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
