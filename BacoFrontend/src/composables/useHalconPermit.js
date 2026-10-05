import { ref, computed, watch } from 'vue'

const PERMIT_FEE_PER_HEAD = 1000

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api') + '/halcon'

function defaultMember(index) {
  return {
    id: index,
    name: '',
    age: '',
    contact: '',
    emergency: '',
    medCondition: 'None',
  }
}

export function useHalconPermit(editId = null) {
  const isEditMode = computed(() => !!editId.value)

  const permitForm = ref({
    trekDate: '',
    days: '3 Days, 2 Nights',
    groupSize: 1,
    trail: 'Lantuyan Trail',
    members: [defaultMember(1)],
    waiver: false,
    paymentMethod: 'onsite',
    // Document file tracking
    idsFile: null,
    idsFileName: null,
    medicalFile: null,
    medicalFileName: null,
    // Existing document info (for edit mode display)
    existingIdsDoc: null,
    existingMedicalDoc: null,
  })

  const totalFee = computed(() => permitForm.value.groupSize * PERMIT_FEE_PER_HEAD)

  const minTrekDate = computed(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })

  const isFormValid = computed(() => {
    const f = permitForm.value
    if (!f.trekDate || f.groupSize < 1) return false
    if (!f.members.every(m => m.name && m.age && m.contact && m.emergency)) return false
    if (!f.waiver) return false
    return true
  })

  const uploading = ref(false)
  const submitting = ref(false)

  // Keep members array in sync with groupSize
  watch(
    () => permitForm.value.groupSize,
    (newSize) => {
      const current = permitForm.value.members
      if (newSize > current.length) {
        for (let i = current.length; i < newSize; i++) {
          current.push(defaultMember(i + 1))
        }
      } else {
        permitForm.value.members = current.slice(0, newSize)
      }
    }
  )

  // Upload a PDF file to the server
  async function uploadPdf(file) {
    if (!file) return null
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are allowed.')
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size must be under 10MB.')
    }

    uploading.value = true
    try {
      const token = localStorage.getItem('baco_user_token')
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API}/upload-pdf`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Upload failed.')
      return data
    } finally {
      uploading.value = false
    }
  }

  // Handle PDF file selection
  async function handleIdsFile(event) {
    const file = event.target.files[0]
    if (!file) return
    try {
      const result = await uploadPdf(file)
      permitForm.value.idsFile = result.filePath
      permitForm.value.idsFileName = result.originalName
    } catch (e) {
      alert(e.message)
      event.target.value = ''
    }
  }

  async function handleMedicalFile(event) {
    const file = event.target.files[0]
    if (!file) return
    try {
      const result = await uploadPdf(file)
      permitForm.value.medicalFile = result.filePath
      permitForm.value.medicalFileName = result.originalName
    } catch (e) {
      alert(e.message)
      event.target.value = ''
    }
  }

  // Submit (create or update)
  async function submitApplication() {
    submitting.value = true
    try {
      const token = localStorage.getItem('baco_user_token')
      const payload = {
        trekDate: permitForm.value.trekDate,
        duration: permitForm.value.days,
        groupSize: permitForm.value.groupSize,
        trail: permitForm.value.trail,
        members: permitForm.value.members,
        waiver: permitForm.value.waiver,
        paymentMethod: permitForm.value.paymentMethod,
        idsFile: permitForm.value.idsFile,
        idsFileName: permitForm.value.idsFileName,
        medicalFile: permitForm.value.medicalFile,
        medicalFileName: permitForm.value.medicalFileName,
      }

      let url, method
      if (isEditMode.value) {
        url = `${API}/permits/${editId.value}`
        method = 'PUT'
      } else {
        url = `${API}/permits`
        method = 'POST'
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Submission failed.')

      return data // { permitId, checkoutUrl, paymentMethod, paymentStatus }
    } finally {
      submitting.value = false
    }
  }

  // Load existing permit data for editing
  async function loadPermitForEdit(permitData) {
    permitForm.value.trekDate = permitData.trek_date
    permitForm.value.days = permitData.duration
    permitForm.value.groupSize = permitData.group_size
    permitForm.value.trail = permitData.trail
    permitForm.value.waiver = !!permitData.waiver_accepted
    permitForm.value.paymentMethod = permitData.payment_method
    permitForm.value.members = permitData.members.map(m => ({
      id: m.id,
      name: m.name,
      age: m.age,
      contact: m.contact,
      emergency: m.emergency,
      medCondition: m.medCondition || 'None',
    }))

    // Load existing documents
    permitForm.value.idsFile = null
    permitForm.value.idsFileName = null
    permitForm.value.medicalFile = null
    permitForm.value.medicalFileName = null

    const idsDoc = permitData.documents?.find(d => d.doc_type === 'valid_ids')
    permitForm.value.existingIdsDoc = idsDoc || null

    const medDoc = permitData.documents?.find(d => d.doc_type === 'medical_certificates')
    permitForm.value.existingMedicalDoc = medDoc || null
  }

  function resetForm() {
    permitForm.value = {
      trekDate: '',
      days: '3 Days, 2 Nights',
      groupSize: 1,
      trail: 'Lantuyan Trail',
      members: [defaultMember(1)],
      waiver: false,
      paymentMethod: 'onsite',
      idsFile: null,
      idsFileName: null,
      medicalFile: null,
      medicalFileName: null,
      existingIdsDoc: null,
      existingMedicalDoc: null,
    }
  }

  return {
    isEditMode,
    permitForm,
    totalFee,
    minTrekDate,
    isFormValid,
    uploading,
    submitting,
    PERMIT_FEE_PER_HEAD,
    handleIdsFile,
    handleMedicalFile,
    submitApplication,
    loadPermitForEdit,
    resetForm,
  }
}