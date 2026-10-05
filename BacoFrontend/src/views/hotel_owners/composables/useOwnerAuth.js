import { ref, computed } from 'vue';

// Hardcoded owner data (replace with API call later)
const MOCK_OWNER = {
  id: 42,
  user_id: 1087,
  first_name: 'Marco',
  middle_name: null,
  last_name: 'Rivera',
  email: 'marco.rivera@riverahospitality.com',
  password: 'password123', // In real app, this would be hashed
  contact_number: '+63 917 852 4391',
  business_name: 'Rivera Hospitality Group',
  business_permit_no: 'BP-2024-08-0429',
  tin_number: '123-456-789-000',
  valid_id_path: 'national_id_marco_rivera.pdf',
  status: 'pending',
  rejection_reason: null,
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2024-08-15T09:32:00',
  updated_at: '2025-01-08T14:14:00'
};

export function useOwnerAuth() {
  const owner = ref(null);
  const isAuthenticated = ref(false);
  const loading = ref(false);
  const error = ref(null);

  // Check if user is logged in
  const checkAuth = () => {
    const token = localStorage.getItem('ownerToken');
    const ownerData = localStorage.getItem('ownerData');
    
    if (token && ownerData) {
      owner.value = JSON.parse(ownerData);
      isAuthenticated.value = true;
      return true;
    }
    return false;
  };

  // Login
  const login = async (email, password) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (email === MOCK_OWNER.email && password === MOCK_OWNER.password) {
      const token = 'mock-jwt-token-' + Date.now();
      localStorage.setItem('ownerToken', token);
      localStorage.setItem('ownerData', JSON.stringify(MOCK_OWNER));
      
      owner.value = MOCK_OWNER;
      isAuthenticated.value = true;
      loading.value = false;
      
      return { success: true, owner: MOCK_OWNER };
    } else {
      error.value = 'Invalid email or password';
      loading.value = false;
      return { success: false, error: 'Invalid credentials' };
    }
  };

  // Register
  const register = async (formData) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In real app, this would POST to backend
    console.log('Registering owner:', formData);
    
    loading.value = false;
    return { 
      success: true, 
      message: 'Registration submitted! Your account is pending LGU approval.' 
    };
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('ownerToken');
    localStorage.removeItem('ownerData');
    owner.value = null;
    isAuthenticated.value = false;
  };

  // Update profile
  const updateProfile = async (updates) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    // Update local state
    if (owner.value) {
      owner.value = { ...owner.value, ...updates, updated_at: new Date().toISOString() };
      localStorage.setItem('ownerData', JSON.stringify(owner.value));
    }

    loading.value = false;
    return { success: true, message: 'Profile updated successfully' };
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (currentPassword !== MOCK_OWNER.password) {
      error.value = 'Current password is incorrect';
      loading.value = false;
      return { success: false, error: 'Current password is incorrect' };
    }

    // In real app, this would update the password in backend
    MOCK_OWNER.password = newPassword;
    
    loading.value = false;
    return { success: true, message: 'Password changed successfully' };
  };

  // Upload valid ID
  const uploadValidId = async (file) => {
    loading.value = true;
    error.value = null;

    // Simulate file upload
    await new Promise(resolve => setTimeout(resolve, 2000));

    // In real app, this would upload to backend
    const mockPath = `uploads/owner_ids/${Date.now()}-${file.name}`;
    
    if (owner.value) {
      owner.value.valid_id_path = mockPath;
      localStorage.setItem('ownerData', JSON.stringify(owner.value));
    }

    loading.value = false;
    return { success: true, path: mockPath, message: 'ID uploaded successfully' };
  };

  return {
    owner,
    isAuthenticated,
    loading,
    error,
    checkAuth,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    uploadValidId
  };
}