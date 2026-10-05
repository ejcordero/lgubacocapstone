// src/components/auth/useAuth.js
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

export function useAuth(source = 'user/dashboard') { // ✅ default to user dashboard
  const router = useRouter()
  const route  = useRoute()

  const showAuthModal = ref(false)
  const activeTab     = ref('login')
  const isProcessing  = ref(false)
  const errorMessage  = ref('')

  const authForm = ref({
    email: '',
    password: '',
    departmentRole: 'main_controller',
    fullName: '',
    confirmPassword: '',
    termsAgreed: false
  })

  const blockchainAuth = ref({
    showKeyModal:    false,
    showRegModal:    false,
    showKeysSuccess: false,
    userInputKey:    '',
    generatedKeys:   { publicKey: '', privateKey: '' },
    currentAction:   'download',
    currentUserId:   null
  })

  watch(showAuthModal, (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : 'auto'
  })

  onMounted(() => {
    const token = localStorage.getItem('baco_user_token')
    // If already logged in and no redirect param, go to dashboard
    if (token && !route?.query?.redirect) {
      router.push(`/${source}`) // ✅ now goes to /user/dashboard
    }
  })

  onUnmounted(() => {
    document.body.style.overflow = 'auto'
  })

  const switchTab = (tab) => {
    activeTab.value    = tab
    errorMessage.value = ''
  }

  // ✅ After successful auth, go to ?redirect param OR /user/dashboard
  const _redirectAfterAuth = () => {
    const to = route?.query?.redirect || `/${source}`
    router.push(to)
  }

  const executeAuthentication = async () => {
    if (!authForm.value.email || !authForm.value.password) {
      errorMessage.value = 'Email and password are required.'
      return
    }

    isProcessing.value = true
    errorMessage.value = ''

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    authForm.value.email,
          password: authForm.value.password,
          role:     authForm.value.departmentRole
        })
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('baco_user_token', data.token)
        localStorage.setItem('baco_user_role',  authForm.value.departmentRole)
        isProcessing.value  = false
        showAuthModal.value = false
        _redirectAfterAuth()
      } else {
        throw new Error(data.message || 'Authentication failed')
      }
    } catch (error) {
      isProcessing.value = false
      errorMessage.value = error.message || 'Authentication failed. Please check your credentials.'
    }
  }

  const executeRegistration = async () => {
    if (authForm.value.password !== authForm.value.confirmPassword) {
      errorMessage.value = 'Passwords do not match.'
      return
    }
    if (!authForm.value.termsAgreed) {
      errorMessage.value = 'You must agree to the terms and conditions.'
      return
    }

    isProcessing.value = true
    errorMessage.value = ''

    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName:    authForm.value.fullName,
          email:       authForm.value.email,
          password:    authForm.value.password,
          department:  authForm.value.departmentRole,
          termsAgreed: authForm.value.termsAgreed
        })
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('baco_user_token', data.token)
        localStorage.setItem('baco_user_role',  authForm.value.departmentRole)
        isProcessing.value  = false
        showAuthModal.value = false
        _redirectAfterAuth()
      } else {
        throw new Error(data.error || 'Registration failed')
      }
    } catch (error) {
      isProcessing.value = false
      errorMessage.value = error.message || 'Registration failed. Please try again.'
    }
  }

  const submitPublicKey = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/blockchain/verify-public-key', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: blockchainAuth.value.userInputKey })
      })

      const data = await response.json()

      if (response.ok) {
        blockchainAuth.value.currentUserId = data.userId
        blockchainAuth.value.showKeyModal  = false
        blockchainAuth.value.currentAction === 'download' ? handleDownload() : handlePrint()
      } else {
        throw new Error(data.error || 'Invalid Public Key')
      }
    } catch (error) {
      alert(error.message || 'Invalid Public Key. Please register or check your key.')
    }
  }

  const goToRegistration = () => {
    blockchainAuth.value.showKeyModal = false
    blockchainAuth.value.showRegModal = true
  }

  const registerUser = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/blockchain/register-user', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: authForm.value.fullName,
          email:    authForm.value.email,
          username: authForm.value.email.split('@')[0]
        })
      })

      const userData = await response.json()

      const keysResponse = await fetch('http://localhost:3000/api/blockchain/generate-keys', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userData.userId })
      })

      const keysData = await keysResponse.json()

      blockchainAuth.value.currentUserId = userData.userId
      blockchainAuth.value.generatedKeys = {
        publicKey:  keysData.publicKey,
        privateKey: keysData.privateKey
      }
      blockchainAuth.value.showRegModal    = false
      blockchainAuth.value.showKeysSuccess = true
    } catch (error) {
      alert(error.message || 'Error registering user')
    }
  }

  const finishKeyGeneration = () => {
    blockchainAuth.value.showKeysSuccess = false
    blockchainAuth.value.currentAction === 'download' ? handleDownload() : handlePrint()
  }

  const handleDownload = () => { alert('Download functionality would be implemented here') }
  const handlePrint    = () => { alert('Print functionality would be implemented here') }

  const closeModal = () => {
    showAuthModal.value                  = false
    blockchainAuth.value.showKeyModal    = false
    blockchainAuth.value.showRegModal    = false
    blockchainAuth.value.showKeysSuccess = false
    blockchainAuth.value.userInputKey    = ''
  }

  const openAuth  = () => { showAuthModal.value = true }
  const checkAuth = () => !!localStorage.getItem('baco_user_token')

  const logout = () => {
    localStorage.removeItem('baco_user_token')
    localStorage.removeItem('baco_user_role')
    router.push('/auth')
  }

  return {
    showAuthModal,
    activeTab,
    isProcessing,
    errorMessage,
    authForm,
    blockchainAuth,
    openAuth,
    closeAuth: closeModal,
    switchTab,
    executeAuthentication,
    executeRegistration,
    submitPublicKey,
    goToRegistration,
    registerUser,
    finishKeyGeneration,
    checkAuth,
    logout
  }
}