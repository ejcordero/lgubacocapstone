<script setup>
import { ref, computed, onMounted } from 'vue'
import { API } from '@/api'

const getAdminToken = () => localStorage.getItem('baco_admin_token')
const getAdminRole = () => localStorage.getItem('baco_admin_role')
const authHeaders = (json = true) => {
  const h = { 'Authorization': `Bearer ${getAdminToken()}` }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

const resorts = ref([])
const loading = ref(false)
const notif = ref(null)
const searchQuery = ref('')
const filterStatus = ref('all')
const isSubmitting = ref(false)

const showViewModal = ref(false)
const selectedResort = ref(null)
const showDeleteModal = ref(false)
const deleteTarget = ref(null)

const filteredResorts = computed(() => {
  return resorts.value.filter(r => {
    const q = searchQuery.value.toLowerCase()
    const match = r.name.toLowerCase().includes(q) ||
      (r.location || '').toLowerCase().includes(q) ||
      (r.owner?.fullName || '').toLowerCase().includes(q) ||
      (r.owner?.businessName || '').toLowerCase().includes(q)
    const statusMatch = filterStatus.value === 'all' || (filterStatus.value === 'published' ? r.published : !r.published)
    return match && statusMatch
  })
})

const stats = computed(() => ({
  total: resorts.value.length,
  published: resorts.value.filter(r => r.published).length,
  pending: resorts.value.filter(r => !r.published).length,
  bookings: resorts.value.reduce((s, r) => s + (r.bookings || 0), 0),
  revenue: resorts.value.reduce((s, r) => s + (r.revenue || 0), 0)
}))

async function fetchResorts() {
  loading.value = true
  try {
    const res = await fetch(`${API}/admin/owner-resorts`, { headers: authHeaders(false) })
    if (!res.ok) { showNotif(`Failed to load owner resorts (HTTP ${res.status}).`, 'warning'); resorts.value = []; return }
    const data = await res.json()
    resorts.value = Array.isArray(data) ? data : []
  } catch (e) { showNotif('Failed to load owner resorts.', 'warning'); resorts.value = [] }
  loading.value = false
}

function viewResort(r) { selectedResort.value = r; showViewModal.value = true }

async function setPublish(resort, publish) {
  const action = publish ? 'publish' : 'unpublish'
  const msg = publish
    ? `Publish "${resort.name}"? It will become visible and bookable to all tourists.`
    : `Unpublish "${resort.name}"? It will be hidden from tourists (existing bookings remain).`
  if (!confirm(msg)) return
  isSubmitting.value = true
  try {
    const res = await fetch(`${API}/admin/owner-resorts/${resort.id}/${action}`, { method: 'PUT', headers: authHeaders(false) })
    const data = await res.json()
    if (!res.ok) { showNotif(data.message || 'Failed.', 'warning'); isSubmitting.value = false; return }
    resort.published = publish
    showViewModal.value = false
    showNotif(data.message, publish ? 'success' : 'info')
  } catch (e) { showNotif('Network error.', 'warning') }
  isSubmitting.value = false
}

function confirmDelete(r) { deleteTarget.value = r; showDeleteModal.value = true }
function cancelDelete() { showDeleteModal.value = false }

async function executeDelete() {
  isSubmitting.value = true
  try {
    const res = await fetch(`${API}/admin/owner-resorts/${deleteTarget.value.id}`, { method: 'DELETE', headers: authHeaders(false) })
    const data = await res.json()
    if (!res.ok) { showNotif(data.message || 'Delete failed.', 'warning'); isSubmitting.value = false; cancelDelete(); return }
    resorts.value = resorts.value.filter(r => r.id !== deleteTarget.value.id)
    showViewModal.value = false
    showNotif(`"${deleteTarget.value.name}" removed.`, 'success')
  } catch (e) { showNotif('Delete failed.', 'warning') }
  isSubmitting.value = false
  cancelDelete()
}

function showNotif(message, type = 'info') { notif.value = { message, type }; setTimeout(() => { notif.value = null }, 3500) }
function formatPrice(n) { return 'Ã¢â€šÂ±' + Number(n || 0).toLocaleString() }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Ã¢â‚¬â€' }

onMounted(fetchResorts)
</script>

<template>
  <div class="rm">

    <Transition name="toast">
      <div v-if="notif" class="toast" :class="notif.type">
        <i class="fa-solid" :class="{ 'fa-circle-check': notif.type === 'success', 'fa-circle-info': notif.type === 'info', 'fa-triangle-exclamation': notif.type === 'warning' }"></i>
        <span>{{ notif.message }}</span>
      </div>
    </Transition>

    <div class="ph">
      <div>
        <h1 class="pt">Owner <span class="ta">Resorts</span></h1>
      </div>
    </div>

    <div class="sr">
      <div class="sc"><div class="si navy"><i class="fa-solid fa-water"></i></div><div class="sb"><span class="sv">{{ stats.total }}</span><span class="sl">Owner Resorts</span></div></div>
      <div class="sc"><div class="si green"><i class="fa-solid fa-circle-check"></i></div><div class="sb"><span class="sv">{{ stats.published }}</span><span class="sl">Published</span></div></div>
      <div class="sc"><div class="si amber"><i class="fa-solid fa-clock"></i></div><div class="sb"><span class="sv">{{ stats.pending }}</span><span class="sl">Awaiting Approval</span></div></div>
    </div>

    <div class="toolbar">
      <div class="sw"><i class="fa-solid fa-magnifying-glass sico"></i><input v-model="searchQuery" type="text" class="sinp" placeholder="Search by resort, location, or ownerÃ¢â‚¬Â¦" /></div>
      <div class="ft">
        <button v-for="f in ['all', 'published', 'pending']" :key="f" class="ftab mat-skeuo-sm mat-pressable-sm" :class="{ active: filterStatus === f }" @click="filterStatus = f">{{ f.charAt(0).toUpperCase() + f.slice(1) }}</button>
      </div>
    </div>

    <div class="tw">
  <table class="dt">
    <thead>
      <tr>
        <th>#</th>
        <th>Resort</th>
        <th>Posted By</th>
        <th>Rooms</th>
        <th>Status</th>
        <th>Submitted</th>
        <th>Actions</th>
      </tr>
    </thead>

    <tbody>
      <tr v-if="filteredResorts.length === 0">
        <td colspan="7" class="er">
          <i class="fa-solid fa-water"></i>
          <span>No owner-submitted resorts found.</span>
        </td>
      </tr>

      <tr v-for="(r, i) in filteredResorts" :key="r.id" class="dr">
        <td class="cn">{{ i + 1 }}</td>

        <td>
          <div class="nc">
            <div
              class="av"
              :style="r.image ? {
                backgroundImage: `url(${r.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}"
            >
              <i v-if="!r.image" class="fa-solid fa-water"></i>
            </div>

            <div>
              <div class="nm">{{ r.name }}</div>
              <div class="sbt">{{ r.location || 'Ã¢â‚¬â€' }}</div>
            </div>
          </div>
        </td>

        <td>
          <div class="nm">{{ r.owner?.businessName }}</div>
          <div class="sbt">{{ r.owner?.fullName }} Ã‚Â· {{ r.owner?.email }}</div>
        </td>

        <td class="cn">
          {{ r.rooms.length }}
          <span class="si2">
            ({{ r.rooms.reduce((s, x) => s + (x.totalCount || 0), 0) }} units)
          </span>
        </td>

        <td>
          <span
            class="sp"
            :class="r.published ? 'active' : 'inactive'"
          >
            <span class="sd"></span>
            {{ r.published ? 'Published' : 'Pending' }}
          </span>
        </td>

        <td class="cd">{{ formatDate(r.createdAt) }}</td>

        <td class="ca">
          <button
            class="ab view"
            @click="viewResort(r)"
            title="View Details"
          >
            <i class="fa-solid fa-eye"></i>
          </button>

          <button
            v-if="!r.published"
            class="ab publish"
            @click="setPublish(r, true)"
            title="Publish (approve)"
          >
            <i class="fa-solid fa-check"></i>
          </button>

          <button
            v-else
            class="ab unpublish"
            @click="setPublish(r, false)"
            title="Unpublish (deactivate)"
          >
            <i class="fa-solid fa-ban"></i>
          </button>

          <button
            v-if="getAdminRole() === 'main_controller'"
            class="ab delete"
            @click="confirmDelete(r)"
            title="Remove"
          >
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>

<div class="tf">
  Showing <strong>{{ filteredResorts.length }}</strong>
  of <strong>{{ resorts.length }}</strong> owner resorts
</div>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â VIEW DETAILS MODAL (read-only) Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="modal">
      <div v-if="showViewModal && selectedResort" class="mo" @click.self="showViewModal = false">
        <div class="md">
          <div class="mh">
            <div class="mtw"><div class="mi"><i class="fa-solid fa-water"></i></div><div><h2 class="mtl">{{ selectedResort.name }}</h2><p class="msb">Owner submission Ã¢â‚¬â€ read-only review</p></div></div>
            <button class="mc" @click="showViewModal = false"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="mb">
            <div class="hero" :style="selectedResort.image ? { backgroundImage: `url(${selectedResort.image})` } : {}"><i v-if="!selectedResort.image" class="fa-solid fa-water"></i></div>

            <div class="sec">
              <h4><i class="fa-solid fa-user"></i> Posted By</h4>
              <div class="ig">
                <div class="it"><label>Owner</label><span>{{ selectedResort.owner?.fullName }}</span></div>
                <div class="it"><label>Business Name</label><span>{{ selectedResort.owner?.businessName }}</span></div>
                <div class="it"><label>Email</label><span>{{ selectedResort.owner?.email }}</span></div>
                <div class="it"><label>Contact</label><span>{{ selectedResort.owner?.contact }}</span></div>
                <div class="it"><label>Business Permit No.</label><span>{{ selectedResort.owner?.businessPermitNo }}</span></div>
                <div class="it"><label>Submitted</label><span>{{ formatDate(selectedResort.createdAt) }}</span></div>
              </div>
            </div>

            <div class="sec">
              <h4><i class="fa-solid fa-circle-info"></i> Resort Information</h4>
              <div class="ig">
                <div class="it"><label>Location</label><span>{{ selectedResort.location || 'Ã¢â‚¬â€' }}</span></div>
                <div class="it"><label>Type</label><span>{{ selectedResort.type || 'Ã¢â‚¬â€' }}</span></div>
                <div class="it"><label>Contact</label><span>{{ selectedResort.contact || 'Ã¢â‚¬â€' }}</span></div>
                <div class="it"><label>Daily Capacity</label><span>{{ selectedResort.dailyCapacity ? selectedResort.dailyCapacity + ' visitors/day' : 'Unlimited' }}</span></div>
              </div>
              <p class="desc">{{ selectedResort.description || 'No description provided.' }}</p>
              <div v-if="selectedResort.amenities?.length" class="al"><span v-for="a in selectedResort.amenities" :key="a" class="at">{{ a }}</span></div>
            </div>

            <div class="sec">
              <h4><i class="fa-solid fa-ticket"></i> Entrance Fees ({{ selectedResort.entranceFees.length }})</h4>
              <div v-if="selectedResort.entranceFees.length" class="flist">
                <div v-for="f in selectedResort.entranceFees" :key="f.id" class="frow">
                  <div><b>{{ f.name }}</b><small v-if="f.status === 'inactive'"> Ã‚Â· hidden</small></div>
                  <span class="fp">{{ formatPrice(f.price) }}<small>/head</small></span>
                </div>
              </div>
              <p v-else class="none">No entrance fees yet Ã¢â‚¬â€ the resort can't be booked for day tours until the owner adds them.</p>
            </div>

            <div class="sec">
              <h4><i class="fa-solid fa-bed"></i> Room Types ({{ selectedResort.rooms.length }})</h4>
              <div v-if="selectedResort.rooms.length" class="flist">
                <div v-for="room in selectedResort.rooms" :key="room.id" class="frow">
                  <div><b>{{ room.name }}</b><small> Ã‚Â· up to {{ room.capacity }} guests Ã‚Â· {{ room.totalCount }} unit{{ room.totalCount > 1 ? 's' : '' }}{{ room.status === 'inactive' ? ' Ã‚Â· inactive' : '' }}</small></div>
                  <span class="fp">{{ formatPrice(room.price) }}<small>/night</small></span>
                </div>
              </div>
              <p v-else class="none">No overnight rooms Ã¢â‚¬â€ entrance/day-tour bookings only.</p>
            </div>

            <div class="note"><i class="fa-solid fa-shield-halved"></i> You can only publish, unpublish, or remove this submission. Editing content is the owner's responsibility via their portal.</div>
          </div>
          <div class="mf">
            <button class="bc" @click="showViewModal = false">Close</button>
            <button v-if="!selectedResort.published" class="bs green" :disabled="isSubmitting" @click="setPublish(selectedResort, true)"><i class="fa-solid fa-check"></i> Approve & Publish</button>
            <button v-else class="bs amber" :disabled="isSubmitting" @click="setPublish(selectedResort, false)"><i class="fa-solid fa-ban"></i> Unpublish</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="modal">
      <div v-if="showDeleteModal" class="mo" @click.self="cancelDelete">
        <div class="md mds">
          <div class="mh">
            <div class="mtw"><div class="mi danger"><i class="fa-solid fa-trash-can"></i></div><div><h2 class="mtl">Remove Owner Resort</h2><p class="msb">This action cannot be undone</p></div></div>
            <button class="mc" @click="cancelDelete"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="mb"><p>Remove <strong>"{{ deleteTarget?.name }}"</strong> posted by <strong>{{ deleteTarget?.owner?.businessName }}</strong>?</p><p class="dw">Its rooms, entrance fees, and inquiries will be permanently deleted. The owner account stays active.</p></div>
          <div class="mf"><button class="bc" @click="cancelDelete">Cancel</button><button class="bd" @click="executeDelete" :disabled="isSubmitting"><span><i class="fa-solid fa-trash-can"></i> Yes, Remove</span></button></div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.rm{font-family:var(--font-body);height:100%;overflow-y:auto;padding:28px 32px 48px;background:var(--bg);position:relative}
.toast{position:fixed;top:24px;right:24px;z-index:9999;display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:var(--r-md);font-size:.84rem;font-weight:600;box-shadow:var(--shadow-md);background:var(--card-solid);border:1px solid var(--bdr)}
.toast.success{color:var(--ok);border-left:3px solid var(--ok)}
.toast.info{color:var(--tl);border-left:3px solid var(--tl)}
.toast.warning{color:var(--wn);border-left:3px solid var(--wn)}
.toast-enter-active,.toast-leave-active{transition:all .3s ease}
.toast-enter-from,.toast-leave-to{opacity:0;transform:translateY(-12px)}
.ph{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px}
.pt{font-family:var(--font-display);font-size:1.75rem;font-weight:700;color:var(--fg);line-height:1.1}
.ta{color:var(--ac)}
.ps{font-size:.82rem;color:var(--mt);margin-top:4px;max-width:640px}
.sr{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px}
.sc{background:var(--card-solid);border-radius:var(--r-md);border:1px solid var(--bdr);padding:16px 18px;display:flex;align-items:center;gap:14px}
.si{width:44px;height:44px;border-radius:var(--r-md);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem}
.si.navy{background:var(--acs);color:var(--ac)}
.si.green{background:var(--oks);color:var(--ok)}
.si.amber{background:var(--wns);color:var(--wn)}
.sv{display:block;font-size:1.35rem;font-weight:700;color:var(--fg);line-height:1}
.sl{display:block;font-size:.68rem;color:var(--mt);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
.toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.sw{position:relative;flex:1;min-width:220px}
.sico{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--mt);font-size:.85rem;pointer-events:none}
.sinp{width:100%;padding:9px 12px 9px 36px;border:1px solid var(--bdr);border-radius:var(--r-sm);font-family:var(--font-body);font-size:.84rem;color:var(--fg);background:var(--bg2);outline:none;transition:border-color .15s}
.sinp:focus{border-color:var(--ac)}
.sinp::placeholder{color:var(--mt2)}
.ft{display:flex;gap:6px}
.ftab{padding:8px 16px;border-radius:var(--r-sm);font-family:var(--font-body);font-size:.82rem;font-weight:600;cursor:pointer;border:1px solid var(--bdr);background:var(--bg2);color:var(--mt);transition:all .15s}
.ftab:hover{border-color:var(--ac);color:var(--fg)}
.ftab.active{background: var(--m-accent-solid);color: #fff;border-color: var(--m-accent-solid)}
.tw{background:var(--card-solid);border-radius:var(--r-md);border:1px solid var(--bdr);overflow:hidden;overflow-x:auto}
.dt{width:100%;border-collapse:collapse;min-width:1000px}
.dt thead tr{background:var(--bg2);border-bottom:1px solid var(--bdr)}
.dt th{padding:11px 14px;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mt);white-space:nowrap}
.dt tbody tr{border-bottom:1px solid var(--bdr);transition:background .12s}
.dt tbody tr:last-child{border-bottom:none}
.dt tbody tr:hover{background:var(--card2)}
.dt td{padding:13px 14px;vertical-align:middle}
.cn{color:var(--mt);font-size:.78rem;font-weight:600;width:40px;text-align:center}
.si2{color:var(--mt);font-size:.72rem;font-weight:500}
.nc{display:flex;align-items:center;gap:10px}
.av{width:36px;height:36px;border-radius:var(--r-sm);flex-shrink:0;background:var(--bg2);color:var(--mt);display:flex;align-items:center;justify-content:center;font-size:.85rem;overflow:hidden}
.nm{font-size:.88rem;font-weight:700;color:var(--fg)}
.sbt{font-size:.74rem;color:var(--mt);margin-top:1px}
.cd{font-size:.78rem;color:var(--mt);white-space:nowrap}
.sp{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;font-size:.74rem;font-weight:700;border:none}
.sp.active{background:var(--oks);color:var(--ok)}
.sp.inactive{background:var(--wns);color:var(--wn)}
.sd{width:6px;height:6px;border-radius:50%;background:currentColor}
.ca{display:flex;gap:6px}
.ab{width:32px;height:32px;border-radius:var(--r-sm);border:none;display:flex;align-items:center;justify-content:center;font-size:.82rem;cursor:pointer;transition:all .15s}
.ab.view{background:var(--tls);color:var(--tl)}
.ab.view:hover{background:var(--tl);color:#fff}
.ab.publish{background:var(--oks);color:var(--ok)}
.ab.publish:hover{background:var(--ok);color:var(--fg)}
.ab.unpublish{background:var(--wns);color:var(--wn)}
.ab.unpublish:hover{background:var(--wn);color:var(--fg)}
.ab.delete{background:var(--dgs);color:var(--dg)}
.ab.delete:hover{background: var(--dg-solid);color: #fff}
.er{text-align:center;padding:48px 0!important;color:var(--mt)}
.er i{font-size:2rem;display:block;margin-bottom:10px}
.er span{font-size:.88rem}
.tf{padding:10px 16px;font-size:.78rem;color:var(--mt);border-top:1px solid var(--bdr);background:var(--card-solid);border-radius:0 0 var(--r-md) var(--r-md)}
.mo{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)}
.md{background:var(--card-solid);border:1px solid var(--bdr);border-radius:var(--r-lg);width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow-lg)}
.mds{max-width:420px}
.mh{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--bdr);flex-shrink:0}
.mtw{display:flex;align-items:center;gap:14px}
.mi{width:42px;height:42px;border-radius:var(--r-md);flex-shrink:0;background:var(--acs);color:var(--ac);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
.mi.danger{background:var(--dgs);color:var(--dg)}
.mtl{font-family:var(--font-display);font-size:1.15rem;font-weight:700;color:var(--fg)}
.msb{font-size:.78rem;color:var(--mt);margin-top:2px}
.mc{width:34px;height:34px;border:1px solid var(--bdr);border-radius:var(--r-sm);background:none;color:var(--mt);font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
.mc:hover{background:var(--dgs);color:var(--dg);border-color:var(--dg)}
.mb{flex:1;overflow-y:auto;padding:22px 24px;color:var(--fg2)}
.mf{padding:16px 24px;border-top:1px solid var(--bdr);display:flex;justify-content:flex-end;gap:10px;flex-shrink:0}
.hero{height:180px;border-radius:var(--r-md);background:var(--bg2) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--mt);font-size:2rem;margin-bottom:20px}
.sec{margin-bottom:22px}
.sec h4{font-size:.82rem;font-weight:700;color:var(--fg);text-transform:uppercase;letter-spacing:.06em;padding-bottom:8px;border-bottom:1px solid var(--bdr);margin-bottom:12px}
.sec h4 i{color:var(--ac);margin-right:6px}
.ig{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.it{display:flex;flex-direction:column;gap:3px}
.it label{font-size:.68rem;font-weight:600;color:var(--mt);text-transform:uppercase;letter-spacing:.05em}
.it span{font-size:.86rem;color:var(--fg);font-weight:500}
.desc{font-size:.86rem;color:var(--fg2);line-height:1.6;margin-top:12px}
.al{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
.at{display:inline-block;padding:3px 9px;border-radius:var(--r-sm);font-size:.7rem;font-weight:600;background:var(--bg2);color:var(--fg2)}
.flist{display:flex;flex-direction:column;gap:8px}
.frow{display:flex;justify-content:space-between;align-items:center;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r-sm);padding:10px 14px}
.frow b{font-size:.86rem;color:var(--fg)}
.frow small{color:var(--mt);font-size:.76rem}
.fp{font-weight:800;color:var(--ok);font-size:.92rem;white-space:nowrap}
.fp small{font-weight:600;color:var(--mt);font-size:.68rem}
.none{font-size:.82rem;color:var(--mt);font-style:italic}
.note{display:flex;align-items:flex-start;gap:10px;background:var(--wns);border:1px solid var(--wng);border-radius:var(--r-md);padding:12px 14px;font-size:.8rem;color:var(--wn2);line-height:1.5}
.note i{color:var(--wn);margin-top:2px}
.bc{padding:9px 20px;border:1px solid var(--bdr);border-radius:var(--r-sm);background:var(--bg2);color:var(--mt);font-family:var(--font-body);font-size:.86rem;font-weight:600;cursor:pointer;transition:all .15s}
.bc:hover{border-color:var(--bdr2);color:var(--fg)}
.bs{padding:9px 22px;border:none;border-radius:var(--r-sm);color:#fff;font-family:var(--font-body);font-size:.86rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .15s}
.bs.green{background:var(--ok);color:var(--fg)}.bs.green:hover{filter:brightness(1.1)}
.bs.amber{background:var(--wn);color:var(--fg)}.bs.amber:hover{filter:brightness(1.1)}
.bs:disabled{opacity:.6;cursor:not-allowed}
.bd{padding:9px 22px;border:none;border-radius:var(--r-sm);background: var(--dg-solid);color: #fff;font-family:var(--font-body);font-size:.86rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px}
.bd:hover{filter:brightness(1.1)}
.bd:disabled{opacity:.6;cursor:not-allowed}
.dw{margin-top:10px;font-size:.82rem;color:var(--dg);font-weight:600}
.mb p strong{color:var(--fg)}
.modal-enter-active{transition:all .25s ease-out}
.modal-leave-active{transition:all .2s ease-in}
.modal-enter-from .md,.modal-leave-to .md{transform:translateY(16px) scale(.98);opacity:0}
@media(max-width:1024px){.sr{grid-template-columns:repeat(2,1fr)}.ig{grid-template-columns:1fr}}

</style>