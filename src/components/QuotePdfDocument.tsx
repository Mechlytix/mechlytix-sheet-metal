import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────
// QuotePdfDocument — Modern professional quote PDF
// Uses brand colour as accent, sequential quote numbers,
// line-item table, and structured spec grid.
// ─────────────────────────────────────────────────────────

// Helper to darken a hex colour for text contrast
function darken(hex: string, amount = 0.15): string {
  const c = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(c.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(c.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(c.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function lighten(hex: string, amount = 0.92): string {
  const c = hex.replace('#', '');
  const r = Math.min(255, Math.round(parseInt(c.slice(0, 2), 16) + (255 - parseInt(c.slice(0, 2), 16)) * amount));
  const g = Math.min(255, Math.round(parseInt(c.slice(2, 4), 16) + (255 - parseInt(c.slice(2, 4), 16)) * amount));
  const b = Math.min(255, Math.round(parseInt(c.slice(4, 6), 16) + (255 - parseInt(c.slice(4, 6), 16)) * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const fmt = (n: number | null | undefined) => n != null ? `£${n.toFixed(2)}` : '—';
const fmtMm = (n: number | null | undefined) => n != null ? `${n.toFixed(1)} mm` : '—';

interface QuotePdfProps {
  quote: any;
  profile: any;
  mat: any;
  mach: any;
  brandColor?: string;
  customer?: any;
}

export function QuotePdfDocument({ quote, profile, mat, mach, brandColor = '#ff6600', customer }: QuotePdfProps) {
  const brand = brandColor || '#ff6600';
  const brandDark = darken(brand, 0.2);
  const brandLight = lighten(brand, 0.93);

  const shopName = profile?.company || 'Quotation';
  const createdDate = quote.created_at ? new Date(quote.created_at).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const expiresDate = quote.expires_at ? new Date(quote.expires_at).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const quoteRef = quote.quote_number || quote.id.slice(0, 8).toUpperCase();

  // Customer info — prefer linked customer record, fall back to quote inline fields
  const custName = customer?.name || quote.customer_name;
  const custCompany = customer?.company_name;
  const custEmail = customer?.email || quote.customer_email;
  const custPhone = customer?.phone;
  const custAddress = customer?.billing_address;
  const custRef = quote.customer_ref;

  const s = StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 10,
      color: '#374151',
      paddingTop: 0,
      paddingBottom: 60,
      paddingHorizontal: 0,
    },
    // ── Top brand bar ──
    topBar: {
      height: 6,
      backgroundColor: brand,
    },
    // ── Content area ──
    content: {
      paddingHorizontal: 44,
      paddingTop: 24,
    },
    // ── Header ──
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 28,
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      alignItems: 'flex-end',
    },
    logo: {
      width: 140,
      height: 46,
      objectFit: 'contain',
      marginBottom: 8,
    },
    companyName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 4,
    },
    companyDetail: {
      fontSize: 9,
      color: '#6b7280',
      marginBottom: 1,
    },
    quoteTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: brand,
      marginBottom: 6,
      letterSpacing: 1,
    },
    metaLabel: {
      fontSize: 9,
      color: '#9ca3af',
      marginBottom: 1,
    },
    metaValue: {
      fontSize: 10,
      color: '#374151',
      fontWeight: 'bold',
      marginBottom: 6,
    },
    // ── Divider ──
    divider: {
      height: 1,
      backgroundColor: '#e5e7eb',
      marginBottom: 20,
    },
    brandDivider: {
      height: 2,
      backgroundColor: brand,
      marginBottom: 20,
      opacity: 0.3,
    },
    // ── Customer section ──
    customerSection: {
      flexDirection: 'row',
      marginBottom: 24,
    },
    customerBlock: {
      flex: 1,
    },
    sectionLabel: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    custName: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 2,
    },
    custDetail: {
      fontSize: 9,
      color: '#6b7280',
      marginBottom: 1,
      lineHeight: 1.4,
    },
    // ── Line items table ──
    table: {
      marginBottom: 24,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: brand,
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 4,
    },
    tableHeaderText: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
    },
    tableRowAlt: {
      flexDirection: 'row',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
      backgroundColor: '#f9fafb',
    },
    tableCell: {
      fontSize: 10,
      color: '#374151',
    },
    tableCellBold: {
      fontSize: 10,
      color: '#111827',
      fontWeight: 'bold',
    },
    // Widths
    colNum: { width: 30 },
    colDesc: { flex: 1 },
    colQty: { width: 50, textAlign: 'right' },
    colUnit: { width: 70, textAlign: 'right' },
    colTotal: { width: 80, textAlign: 'right' },
    // ── Totals ──
    totalsBlock: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 28,
    },
    totalsTable: {
      width: 220,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    totalLabel: {
      fontSize: 10,
      color: '#6b7280',
    },
    totalValue: {
      fontSize: 10,
      color: '#374151',
      fontWeight: 'bold',
    },
    grandTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      marginTop: 4,
      borderTopWidth: 2,
      borderTopColor: brand,
    },
    grandTotalLabel: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#111827',
    },
    grandTotalValue: {
      fontSize: 13,
      fontWeight: 'bold',
      color: brandDark,
    },
    // ── Specs grid ──
    specsSection: {
      marginBottom: 24,
    },
    specsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    specItem: {
      width: '33.33%',
      paddingVertical: 6,
      paddingRight: 12,
    },
    specLabel: {
      fontSize: 8,
      color: '#9ca3af',
      marginBottom: 2,
    },
    specValue: {
      fontSize: 10,
      color: '#111827',
      fontWeight: 'bold',
    },
    // ── Notes ──
    notesBox: {
      backgroundColor: brandLight,
      padding: 14,
      borderRadius: 6,
      borderLeftWidth: 3,
      borderLeftColor: brand,
      marginBottom: 24,
    },
    notesTitle: {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#374151',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    notesText: {
      fontSize: 9,
      color: '#4b5563',
      lineHeight: 1.5,
    },
    // ── Footer ──
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    footerContent: {
      paddingHorizontal: 44,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
    },
    footerText: {
      fontSize: 8,
      color: '#9ca3af',
    },
    bottomBar: {
      height: 3,
      backgroundColor: brand,
    },
  });

  const qty = quote.quantity ?? 1;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── Top brand colour bar ── */}
        <View style={s.topBar} />

        <View style={s.content}>
          {/* ── Header ── */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              {profile?.logo_url ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={profile.logo_url} style={s.logo} />
              ) : (
                <Text style={s.companyName}>{shopName}</Text>
              )}
              {profile?.logo_url && <Text style={{ ...s.companyName, fontSize: 13, marginTop: 2 }}>{shopName}</Text>}
              {profile?.address_line1 && <Text style={s.companyDetail}>{profile.address_line1}</Text>}
              {profile?.address_line2 && <Text style={s.companyDetail}>{profile.address_line2}</Text>}
              {profile?.phone && <Text style={s.companyDetail}>{profile.phone}</Text>}
              {profile?.website && <Text style={s.companyDetail}>{profile.website}</Text>}
            </View>
            <View style={s.headerRight}>
              <Text style={s.quoteTitle}>QUOTATION</Text>
              <Text style={s.metaLabel}>Quote Reference</Text>
              <Text style={s.metaValue}>{quoteRef}</Text>
              <Text style={s.metaLabel}>Date</Text>
              <Text style={s.metaValue}>{createdDate}</Text>
              {expiresDate && (
                <>
                  <Text style={s.metaLabel}>Valid Until</Text>
                  <Text style={s.metaValue}>{expiresDate}</Text>
                </>
              )}
            </View>
          </View>

          <View style={s.brandDivider} />

          {/* ── Customer ── */}
          {(custName || custEmail || custRef) && (
            <View style={s.customerSection}>
              <View style={s.customerBlock}>
                <Text style={s.sectionLabel}>Prepared For</Text>
                {custName && <Text style={s.custName}>{custName}</Text>}
                {custCompany && <Text style={s.custDetail}>{custCompany}</Text>}
                {custEmail && <Text style={s.custDetail}>{custEmail}</Text>}
                {custPhone && <Text style={s.custDetail}>{custPhone}</Text>}
              </View>
              <View style={s.customerBlock}>
                {custAddress && (
                  <>
                    <Text style={s.sectionLabel}>Billing Address</Text>
                    {custAddress.split('\n').map((line: string, i: number) => (
                      <Text key={i} style={s.custDetail}>{line}</Text>
                    ))}
                  </>
                )}
                {!custAddress && custRef && (
                  <>
                    <Text style={s.sectionLabel}>Reference</Text>
                    <Text style={s.custDetail}>{custRef}</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* ── Line Items Table ── */}
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={{ ...s.tableHeaderText, ...s.colNum }}>#</Text>
              <Text style={{ ...s.tableHeaderText, ...s.colDesc }}>Description</Text>
              <Text style={{ ...s.tableHeaderText, ...s.colQty }}>Qty</Text>
              <Text style={{ ...s.tableHeaderText, ...s.colUnit }}>Unit Price</Text>
              <Text style={{ ...s.tableHeaderText, ...s.colTotal }}>Line Total</Text>
            </View>
            <View style={s.tableRow}>
              <Text style={{ ...s.tableCell, ...s.colNum }}>1</Text>
              <View style={s.colDesc}>
                <Text style={s.tableCellBold}>{quote.filename}</Text>
                <Text style={{ fontSize: 8, color: '#9ca3af', marginTop: 1 }}>
                  {mat ? `${mat.name}${mat.grade ? ` (${mat.grade})` : ''}` : ''}{quote.thickness_mm ? ` · ${quote.thickness_mm}mm` : ''}
                  {quote.bend_count > 0 ? ` · ${quote.bend_count} bend${quote.bend_count > 1 ? 's' : ''}` : ''}
                </Text>
              </View>
              <Text style={{ ...s.tableCellBold, ...s.colQty }}>{qty}</Text>
              <Text style={{ ...s.tableCellBold, ...s.colUnit }}>{fmt(quote.unit_price)}</Text>
              <Text style={{ ...s.tableCellBold, ...s.colTotal }}>{fmt(quote.total_price)}</Text>
            </View>
          </View>

          {/* ── Totals ── */}
          <View style={s.totalsBlock}>
            <View style={s.totalsTable}>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Subtotal</Text>
                <Text style={s.totalValue}>{fmt(quote.total_price)}</Text>
              </View>
              {custRef && (
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>PO / Ref</Text>
                  <Text style={{ ...s.totalValue, fontWeight: 'medium' }}>{custRef}</Text>
                </View>
              )}
              <View style={s.grandTotalRow}>
                <Text style={s.grandTotalLabel}>Total</Text>
                <Text style={s.grandTotalValue}>{fmt(quote.total_price)}</Text>
              </View>
            </View>
          </View>

          <View style={s.divider} />

          {/* ── Part Specifications ── */}
          <View style={s.specsSection}>
            <Text style={s.sectionLabel}>Part Specifications</Text>
            <View style={s.specsGrid}>
              {mat && (
                <View style={s.specItem}>
                  <Text style={s.specLabel}>Material</Text>
                  <Text style={s.specValue}>{mat.name}{mat.grade ? ` (${mat.grade})` : ''}</Text>
                </View>
              )}
              <View style={s.specItem}>
                <Text style={s.specLabel}>Thickness</Text>
                <Text style={s.specValue}>{fmtMm(quote.thickness_mm)}</Text>
              </View>
              <View style={s.specItem}>
                <Text style={s.specLabel}>Dimensions</Text>
                <Text style={s.specValue}>
                  {quote.bounding_width_mm && quote.bounding_height_mm
                    ? `${fmtMm(quote.bounding_width_mm)} × ${fmtMm(quote.bounding_height_mm)}`
                    : '—'}
                </Text>
              </View>
              <View style={s.specItem}>
                <Text style={s.specLabel}>Cut Length</Text>
                <Text style={s.specValue}>{fmtMm(quote.perimeter_mm)}</Text>
              </View>
              <View style={s.specItem}>
                <Text style={s.specLabel}>Bends</Text>
                <Text style={s.specValue}>{quote.bend_count ?? 0}</Text>
              </View>
              <View style={s.specItem}>
                <Text style={s.specLabel}>Pierces</Text>
                <Text style={s.specValue}>{quote.pierce_count ?? 0}</Text>
              </View>
              {mach && (
                <View style={s.specItem}>
                  <Text style={s.specLabel}>Process</Text>
                  <Text style={s.specValue}>{mach.name}</Text>
                </View>
              )}
              <View style={s.specItem}>
                <Text style={s.specLabel}>File Type</Text>
                <Text style={{ ...s.specValue, textTransform: 'uppercase' }}>{quote.input_type}</Text>
              </View>
            </View>
          </View>

          {/* ── Notes ── */}
          {quote.notes && (
            <View style={s.notesBox}>
              <Text style={s.notesTitle}>Notes</Text>
              <Text style={s.notesText}>{quote.notes}</Text>
            </View>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <View style={s.footerContent}>
            <Text style={s.footerText}>
              This quotation is subject to our standard terms and conditions.
            </Text>
            <Text style={s.footerText}>
              Generated via Mechlytix · {quoteRef}
            </Text>
          </View>
          <View style={s.bottomBar} />
        </View>
      </Page>
    </Document>
  );
}
