import { useAuth } from '@clerk/clerk-expo';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, FlatList, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { api, setAuthToken } from '../../services/api';
import { useBusiness } from '../../context/BusinessContext';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  gstin?: string;
}

interface RentalProduct {
  id: string;
  name: string;
  rate: number;
  gst_rate: number;
  hsn_code?: string;
}

interface RentalAsset {
  id: string;
  asset_code: string;
  status: string;
}

interface OrderItem {
  id: string;
  product: RentalProduct | null;
  quantity: string;
  rate: string;
  gstRate: string;
  assetCodes: string[];
  availableAssets: RentalAsset[];
  loadingAssets: boolean;
  availabilityChecked: boolean;
  isAvailable: boolean;
  availableQtyMsg: string;
}

const GST_RATES = ['0', '5', '18', '40'];

export default function OrderCreateScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { business } = useBusiness();

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form Fields
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 86400000)); // Default 1 day later
  const [rateType, setRateType] = useState('DAILY');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [lateFee, setLateFee] = useState('');
  const [notes, setNotes] = useState('');

  // Items List (at least one row)
  const [items, setItems] = useState<OrderItem[]>([
    {
      id: Math.random().toString(),
      product: null,
      quantity: '1',
      rate: '',
      gstRate: '18',
      assetCodes: [],
      availableAssets: [],
      loadingAssets: false,
      availabilityChecked: false,
      isAvailable: true,
      availableQtyMsg: ''
    }
  ]);

  // Modals Visibility
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [activeItemIndexForProduct, setActiveItemIndexForProduct] = useState<number | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [activeItemIndexForAsset, setActiveItemIndexForAsset] = useState<number | null>(null);
  const [showAssetModal, setShowAssetModal] = useState(false);

  // Date Pickers Visibility
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Fetch Master Lists
  useEffect(() => {
    const loadMasterData = async () => {
      if (!business?.id) return;
      try {
        setLoadingData(true);
        const token = await getToken();
        setAuthToken(token);

        const [custRes, prodRes] = await Promise.all([
          api.get(`/customers/?business_id=${business.id}`),
          api.get(`/rental-products/?business_id=${business.id}`)
        ]);

        setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      } catch (err) {
        console.log('Error loading order creation master data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    loadMasterData();
  }, [business?.id, getToken]);

  // Load Available Assets for selected Product row
  const fetchAvailableAssetsForItem = async (index: number, productId: string) => {
    if (!business?.id) return;
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, loadingAssets: true } : it))
    );

    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await api.get(
        `/rental-assets/?business_id=${business.id}&rental_product_id=${productId}&status=AVAILABLE`
      );

      setItems((prev) =>
        prev.map((it, idx) =>
          idx === index
            ? { ...it, availableAssets: res.data || [], loadingAssets: false }
            : it
        )
      );
    } catch (err) {
      console.log('Error loading product assets:', err);
      setItems((prev) =>
        prev.map((it, idx) => (idx === index ? { ...it, loadingAssets: false } : it))
      );
    }
  };

  // Perform stock availability check
  const checkStockAvailability = async (index: number, it: OrderItem) => {
    if (!business?.id || !it.product || !it.quantity) return;
    const qty = parseInt(it.quantity);
    if (isNaN(qty) || qty <= 0) return;

    try {
      const token = await getToken();
      setAuthToken(token);

      const payload = {
        rental_product_id: it.product.id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        quantity_needed: qty
      };

      const res = await api.post(
        `/rental-orders/availability/check?business_id=${business.id}`,
        payload
      );

      setItems((prev) =>
        prev.map((item, idx) => {
          if (idx !== index) return item;
          return {
            ...item,
            availabilityChecked: true,
            isAvailable: res.data.is_available,
            availableQtyMsg: res.data.is_available
              ? ''
              : `⚠️ Only ${res.data.available_quantity} available for these dates.`
          };
        })
      );
    } catch (err) {
      console.log('Stock check error:', err);
    }
  };

  // Trigger stock check when dates or quantities change
  useEffect(() => {
    items.forEach((it, index) => {
      if (it.product) {
        checkStockAvailability(index, it);
      }
    });
  }, [startDate, endDate]);

  const handleAddField = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        product: null,
        quantity: '1',
        rate: '',
        gstRate: '18',
        assetCodes: [],
        availableAssets: [],
        loadingAssets: false,
        availabilityChecked: false,
        isAvailable: true,
        availableQtyMsg: ''
      }
    ]);
  };

  const handleRemoveField = (index: number) => {
    if (items.length === 1) {
      Alert.alert('Required Item', 'A rental order must contain at least one item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductSelect = (index: number, product: RentalProduct) => {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const updated = {
          ...it,
          product,
          rate: String(product.rate),
          gstRate: String(Math.round(product.gst_rate || 18)),
          assetCodes: [],
          availabilityChecked: false
        };
        // Trigger availability check & assets load
        fetchAvailableAssetsForItem(index, product.id);
        checkStockAvailability(index, updated);
        return updated;
      })
    );
    setShowProductModal(false);
  };

  const handleQuantityChange = (index: number, val: string) => {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        // Limit selected asset codes to matching new quantity
        const qty = parseInt(val) || 0;
        const currentAssets = it.assetCodes.slice(0, qty);
        const updated = { ...it, quantity: val, assetCodes: currentAssets, availabilityChecked: false };
        checkStockAvailability(index, updated);
        return updated;
      })
    );
  };

  const handleSaveOrder = async () => {
    if (!business?.id) return;
    if (!selectedCustomer) {
      Alert.alert('Validation Error', 'Please select a customer.');
      return;
    }
    if (endDate <= startDate) {
      Alert.alert('Validation Error', 'End date must be after the start date.');
      return;
    }

    // Validate Items
    const errors: string[] = [];
    const validItems: any[] = [];

    items.forEach((it, idx) => {
      if (!it.product) {
        errors.push(`Line ${idx + 1}: Select a rental product.`);
        return;
      }
      const qtyVal = parseInt(it.quantity);
      if (isNaN(qtyVal) || qtyVal <= 0) {
        errors.push(`Line ${idx + 1}: Enter a valid quantity.`);
        return;
      }
      const rateVal = parseFloat(it.rate);
      if (isNaN(rateVal) || rateVal < 0) {
        errors.push(`Line ${idx + 1}: Enter a valid rate.`);
        return;
      }

      validItems.push({
        rental_product_id: it.product.id,
        quantity_rented: qtyVal,
        rate: rateVal,
        gst_rate: parseFloat(it.gstRate),
        asset_codes: it.assetCodes.length > 0 ? it.assetCodes : undefined
      });
    });

    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      setAuthToken(token);

      const payload = {
        customer_id: selectedCustomer.id,
        invoice_date: null,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        rental_rate_type: rateType,
        security_deposit: parseFloat(securityDeposit) || 0,
        late_fee_per_day: parseFloat(lateFee) || 0,
        notes: notes.trim() || null,
        items: validItems
      };

      await api.post(`/rental-orders/?business_id=${business.id}`, payload);
      Alert.alert('Success', 'Rental order created successfully.');
      router.back();
    } catch (err: any) {
      console.log('Error creating rental order:', err);
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create rental order.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  if (loadingData) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.textMuted }}>Loading order details...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Rental Order</Text>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSaveOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <>
              <Ionicons name="save-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 60 }}
        enableOnAndroid={true}
        extraScrollHeight={40}
        keyboardShouldPersistTaps="handled"
      >
        {/* Customer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Customer Details</Text>
          <TouchableOpacity
            style={styles.pickerSelector}
            onPress={() => {
              setCustomerSearch('');
              setShowCustomerModal(true);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: selectedCustomer ? Colors.text : '#94A3B8' }}>
                {selectedCustomer ? selectedCustomer.name : 'Select Customer *'}
              </Text>
              {selectedCustomer?.phone && (
                <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                  Phone: {selectedCustomer.phone}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Rental Dates Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rental Timeline</Text>
          <View style={styles.flexRow}>
            {/* Start Date Picker */}
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Start Date *</Text>
              <TouchableOpacity style={styles.dateSelector} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.dateSelectorText}>
                  {startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowStartPicker(false);
                    if (date) {
                      setStartDate(date);
                      if (date >= endDate) {
                        setEndDate(new Date(date.getTime() + 86400000));
                      }
                    }
                  }}
                />
              )}
            </View>

            {/* End Date Picker */}
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>End Date *</Text>
              <TouchableOpacity style={styles.dateSelector} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.dateSelectorText}>
                  {endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  minimumDate={startDate}
                  onChange={(event, date) => {
                    setShowEndPicker(false);
                    if (date) setEndDate(date);
                  }}
                />
              )}
            </View>
          </View>
        </View>

        {/* Rate Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rental Pricing & Fees</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Rate Cycle</Text>
            <View style={styles.segmentedContainer}>
              {['DAILY', 'WEEKLY', 'MONTHLY'].map((cycle) => (
                <TouchableOpacity
                  key={cycle}
                  style={[
                    styles.segmentButton,
                    rateType === cycle ? styles.segmentActive : null
                  ]}
                  onPress={() => setRateType(cycle)}
                >
                  <Text style={[
                    styles.segmentText,
                    rateType === cycle ? styles.segmentTextActive : null
                  ]}>
                    {cycle.charAt(0) + cycle.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Security Deposit & Late Fees */}
          <View style={styles.flexRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Security Deposit (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={securityDeposit}
                onChangeText={setSecurityDeposit}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Late Fee / Day (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={lateFee}
                onChangeText={setLateFee}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
        </View>

        {/* Line Items Section */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>Line Items</Text>
            <TouchableOpacity style={styles.addRowLink} onPress={handleAddField}>
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={styles.addRowLinkText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {items.map((row, index) => (
            <View key={row.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemNumber}>Item #{index + 1}</Text>
                <TouchableOpacity onPress={() => handleRemoveField(index)}>
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>

              {/* Product selector */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Rental Product *</Text>
                <TouchableOpacity
                  style={styles.itemPickerBtn}
                  onPress={() => {
                    setActiveItemIndexForProduct(index);
                    setProductSearch('');
                    setShowProductModal(true);
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: row.product ? Colors.text : '#94A3B8' }}>
                    {row.product ? row.product.name : 'Select Product *'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Quantity & Rate override */}
              <View style={styles.flexRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Qty *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    value={row.quantity}
                    onChangeText={(val) => handleQuantityChange(index, val)}
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.fieldLabel}>Rate (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    value={row.rate}
                    onChangeText={(val) =>
                      setItems((prev) =>
                        prev.map((it, idx) => (idx === index ? { ...it, rate: val } : it))
                      )
                    }
                    keyboardType="numeric"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              {/* GST rate selector chips */}
              <View style={[styles.fieldContainer, { marginTop: 10 }]}>
                <Text style={styles.fieldLabel}>GST Rate *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {GST_RATES.map((rateStr) => {
                    const isSelected = row.gstRate === rateStr;
                    return (
                      <TouchableOpacity
                        key={rateStr}
                        style={[styles.gstChip, isSelected ? styles.gstChipActive : null]}
                        onPress={() =>
                          setItems((prev) =>
                            prev.map((it, idx) => (idx === index ? { ...it, gstRate: rateStr } : it))
                          )
                        }
                      >
                        <Text style={[styles.gstChipText, isSelected ? styles.gstChipTextActive : null]}>
                          {rateStr}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Asset Allocation Button (Only displayed if trackable assets exist) */}
              {row.product && !row.loadingAssets && row.availableAssets.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  <TouchableOpacity
                    style={styles.assetPickerLink}
                    onPress={() => {
                      setActiveItemIndexForAsset(index);
                      setShowAssetModal(true);
                    }}
                  >
                    <Ionicons name="hardware-chip-outline" size={14} color={Colors.primary} />
                    <Text style={styles.assetPickerLinkText}>
                      Select Assets ({row.assetCodes.length} selected / {row.quantity} required)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Availability check warning label */}
              {row.product && !row.isAvailable && row.availableQtyMsg ? (
                <Text style={styles.warningText}>{row.availableQtyMsg}</Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            placeholder="Terms, conditions, specific notes..."
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </KeyboardAwareScrollView>

      {/* Customer Modal */}
      <Modal visible={showCustomerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search by name or phone..."
                value={customerSearch}
                onChangeText={setCustomerSearch}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedCustomer?.id === item.id ? styles.modalItemActive : null
                  ]}
                  onPress={() => {
                    setSelectedCustomer(item);
                    setShowCustomerModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    {item.phone && (
                      <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                        Phone: {item.phone}
                      </Text>
                    )}
                  </View>
                  {selectedCustomer?.id === item.id && (
                    <Ionicons name="checkmark" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Product Modal */}
      <Modal visible={showProductModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Rental Product</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search products..."
                value={productSearch}
                onChangeText={setProductSearch}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    if (activeItemIndexForProduct !== null) {
                      handleProductSelect(activeItemIndexForProduct, item);
                    }
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                      Rate: ₹{item.rate} · GST: {item.gst_rate}%
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Asset Picker Modal */}
      <Modal
        visible={showAssetModal && activeItemIndexForAsset !== null}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Allocate Available Assets</Text>
              <TouchableOpacity onPress={() => setShowAssetModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {activeItemIndexForAsset !== null && (
              <FlatList
                data={items[activeItemIndexForAsset].availableAssets}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => {
                  const selectedList = items[activeItemIndexForAsset].assetCodes;
                  const isSelected = selectedList.includes(item.asset_code);

                  return (
                    <TouchableOpacity
                      style={[styles.modalItem, isSelected ? styles.modalItemActive : null]}
                      onPress={() => {
                        const qtyLimit = parseInt(items[activeItemIndexForAsset].quantity) || 1;
                        let updated = [];

                        if (isSelected) {
                          updated = selectedList.filter((code) => code !== item.asset_code);
                        } else {
                          if (selectedList.length >= qtyLimit) {
                            Alert.alert(
                              'Limit Reached',
                              `You can only select up to ${qtyLimit} assets based on order quantity.`
                            );
                            return;
                          }
                          updated = [...selectedList, item.asset_code];
                        }

                        setItems((prev) =>
                          prev.map((it, idx) =>
                            idx === activeItemIndexForAsset
                              ? { ...it, assetCodes: updated }
                              : it
                          )
                        );
                      }}
                    >
                      <Text style={styles.modalItemText}>{item.asset_code}</Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  header: { backgroundColor: Colors.card, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.text, marginLeft: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FED7AA' },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  section: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: Colors.border },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },

  pickerSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FAFBFD' },
  dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FAFBFD' },
  dateSelectorText: { fontSize: 13, color: Colors.text, fontWeight: '500' },

  flexRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  fieldContainer: { marginBottom: 10 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: Colors.text, backgroundColor: '#FAFBFD' },

  segmentedContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 3, marginBottom: 10 },
  segmentButton: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6, height: 32 },
  segmentActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  segmentText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  segmentTextActive: { color: Colors.text, fontWeight: '600' },

  addRowLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addRowLinkText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  itemCard: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingBottom: 6 },
  itemNumber: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  itemPickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },

  gstChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FFF7ED', borderWidth: 0.5, borderColor: '#FED7AA' },
  gstChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  gstChipText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  gstChipTextActive: { color: '#fff' },

  assetPickerLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  assetPickerLinkText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  warningText: { fontSize: 11, color: Colors.danger, fontWeight: '500', marginTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.border, paddingBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  modalSearchInput: { flex: 1, fontSize: 13, color: Colors.text, padding: 0 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
  modalItemText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  modalItemActive: { backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 8 },
});
