import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────
// QuotePdfDocument — Modern professional quote PDF
// Support for Multi-Part Batches and Price Breaks.
// ─────────────────────────────────────────────────────────

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
const fmtMm = (n: number | null | undefined) => n != null ? `${n.toFixed(1)}mm` : '—';

interface QuotePdfProps {
  quotes: any[];
  profile: any;
  brandColor?: string;
  customer?: any;
}

export function QuotePdfDocument({ quotes, profile, brandColor = '#ff6600', customer }: QuotePdfProps) {
  const brand = brandColor || '#ff6600';
  const brandDark = darken(brand, 0.2);
  const brandLight = lighten(brand, 0.93);

  const mainQuote = quotes[0];
  if (!mainQuote) return null;

  const shopName = profile?.company || 'Quotation';
  const createdDate = mainQuote.created_at ? new Date(mainQuote.created_at).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const expiresDate = mainQuote.expires_at ? new Date(mainQuote.expires_at).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const quoteRef = mainQuote.quote_number || mainQuote.id.slice(0, 8).toUpperCase();

  const custName = customer?.name || mainQuote.customer_name;
  const custCompany = customer?.company_name;
  const custEmail = customer?.email || mainQuote.customer_email;
  const custPhone = customer?.phone;
  const custAddress = customer?.billing_address;
  const custRef = mainQuote.customer_ref;

  const subtotal = quotes.reduce((acc, q) => acc + (q.total_price || 0), 0);

  const s = StyleSheet.create({
    page: { fontFamily: 'Helvetica', fontSize: 10, color: '#374151', paddingBottom: 60 },
    topBar: { height: 6, backgroundColor: brand },
    content: { paddingHorizontal: 40, paddingTop: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end' },
    logo: { width: 140, height: 46, objectFit: 'contain', marginBottom: 8 },
    companyName: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
    companyDetail: { fontSize: 9, color: '#6b7280', marginBottom: 1 },
    quoteTitle: { fontSize: 22, fontWeight: 'bold', color: brand, marginBottom: 6, letterSpacing: 1 },
    metaLabel: { fontSize: 9, color: '#9ca3af', marginBottom: 1 },
    metaValue: { fontSize: 10, color: '#374151', fontWeight: 'bold', marginBottom: 6 },
    brandDivider: { height: 2, backgroundColor: brand, marginBottom: 20, opacity: 0.3 },
    customerSection: { flexDirection: 'row', marginBottom: 20 },
    customerBlock: { flex: 1 },
    sectionLabel: { fontSize: 8, fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    custName: { fontSize: 12, fontWeight: 'bold', color: '#111827', marginBottom: 2 },
    custDetail: { fontSize: 9, color: '#6b7280', marginBottom: 1, lineHeight: 1.4 },
    // Table
    table: { marginBottom: 20 },
    tableHeader: { flexDirection: 'row', backgroundColor: brand, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4 },
    tableHeaderText: { fontSize: 8, fontWeight: 'bold', color: '#ffffff', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    tableCell: { fontSize: 9, color: '#374151' },
    tableCellBold: { fontSize: 9, color: '#111827', fontWeight: 'bold' },
    colNum: { width: 25 },
    colDesc: { flex: 1 },
    colQty: { width: 45, textAlign: 'right' },
    colUnit: { width: 65, textAlign: 'right' },
    colTotal: { width: 75, textAlign: 'right' },
    // Totals
    totalsBlock: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 },
    totalsTable: { width: 200 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    totalLabel: { fontSize: 9, color: '#6b7280' },
    totalValue: { fontSize: 9, color: '#374151', fontWeight: 'bold' },
    grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginTop: 4, borderTopWidth: 2, borderTopColor: brand },
    grandTotalLabel: { fontSize: 12, fontWeight: 'bold', color: '#111827' },
    grandTotalValue: { fontSize: 12, fontWeight: 'bold', color: brandDark },
    // Part Detail Section
    partDetailBox: { marginTop: 20, padding: 12, backgroundColor: '#fdfdfd', border: '1px solid #eee', borderRadius: 6 },
    partDetailHeader: { fontSize: 11, fontWeight: 'bold', color: '#111827', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: brand, paddingBottom: 4 },
    specsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
    specItem: { width: '33.33%', marginBottom: 8 },
    specLabel: { fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 },
    specValue: { fontSize: 9, color: '#374151', fontWeight: 'bold' },
    // Price Breaks Sub-table
    pbTable: { marginTop: 5, backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden', border: '1px solid #f0f0f0' },
    pbHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    pbHeaderText: { fontSize: 7, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' },
    pbRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
    pbCell: { fontSize: 8, color: '#4b5563' },
    pbColQty: { width: 50 },
    pbColUnit: { flex: 1, textAlign: 'right' },
    pbColTotal: { width: 80, textAlign: 'right' },
    // Misc
    notesBox: { backgroundColor: brandLight, padding: 12, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: brand, marginTop: 20 },
    notesTitle: { fontSize: 8, fontWeight: 'bold', color: '#374151', marginBottom: 4, textTransform: 'uppercase' },
    notesText: { fontSize: 9, color: '#4b5563', lineHeight: 1.4 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    footerContent: { paddingHorizontal: 40, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
    footerText: { fontSize: 8, color: '#9ca3af' },
    bottomBar: { height: 3, backgroundColor: brand }
  });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.topBar} />
        <View style={s.content}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              {profile?.logo_url ? <Image src={profile.logo_url} style={s.logo} /> : <Text style={s.companyName}>{shopName}</Text>}
              {profile?.logo_url && <Text style={{ ...s.companyName, fontSize: 12, marginTop: 2 }}>{shopName}</Text>}
              {profile?.address_line1 && <Text style={s.companyDetail}>{profile.address_line1}</Text>}
              {profile?.phone && <Text style={s.companyDetail}>{profile.phone}</Text>}
              {profile?.website && <Text style={s.companyDetail}>{profile.website}</Text>}
            </View>
            <View style={s.headerRight}>
              <Text style={s.quoteTitle}>QUOTATION</Text>
              <Text style={s.metaLabel}>Reference</Text>
              <Text style={s.metaValue}>{quoteRef}</Text>
              <Text style={s.metaLabel}>Date</Text>
              <Text style={s.metaValue}>{createdDate}</Text>
              {expiresDate && (
                <View>
                  <Text style={s.metaLabel}>Valid Until</Text>
                  <Text style={s.metaValue}>{expiresDate}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.brandDivider} />

          {/* Customer */}
          <View style={s.customerSection}>
            <View style={s.customerBlock}>
              <Text style={s.sectionLabel}>Prepared For</Text>
              {custName && <Text style={s.custName}>{custName}</Text>}
              {custCompany && <Text style={s.custDetail}>{custCompany}</Text>}
              {custEmail && <Text style={s.custDetail}>{custEmail}</Text>}
            </View>
            <View style={s.customerBlock}>
              {custAddress && (
                <View>
                  <Text style={s.sectionLabel}>Billing Address</Text>
                  {custAddress.split('\n').map((line: string, i: number) => <Text key={i} style={s.custDetail}>{line}</Text>)}
                </View>
              )}
              {custRef && (
                <View style={{ marginTop: custAddress ? 8 : 0 }}>
                  <Text style={s.sectionLabel}>Your Reference</Text>
                  <Text style={s.custDetail}>{custRef}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Line Items Table */}
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={{ ...s.tableHeaderText, ...s.colNum }}>#</Text>
              <Text style={{ ...s.tableHeaderText, ...s.colDesc }}>Description</Text>
              <Text style={{ ...s.tableHeaderText, ...s.colQty }}>Qty</Text>
              <Text style={{ ...s.tableHeaderText, ...s.colUnit }}>Unit Price</Text>
              <Text style={{ ...s.tableHeaderText, ...s.colTotal }}>Line Total</Text>
            </View>
            {quotes.map((q, i) => (
              <View key={q.id} style={s.tableRow}>
                <Text style={{ ...s.tableCell, ...s.colNum }}>{i + 1}</Text>
                <View style={s.colDesc}>
                  <Text style={s.tableCellBold}>{q.filename}</Text>
                  <Text style={{ fontSize: 7, color: '#9ca3af', marginTop: 1 }}>
                    {q.materials?.name} {q.thickness_mm}mm · {q.bend_count} bends
                  </Text>
                </View>
                <Text style={{ ...s.tableCellBold, ...s.colQty }}>{q.quantity}</Text>
                <Text style={{ ...s.tableCellBold, ...s.colUnit }}>{fmt(q.unit_price)}</Text>
                <Text style={{ ...s.tableCellBold, ...s.colTotal }}>{fmt(q.total_price)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={s.totalsBlock}>
            <View style={s.totalsTable}>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Subtotal</Text>
                <Text style={s.totalValue}>{fmt(subtotal)}</Text>
              </View>
              <View style={s.grandTotalRow}>
                <Text style={s.grandTotalLabel}>Total Amount</Text>
                <Text style={s.grandTotalValue}>{fmt(subtotal)}</Text>
              </View>
            </View>
          </View>

          {/* Detailed Part Specs & Price Breaks */}
          {quotes.map((q, i) => (
            <View key={q.id} style={s.partDetailBox} wrap={false}>
              <Text style={s.partDetailHeader}>Item {i + 1}: {q.filename}</Text>
              <View style={s.specsGrid}>
                <View style={s.specItem}><Text style={s.specLabel}>Material</Text><Text style={s.specValue}>{q.materials?.name} {q.materials?.grade}</Text></View>
                <View style={s.specItem}><Text style={s.specLabel}>Thickness</Text><Text style={s.specValue}>{fmtMm(q.thickness_mm)}</Text></View>
                <View style={s.specItem}><Text style={s.specLabel}>Dimensions</Text><Text style={s.specValue}>{fmtMm(q.bounding_width_mm)} × {fmtMm(q.bounding_height_mm)}</Text></View>
                <View style={s.specItem}><Text style={s.specLabel}>Cut Length</Text><Text style={s.specValue}>{fmtMm(q.perimeter_mm)}</Text></View>
                <View style={s.specItem}><Text style={s.specLabel}>Process</Text><Text style={s.specValue}>{q.machine_profiles?.name}</Text></View>
                <View style={s.specItem}><Text style={s.specLabel}>Bends / Pierces</Text><Text style={s.specValue}>{q.bend_count} / {q.pierce_count}</Text></View>
              </View>

              {q.price_breaks && Array.isArray(q.price_breaks) && q.price_breaks.length > 0 && (
                <View>
                  <Text style={s.sectionLabel}>Volume Pricing / Price Breaks</Text>
                  <View style={s.pbTable}>
                    <View style={s.pbHeader}>
                      <Text style={{ ...s.pbHeaderText, ...s.pbColQty }}>Quantity</Text>
                      <Text style={{ ...s.pbHeaderText, ...s.pbColUnit }}>Unit Price</Text>
                      <Text style={{ ...s.pbHeaderText, ...s.pbColTotal }}>Total Price</Text>
                    </View>
                    {/* Include the primary quantity break if not in array, or just show all in array */}
                    {q.price_breaks.sort((a:any, b:any) => a.quantity - b.quantity).map((pb: any, j: number) => (
                      <View key={j} style={s.pbRow}>
                        <Text style={{ ...s.pbCell, ...s.pbColQty }}>{pb.quantity}</Text>
                        <Text style={{ ...s.pbCell, ...s.pbColUnit }}>{fmt(pb.unitPrice)}</Text>
                        <Text style={{ ...s.pbCell, ...s.pbColTotal }}>{fmt(pb.totalPrice)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))}

          {mainQuote.notes && (
            <View style={s.notesBox}>
              <Text style={s.notesTitle}>Notes</Text>
              <Text style={s.notesText}>{mainQuote.notes}</Text>
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <View style={s.footerContent}>
            <Text style={s.footerText}>Subject to our standard terms and conditions.</Text>
            <Text style={s.footerText}>Generated via Mechlytix · {quoteRef}</Text>
          </View>
          <View style={s.bottomBar} />
        </View>
      </Page>
    </Document>
  );
}
