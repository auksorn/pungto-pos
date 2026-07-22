<script setup lang="ts">
interface Ingredient {
  id: number
  name: string
  unit: string
  costPerUnit: number
  imageUrl: string | null
}

interface StockItem {
  id: number
  branchId: number
  ingredientId: number
  ingredient: Ingredient
  quantity: number
  minThreshold: number
}

interface StockTransaction {
  id: number
  type: 'in' | 'out' | 'adjust'
  quantity: number
  reason: string | null
  refOrderId: number | null
  createdAt: string
  employee: { id: number, name: string }
}

const { user } = useUserSession()
const toast = useToast()
const canManage = computed(() => user.value && ['owner', 'manager'].includes(user.value.role))

const { data: items, refresh } = await useFetch<StockItem[]>('/api/stock-items')

function isLow(item: StockItem) {
  return item.quantity <= item.minThreshold
}

// ---------- Create stock item / edit threshold ----------

const itemModalOpen = ref(false)
const editingItem = ref<StockItem | null>(null)
const itemSubmitting = ref(false)
const itemImageFile = ref<File | null>(null)
const itemForm = reactive<{ name: string, unit: string, minThreshold: number, costPerUnit: number, imageUrl: string | null }>({
  name: '',
  unit: '',
  minThreshold: 0,
  costPerUnit: 0,
  imageUrl: null
})

function openNewItem() {
  editingItem.value = null
  itemForm.name = ''
  itemForm.unit = ''
  itemForm.minThreshold = 0
  itemForm.costPerUnit = 0
  itemForm.imageUrl = null
  itemImageFile.value = null
  itemModalOpen.value = true
}

function openEditItem(item: StockItem) {
  editingItem.value = item
  itemForm.name = item.ingredient.name
  itemForm.unit = item.ingredient.unit
  itemForm.minThreshold = item.minThreshold
  itemForm.costPerUnit = item.ingredient.costPerUnit
  itemForm.imageUrl = item.ingredient.imageUrl
  itemImageFile.value = null
  itemModalOpen.value = true
}

function clearItemImage() {
  itemForm.imageUrl = null
  itemImageFile.value = null
}

async function submitItem() {
  itemSubmitting.value = true
  try {
    const imageUrl = itemImageFile.value ? await uploadImage(itemImageFile.value) : itemForm.imageUrl
    if (editingItem.value) {
      await $fetch(`/api/stock-items/${editingItem.value.id}`, { method: 'PATCH', body: { minThreshold: itemForm.minThreshold } })
      await $fetch(`/api/ingredients/${editingItem.value.ingredientId}`, { method: 'PATCH', body: { costPerUnit: itemForm.costPerUnit, imageUrl } })
    } else {
      await $fetch('/api/stock-items', { method: 'POST', body: { ...itemForm, imageUrl } })
    }
    itemModalOpen.value = false
    await refresh()
    toast.add({ title: 'บันทึกวัตถุดิบสำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'บันทึกไม่สำเร็จ', color: 'error' })
  } finally {
    itemSubmitting.value = false
  }
}

async function deleteItem(item: StockItem) {
  try {
    await $fetch(`/api/stock-items/${item.id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'ลบวัตถุดิบสำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'ลบไม่สำเร็จ', color: 'error' })
  }
}

// ---------- Stock transaction ----------

const txModalOpen = ref(false)
const txItem = ref<StockItem | null>(null)
const txType = ref<'in' | 'out' | 'adjust'>('in')
const txQuantity = ref(0)
const txReason = ref('')
const txSubmitting = ref(false)

const txTypeLabels = {
  in: 'รับเข้า',
  out: 'เบิกออก',
  adjust: 'ปรับยอด'
} as const

function openTxModal(item: StockItem) {
  txItem.value = item
  txType.value = 'in'
  txQuantity.value = 0
  txReason.value = ''
  txModalOpen.value = true
}

async function submitTx() {
  if (!txItem.value) return
  if (txQuantity.value === 0) {
    toast.add({ title: 'กรุณากรอกจำนวน', color: 'error' })
    return
  }
  txSubmitting.value = true
  try {
    await $fetch(`/api/stock-items/${txItem.value.id}/transactions`, {
      method: 'POST',
      body: {
        type: txType.value,
        quantity: txType.value === 'adjust' ? txQuantity.value : Math.abs(txQuantity.value),
        reason: txReason.value || undefined
      }
    })
    txModalOpen.value = false
    await refresh()
    toast.add({ title: 'บันทึกรายการสต๊อกสำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'บันทึกไม่สำเร็จ', color: 'error' })
  } finally {
    txSubmitting.value = false
  }
}

// ---------- Transaction history ----------

const historyModalOpen = ref(false)
const historyItem = ref<StockItem | null>(null)
const historyRows = ref<StockTransaction[]>([])
const historyLoading = ref(false)

const historyTypeColors = {
  in: 'success',
  out: 'error',
  adjust: 'neutral'
} as const

function historyQuantityLabel(tx: StockTransaction) {
  if (tx.type === 'out') return `-${tx.quantity}`
  return tx.quantity > 0 ? `+${tx.quantity}` : `${tx.quantity}`
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

async function openHistoryModal(item: StockItem) {
  historyItem.value = item
  historyModalOpen.value = true
  historyLoading.value = true
  try {
    historyRows.value = await $fetch<StockTransaction[]>(`/api/stock-items/${item.id}/transactions`)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'โหลดประวัติไม่สำเร็จ', color: 'error' })
  } finally {
    historyLoading.value = false
  }
}
</script>

<template>
  <UContainer class="py-6">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h1 class="font-bold text-lg">
            จัดการสต๊อกวัตถุดิบ
          </h1>
          <UButton
            v-if="canManage"
            icon="i-lucide-plus"
            size="lg"
            @click="openNewItem"
          >
            เพิ่มวัตถุดิบ
          </UButton>
        </div>
      </template>

      <div class="flex flex-col divide-y divide-default">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex items-center justify-between py-4 gap-3"
        >
          <div class="flex items-center gap-3 min-w-0">
            <img
              v-if="item.ingredient.imageUrl"
              :src="item.ingredient.imageUrl"
              class="size-12 rounded-lg object-cover shrink-0"
            >
            <div
              v-else
              class="size-12 rounded-lg bg-elevated shrink-0 flex items-center justify-center"
            >
              <UIcon
                name="i-lucide-image"
                class="size-5 text-dimmed"
              />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-medium truncate">
                  {{ item.ingredient.name }}
                </p>
                <UBadge
                  v-if="isLow(item)"
                  color="error"
                  variant="subtle"
                >
                  สต๊อกใกล้หมด
                </UBadge>
              </div>
              <p class="text-sm text-muted mt-0.5">
                คงเหลือ {{ item.quantity }} {{ item.ingredient.unit }} · ขั้นต่ำ {{ item.minThreshold }} {{ item.ingredient.unit }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UButton
              size="lg"
              @click="openTxModal(item)"
            >
              ทำรายการ
            </UButton>
            <UButton
              icon="i-lucide-history"
              size="lg"
              color="neutral"
              variant="ghost"
              class="size-10"
              title="ประวัติการเคลื่อนไหว"
              @click="openHistoryModal(item)"
            />
            <template v-if="canManage">
              <UButton
                icon="i-lucide-pencil"
                size="lg"
                color="neutral"
                variant="ghost"
                class="size-10"
                @click="openEditItem(item)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="lg"
                color="error"
                variant="ghost"
                class="size-10"
                @click="deleteItem(item)"
              />
            </template>
          </div>
        </div>
        <p
          v-if="!items?.length"
          class="text-muted text-sm py-4"
        >
          ยังไม่มีวัตถุดิบในสต๊อก
        </p>
      </div>
    </UCard>

    <UModal
      v-model:open="itemModalOpen"
      :title="editingItem ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบ'"
    >
      <template #body>
        <form
          class="flex flex-col gap-4"
          @submit.prevent="submitItem"
        >
          <template v-if="editingItem">
            <p class="text-muted">
              {{ editingItem.ingredient.name }} ({{ editingItem.ingredient.unit }})
            </p>
          </template>
          <template v-else>
            <UFormField label="ชื่อวัตถุดิบ">
              <UInput
                v-model="itemForm.name"
                size="lg"
                class="w-full"
              />
            </UFormField>
            <UFormField label="หน่วยนับ (เช่น กรัม, มล., ถุง)">
              <UInput
                v-model="itemForm.unit"
                size="lg"
                class="w-full"
              />
            </UFormField>
          </template>
          <UFormField label="สต๊อกขั้นต่ำ (แจ้งเตือนเมื่อต่ำกว่านี้)">
            <UInputNumber
              v-model="itemForm.minThreshold"
              size="lg"
              :min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="editingItem"
            label="ต้นทุนต่อหน่วย (บาท) — ใช้คำนวณมูลค่าสต๊อกในหน้ารายงาน"
          >
            <UInputNumber
              v-model="itemForm.costPerUnit"
              size="lg"
              :min="0"
              :step="0.5"
              class="w-full"
            />
          </UFormField>
          <UFormField label="รูปภาพวัตถุดิบ (ไม่บังคับ, ระบบจะบีบอัดให้อัตโนมัติ)">
            <div class="flex items-center gap-3">
              <img
                v-if="itemForm.imageUrl && !itemImageFile"
                :src="itemForm.imageUrl"
                class="size-16 rounded-lg object-cover shrink-0"
              >
              <UFileUpload
                v-model="itemImageFile"
                accept="image/*"
                icon="i-lucide-image"
                label="แตะเพื่อเลือกรูป หรือวางไฟล์ที่นี่"
                size="lg"
                class="flex-1 min-w-0"
              />
              <UButton
                v-if="itemForm.imageUrl || itemImageFile"
                icon="i-lucide-x"
                size="lg"
                color="neutral"
                variant="ghost"
                class="size-10 shrink-0"
                title="ลบรูปภาพ"
                @click="clearItemImage"
              />
            </div>
          </UFormField>
          <UButton
            type="submit"
            block
            size="lg"
            :loading="itemSubmitting"
          >
            บันทึก
          </UButton>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="txModalOpen"
      :title="txItem ? `ทำรายการ: ${txItem.ingredient.name}` : 'ทำรายการ'"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <div class="flex gap-2">
            <UButton
              v-for="t in (['in', 'out', 'adjust'] as const)"
              :key="t"
              size="lg"
              :color="txType === t ? 'primary' : 'neutral'"
              :variant="txType === t ? 'solid' : 'soft'"
              class="flex-1"
              @click="txType = t"
            >
              {{ txTypeLabels[t] }}
            </UButton>
          </div>

          <UFormField :label="txType === 'adjust' ? 'จำนวนที่เปลี่ยนแปลง (+/-)' : `จำนวน (${txItem?.ingredient.unit})`">
            <UInputNumber
              v-model="txQuantity"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="txType !== 'in'"
            label="เหตุผล"
          >
            <UInput
              v-model="txReason"
              size="lg"
              placeholder="เช่น ของเสีย, นับสต๊อกใหม่"
              class="w-full"
            />
          </UFormField>

          <UButton
            block
            size="lg"
            :loading="txSubmitting"
            @click="submitTx"
          >
            บันทึก
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="historyModalOpen"
      :title="historyItem ? `ประวัติการเคลื่อนไหว: ${historyItem.ingredient.name}` : 'ประวัติการเคลื่อนไหว'"
    >
      <template #body>
        <div class="flex flex-col divide-y divide-default max-h-[60vh] overflow-y-auto">
          <div
            v-for="tx in historyRows"
            :key="tx.id"
            class="flex items-center justify-between py-3 gap-2"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <UBadge
                  :color="historyTypeColors[tx.type]"
                  variant="subtle"
                >
                  {{ txTypeLabels[tx.type] }}
                </UBadge>
                <span class="text-sm">{{ historyQuantityLabel(tx) }} {{ historyItem?.ingredient.unit }}</span>
              </div>
              <p class="text-sm text-muted truncate mt-0.5">
                {{ formatDateTime(tx.createdAt) }} · {{ tx.employee.name }}
                <template v-if="tx.reason">
                  · {{ tx.reason }}
                </template>
                <template v-if="tx.refOrderId">
                  · ตัดจากออเดอร์ #{{ tx.refOrderId }}
                </template>
              </p>
            </div>
          </div>
          <p
            v-if="!historyLoading && !historyRows.length"
            class="text-muted text-sm py-4"
          >
            ยังไม่มีประวัติการเคลื่อนไหว
          </p>
          <p
            v-if="historyLoading"
            class="text-muted text-sm py-4"
          >
            กำลังโหลด...
          </p>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
