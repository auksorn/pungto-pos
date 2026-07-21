<script setup lang="ts">
interface StockItem {
  id: number
  branchId: number
  name: string
  unit: string
  quantity: number
  minThreshold: number
}

const { user } = useUserSession()
const toast = useToast()
const canManage = computed(() => user.value && ['owner', 'manager'].includes(user.value.role))

const { data: items, refresh } = await useFetch<StockItem[]>('/api/stock-items')

function isLow(item: StockItem) {
  return item.quantity <= item.minThreshold
}

// ---------- Create/edit stock item ----------

const itemModalOpen = ref(false)
const editingItem = ref<StockItem | null>(null)
const itemForm = reactive({ name: '', unit: '', minThreshold: 0 })

function openNewItem() {
  editingItem.value = null
  itemForm.name = ''
  itemForm.unit = ''
  itemForm.minThreshold = 0
  itemModalOpen.value = true
}

function openEditItem(item: StockItem) {
  editingItem.value = item
  itemForm.name = item.name
  itemForm.unit = item.unit
  itemForm.minThreshold = item.minThreshold
  itemModalOpen.value = true
}

async function submitItem() {
  try {
    if (editingItem.value) {
      await $fetch(`/api/stock-items/${editingItem.value.id}`, { method: 'PATCH', body: itemForm })
    } else {
      await $fetch('/api/stock-items', { method: 'POST', body: itemForm })
    }
    itemModalOpen.value = false
    await refresh()
    toast.add({ title: 'บันทึกวัตถุดิบสำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'บันทึกไม่สำเร็จ', color: 'error' })
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
            size="sm"
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
          class="flex items-center justify-between py-3 gap-2"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-medium truncate">
                {{ item.name }}
              </p>
              <UBadge
                v-if="isLow(item)"
                color="error"
                variant="subtle"
              >
                สต๊อกใกล้หมด
              </UBadge>
            </div>
            <p class="text-sm text-muted">
              คงเหลือ {{ item.quantity }} {{ item.unit }} · ขั้นต่ำ {{ item.minThreshold }} {{ item.unit }}
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UButton
              size="xs"
              @click="openTxModal(item)"
            >
              ทำรายการ
            </UButton>
            <template v-if="canManage">
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="openEditItem(item)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
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
          <UFormField label="ชื่อวัตถุดิบ">
            <UInput
              v-model="itemForm.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="หน่วยนับ (เช่น กรัม, มล., ถุง)">
            <UInput
              v-model="itemForm.unit"
              class="w-full"
            />
          </UFormField>
          <UFormField label="สต๊อกขั้นต่ำ (แจ้งเตือนเมื่อต่ำกว่านี้)">
            <UInputNumber
              v-model="itemForm.minThreshold"
              :min="0"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            block
          >
            บันทึก
          </UButton>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="txModalOpen"
      :title="txItem ? `ทำรายการ: ${txItem.name}` : 'ทำรายการ'"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <div class="flex gap-2">
            <UButton
              v-for="t in (['in', 'out', 'adjust'] as const)"
              :key="t"
              :color="txType === t ? 'primary' : 'neutral'"
              :variant="txType === t ? 'solid' : 'soft'"
              class="flex-1"
              @click="txType = t"
            >
              {{ txTypeLabels[t] }}
            </UButton>
          </div>

          <UFormField :label="txType === 'adjust' ? 'จำนวนที่เปลี่ยนแปลง (+/-)' : `จำนวน (${txItem?.unit})`">
            <UInputNumber
              v-model="txQuantity"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="txType !== 'in'"
            label="เหตุผล"
          >
            <UInput
              v-model="txReason"
              placeholder="เช่น ของเสีย, นับสต๊อกใหม่"
              class="w-full"
            />
          </UFormField>

          <UButton
            block
            :loading="txSubmitting"
            @click="submitTx"
          >
            บันทึก
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
