import { ref, computed } from 'vue';

// Hardcoded invoices data (replace with API call later)
const MOCK_INVOICES = [
  { id: 1, invoice_id: 'INV-2025-0042', booking_id: 1, booking_ref: 'BK-2025-0128', guest_name: 'Anna Cruz', subtotal: 18500.00, tax: 2220.00, total: 20720.00, date: '2025-01-18', status: 'paid', payment_method: 'gcash', created_at: '2025-01-18T14:30:00' },
  { id: 2, invoice_id: 'INV-2025-0041', booking_id: 2, booking_ref: 'BK-2025-0127', guest_name: 'Juan Dela Cruz', subtotal: 6200.00, tax: 744.00, total: 6944.00, date: '2025-01-18', status: 'paid', payment_method: 'on_arrival', created_at: '2025-01-18T10:15:00' },
  { id: 3, invoice_id: 'INV-2025-0040', booking_id: 3, booking_ref: 'BK-2025-0126', guest_name: 'Maria Santos', subtotal: 32000.00, tax: 3840.00, total: 35840.00, date: '2025-01-17', status: 'pending', payment_method: 'gcash', created_at: '2025-01-17T16:45:00' },
  { id: 4, invoice_id: 'INV-2025-0039', booking_id: 4, booking_ref: 'BK-2025-0125', guest_name: 'Pedro Reyes', subtotal: 9800.00, tax: 1176.00, total: 10976.00, date: '2025-01-16', status: 'paid', payment_method: 'on_arrival', created_at: '2025-01-16T09:20:00' },
  { id: 5, invoice_id: 'INV-2025-0038', booking_id: 5, booking_ref: 'BK-2025-0124', guest_name: 'Sofia Garcia', subtotal: 28000.00, tax: 3360.00, total: 31360.00, date: '2025-01-16', status: 'pending', payment_method: 'gcash', created_at: '2025-01-16T11:30:00' },
  { id: 6, invoice_id: 'INV-2025-0037', booking_id: 6, booking_ref: 'BK-2025-0123', guest_name: 'Ricardo Lim', subtotal: 7400.00, tax: 888.00, total: 8288.00, date: '2025-01-15', status: 'paid', payment_method: 'on_arrival', created_at: '2025-01-15T13:45:00' },
  { id: 7, invoice_id: 'INV-2025-0036', booking_id: 7, booking_ref: 'BK-2025-0122', guest_name: 'Isabella Torres', subtotal: 7600.00, tax: 912.00, total: 8512.00, date: '2025-01-15', status: 'overdue', payment_method: 'on_arrival', created_at: '2025-01-15T15:20:00' },
  { id: 8, invoice_id: 'INV-2025-0035', booking_id: 8, booking_ref: 'BK-2025-0121', guest_name: 'Miguel Angeles', subtotal: 22000.00, tax: 2640.00, total: 24640.00, date: '2025-01-14', status: 'paid', payment_method: 'gcash', created_at: '2025-01-14T10:10:00' },
  { id: 9, invoice_id: 'INV-2025-0034', booking_id: 9, booking_ref: 'BK-2025-0120', guest_name: 'Carmen Navarro', subtotal: 3200.00, tax: 384.00, total: 3584.00, date: '2025-01-14', status: 'cancelled', payment_method: 'on_arrival', created_at: '2025-01-14T14:30:00' },
  { id: 10, invoice_id: 'INV-2025-0033', booking_id: 10, booking_ref: 'BK-2025-0119', guest_name: 'Diego Ramos', subtotal: 45000.00, tax: 5400.00, total: 50400.00, date: '2025-01-13', status: 'pending', payment_method: 'gcash', created_at: '2025-01-13T16:15:00' }
];

export function useOwnerInvoices() {
  const invoices = ref([...MOCK_INVOICES]);
  const loading = ref(false);
  const error = ref(null);

  // Get all invoices
  const getInvoices = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    loading.value = false;
    return { success: true, invoices: invoices.value };
  };

  // Get single invoice
  const getInvoice = async (id) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));

    const invoice = invoices.value.find(i => i.id === id);
    
    loading.value = false;
    if (invoice) {
      return { success: true, invoice };
    } else {
      return { success: false, error: 'Invoice not found' };
    }
  };

  // Get invoice by booking
  const getInvoiceByBooking = async (bookingId) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 400));

    const invoice = invoices.value.find(i => i.booking_id === bookingId);
    
    loading.value = false;
    if (invoice) {
      return { success: true, invoice };
    } else {
      return { success: false, error: 'Invoice not found' };
    }
  };

  // Update invoice status
  const updateInvoiceStatus = async (id, status) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));

    const index = invoices.value.findIndex(i => i.id === id);
    
    if (index !== -1) {
      invoices.value[index].status = status;
      loading.value = false;
      return { success: true, invoice: invoices.value[index], message: 'Invoice status updated' };
    } else {
      loading.value = false;
      return { success: false, error: 'Invoice not found' };
    }
  };

  // Mark as paid
  const markAsPaid = async (id) => {
    return updateInvoiceStatus(id, 'paid');
  };

  // Mark as overdue
  const markAsOverdue = async (id) => {
    return updateInvoiceStatus(id, 'overdue');
  };

  // Get invoice stats
  const getInvoiceStats = () => {
    const stats = {
      total: invoices.value.length,
      paid: invoices.value.filter(i => i.status === 'paid').length,
      pending: invoices.value.filter(i => i.status === 'pending').length,
      overdue: invoices.value.filter(i => i.status === 'overdue').length,
      cancelled: invoices.value.filter(i => i.status === 'cancelled').length,
      totalAmount: invoices.value.reduce((sum, i) => sum + i.total, 0),
      paidAmount: invoices.value
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + i.total, 0),
      pendingAmount: invoices.value
        .filter(i => i.status === 'pending')
        .reduce((sum, i) => sum + i.total, 0),
      overdueAmount: invoices.value
        .filter(i => i.status === 'overdue')
        .reduce((sum, i) => sum + i.total, 0)
    };
    return stats;
  };

  // Filter invoices
  const filterInvoices = (filters) => {
    return invoices.value.filter(invoice => {
      if (filters.status && invoice.status !== filters.status) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!invoice.invoice_id.toLowerCase().includes(search) &&
            !invoice.guest_name.toLowerCase().includes(search) &&
            !invoice.booking_ref.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  };

  // Download invoice (mock)
  const downloadInvoice = async (id) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    const invoice = invoices.value.find(i => i.id === id);
    
    loading.value = false;
    if (invoice) {
      // In real app, this would generate and download PDF
      console.log('Downloading invoice:', invoice.invoice_id);
      return { success: true, message: 'Invoice downloaded successfully' };
    } else {
      return { success: false, error: 'Invoice not found' };
    }
  };

  // Get overdue invoices
  const getOverdueInvoices = () => {
    return invoices.value.filter(i => i.status === 'overdue');
  };

  // Get pending invoices
  const getPendingInvoices = () => {
    return invoices.value.filter(i => i.status === 'pending');
  };

  return {
    invoices,
    loading,
    error,
    getInvoices,
    getInvoice,
    getInvoiceByBooking,
    updateInvoiceStatus,
    markAsPaid,
    markAsOverdue,
    getInvoiceStats,
    filterInvoices,
    downloadInvoice,
    getOverdueInvoices,
    getPendingInvoices
  };
}