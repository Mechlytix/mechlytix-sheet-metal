import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Font registration (optional, but good for professional look if needed, we'll use default Helvetica for now)

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: 'contain',
    marginBottom: 10,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 5,
  },
  companyDetail: {
    color: '#666',
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  label: {
    width: 120,
    color: '#666',
  },
  value: {
    flex: 1,
    color: '#111',
    fontWeight: 'medium',
  },
  priceHero: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 8,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  priceHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceHeroLabel: {
    fontSize: 14,
    color: '#4b5563',
  },
  priceHeroValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 9,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  }
});

// Helper to format currency
const fmt = (n: number | null | undefined) => n != null ? `£${n.toFixed(2)}` : '—';
const fmtMm = (n: number | null | undefined) => n != null ? `${n.toFixed(1)} mm` : '—';

export function QuotePdfDocument({ quote, profile, mat, mach }: { 
  quote: any; 
  profile: any; 
  mat: any; 
  mach: any; 
}) {
  const shopName = profile?.company || 'Fabrication Quote';
  const createdDate = quote.created_at ? new Date(quote.created_at).toLocaleDateString("en-GB") : '—';
  const expiresDate = quote.expires_at ? new Date(quote.expires_at).toLocaleDateString("en-GB") : '—';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {profile?.logo_url ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={profile.logo_url} style={styles.logo} />
            ) : (
              <Text style={styles.companyName}>{shopName}</Text>
            )}
            {profile?.address_line1 && <Text style={styles.companyDetail}>{profile.address_line1}</Text>}
            {profile?.address_line2 && <Text style={styles.companyDetail}>{profile.address_line2}</Text>}
            {profile?.phone && <Text style={styles.companyDetail}>{profile.phone}</Text>}
            {profile?.website && <Text style={styles.companyDetail}>{profile.website}</Text>}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>QUOTATION</Text>
            <Text style={styles.subtitle}>Ref: {quote.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.subtitle}>Date: {createdDate}</Text>
            {expiresDate !== '—' && <Text style={styles.subtitle}>Valid Until: {expiresDate}</Text>}
          </View>
        </View>

        {/* Customer Details */}
        {(quote.customer_name || quote.customer_email || quote.customer_ref) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prepared For</Text>
            {quote.customer_name && (
              <View style={styles.row}>
                <Text style={styles.label}>Name:</Text>
                <Text style={styles.value}>{quote.customer_name}</Text>
              </View>
            )}
            {quote.customer_email && (
              <View style={styles.row}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{quote.customer_email}</Text>
              </View>
            )}
            {quote.customer_ref && (
              <View style={styles.row}>
                <Text style={styles.label}>Reference:</Text>
                <Text style={styles.value}>{quote.customer_ref}</Text>
              </View>
            )}
          </View>
        )}

        {/* Pricing Summary */}
        <View style={styles.priceHero}>
          <View style={styles.priceHeroRow}>
            <Text style={styles.priceHeroLabel}>Part File:</Text>
            <Text style={styles.value}>{quote.filename}</Text>
          </View>
          <View style={styles.priceHeroRow}>
            <Text style={styles.priceHeroLabel}>Unit Price:</Text>
            <Text style={styles.priceHeroValue}>{fmt(quote.unit_price)}</Text>
          </View>
          <View style={styles.priceHeroRow}>
            <Text style={styles.priceHeroLabel}>Quantity:</Text>
            <Text style={styles.value}>{quote.quantity ?? 1}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Price:</Text>
            <Text style={styles.totalValue}>{fmt(quote.total_price)}</Text>
          </View>
        </View>

        {/* Part Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Part Specifications</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Material:</Text>
            <Text style={styles.value}>{mat ? `${mat.name}${mat.grade ? ` (${mat.grade})` : ''}` : '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Thickness:</Text>
            <Text style={styles.value}>{fmtMm(quote.thickness_mm)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Dimensions:</Text>
            <Text style={styles.value}>
              {quote.bounding_width_mm && quote.bounding_height_mm 
                ? `${fmtMm(quote.bounding_width_mm)} × ${fmtMm(quote.bounding_height_mm)}` 
                : '—'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Cut Length:</Text>
            <Text style={styles.value}>{fmtMm(quote.perimeter_mm)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Bends:</Text>
            <Text style={styles.value}>{quote.bend_count ?? 0}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Pierces:</Text>
            <Text style={styles.value}>{quote.pierce_count ?? 0}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Process:</Text>
            <Text style={styles.value}>{mach?.name ?? '—'}</Text>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ color: '#4b5563', lineHeight: 1.5 }}>{quote.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          This quotation is subject to our standard terms and conditions. Generated via Mechlytix.
        </Text>
      </Page>
    </Document>
  );
}
