<script setup lang="ts">
definePageMeta({
  middleware: [() => {
    const { user } = useUserSession()
    if (user.value && !['owner', 'manager'].includes(user.value.role)) {
      return navigateTo('/')
    }
  }]
})

interface Totals { revenue: number, orderCount: number, avgOrder: number }
interface TrendPoint { period: string, revenue: number, orderCount: number }
interface BranchStat { branchId: number, branchName: string, revenue: number, orderCount: number }
interface PaymentMethodStat { method: 'cash' | 'transfer' | 'qr', amount: number, count: number }
interface ProductStat { productId: number, name: string, quantity: number, revenue: number }
interface EmployeeStat { employeeId: number, name: string, revenue: number, orderCount: number }
interface LowStockItem { ingredientName: string, unit: string, branchName: string, quantity: number, minThreshold: number }

interface Summary {
  from: string
  to: string
  groupBy: 'day' | 'month'
  totals: Totals
  trend: TrendPoint[]
  byBranch: BranchStat[]
  byPaymentMethod: PaymentMethodStat[]
  topProducts: ProductStat[]
  byEmployee: EmployeeStat[]
  stock: { totalItems: number, totalValue: number, uncostedCount: number, lowStockCount: number, lowStockItems: LowStockItem[] }
}

const methodLabels = {
  cash: 'เงินสด',
  transfer: 'โอนเงิน',
  qr: 'QR พร้อมเพย์'
} as const

const methodBarClass = {
  cash: 'bg-primary',
  transfer: 'bg-info',
  qr: 'bg-success'
} as const

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type Preset = 'today' | '7d' | '30d' | 'month' | 'custom'

const activePreset = ref<Preset>('today')
const from = ref(toDateStr(new Date()))
const to = ref(toDateStr(new Date()))
const groupBy = ref<'day' | 'month'>('day')

const presets: { key: Preset, label: string }[] = [
  { key: 'today', label: 'วันนี้' },
  { key: '7d', label: '7 วันล่าสุด' },
  { key: '30d', label: '30 วันล่าสุด' },
  { key: 'month', label: 'เดือนนี้' }
]

function applyPreset(preset: Preset) {
  activePreset.value = preset
  const now = new Date()
  if (preset === 'today') {
    from.value = toDateStr(now)
    to.value = toDateStr(now)
    groupBy.value = 'day'
  } else if (preset === '7d') {
    from.value = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
    to.value = toDateStr(now)
    groupBy.value = 'day'
  } else if (preset === '30d') {
    from.value = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29))
    to.value = toDateStr(now)
    groupBy.value = 'day'
  } else if (preset === 'month') {
    from.value = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
    to.value = toDateStr(now)
    groupBy.value = 'month'
  }
}

function onCustomDateChange() {
  activePreset.value = 'custom'
}

const query = computed(() => ({ from: from.value, to: to.value, groupBy: groupBy.value }))
const { data, status } = await useFetch<Summary>('/api/reports/summary', { query })

function formatPeriod(period: string) {
  const parts = period.split('-').map(Number)
  if (groupBy.value === 'month') {
    return new Date(parts[0]!, parts[1]! - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
  }
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function pct(value: number, max: number) {
  return max > 0 && value > 0 ? Math.max(2, (value / max) * 100) : 0
}

const maxTrendRevenue = computed(() => Math.max(0, ...(data.value?.trend ?? []).map(t => t.revenue)))
const maxBranchRevenue = computed(() => Math.max(0, ...(data.value?.byBranch ?? []).map(b => b.revenue)))
const maxMethodAmount = computed(() => Math.max(0, ...(data.value?.byPaymentMethod ?? []).map(m => m.amount)))
const maxProductQuantity = computed(() => Math.max(0, ...(data.value?.topProducts ?? []).map(p => p.quantity)))
const maxEmployeeRevenue = computed(() => Math.max(0, ...(data.value?.byEmployee ?? []).map(e => e.revenue)))
</script>

<template>
  <UContainer class="py-6 flex flex-col gap-4">
    <UCard>
      <template #header>
        <h1 class="font-bold text-lg">
          รายงานยอดขาย
        </h1>
      </template>

      <div class="flex flex-wrap items-center gap-2.5">
        <UButton
          v-for="p in presets"
          :key="p.key"
          size="lg"
          :color="activePreset === p.key ? 'primary' : 'neutral'"
          :variant="activePreset === p.key ? 'solid' : 'soft'"
          @click="applyPreset(p.key)"
        >
          {{ p.label }}
        </UButton>

        <div class="flex items-center gap-2 ml-2">
          <UInput
            v-model="from"
            type="date"
            size="lg"
            @change="onCustomDateChange"
          />
          <span class="text-muted">ถึง</span>
          <UInput
            v-model="to"
            type="date"
            size="lg"
            @change="onCustomDateChange"
          />
        </div>

        <USelect
          v-model="groupBy"
          :items="[{ label: 'รายวัน', value: 'day' }, { label: 'รายเดือน', value: 'month' }]"
          class="w-36 ml-auto"
          size="lg"
        />
      </div>
    </UCard>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <UCard>
        <p class="text-sm text-muted">
          ยอดขายรวม
        </p>
        <p class="text-2xl font-bold">
          {{ (data?.totals.revenue ?? 0).toFixed(2) }}
        </p>
        <p class="text-xs text-muted">
          บาท
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          จำนวนออเดอร์
        </p>
        <p class="text-2xl font-bold">
          {{ data?.totals.orderCount ?? 0 }}
        </p>
        <p class="text-xs text-muted">
          ออเดอร์
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          ยอดขายเฉลี่ย/ออเดอร์
        </p>
        <p class="text-2xl font-bold">
          {{ (data?.totals.avgOrder ?? 0).toFixed(2) }}
        </p>
        <p class="text-xs text-muted">
          บาท
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          มูลค่าสต๊อกคงเหลือ
        </p>
        <p class="text-2xl font-bold">
          {{ (data?.stock.totalValue ?? 0).toFixed(2) }}
        </p>
        <p class="text-xs text-muted">
          บาท
          <template v-if="(data?.stock.uncostedCount ?? 0) > 0">
            · ยังไม่ระบุต้นทุน {{ data?.stock.uncostedCount }} รายการ
          </template>
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          วัตถุดิบใกล้หมด
        </p>
        <p
          class="text-2xl font-bold"
          :class="(data?.stock.lowStockCount ?? 0) > 0 ? 'text-error' : ''"
        >
          {{ data?.stock.lowStockCount ?? 0 }}
        </p>
        <p class="text-xs text-muted">
          จาก {{ data?.stock.totalItems ?? 0 }} รายการ
        </p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          ยอดขาย{{ groupBy === 'month' ? 'รายเดือน' : 'รายวัน' }}
        </h2>
      </template>

      <div class="flex flex-col divide-y divide-default">
        <div
          v-for="t in data?.trend"
          :key="t.period"
          class="flex items-center gap-3 py-3"
        >
          <div class="w-32 shrink-0 text-sm truncate">
            {{ formatPeriod(t.period) }}
          </div>
          <div class="flex-1 h-2 rounded-full bg-elevated overflow-hidden">
            <div
              class="h-full bg-primary rounded-full"
              :style="{ width: pct(t.revenue, maxTrendRevenue) + '%' }"
            />
          </div>
          <div class="w-24 shrink-0 text-sm text-right">
            {{ t.orderCount }} ออเดอร์
          </div>
          <div class="w-28 shrink-0 text-sm text-right font-medium">
            {{ t.revenue.toFixed(2) }} บาท
          </div>
        </div>
        <p
          v-if="status === 'success' && !data?.trend.length"
          class="text-muted text-sm py-4"
        >
          ไม่มียอดขายในช่วงที่เลือก
        </p>
      </div>
    </UCard>

    <UCard v-if="(data?.byBranch.length ?? 0) > 1">
      <template #header>
        <h2 class="font-semibold">
          เปรียบเทียบยอดขายระหว่างสาขา
        </h2>
      </template>

      <div class="flex flex-col divide-y divide-default">
        <div
          v-for="b in data?.byBranch"
          :key="b.branchId"
          class="flex items-center gap-3 py-3"
        >
          <div class="w-32 shrink-0 text-sm truncate">
            {{ b.branchName }}
          </div>
          <div class="flex-1 h-2 rounded-full bg-elevated overflow-hidden">
            <div
              class="h-full bg-primary rounded-full"
              :style="{ width: pct(b.revenue, maxBranchRevenue) + '%' }"
            />
          </div>
          <div class="w-24 shrink-0 text-sm text-right">
            {{ b.orderCount }} ออเดอร์
          </div>
          <div class="w-28 shrink-0 text-sm text-right font-medium">
            {{ b.revenue.toFixed(2) }} บาท
          </div>
        </div>
      </div>
    </UCard>

    <div class="grid md:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <h2 class="font-semibold">
            สรุปยอดตามช่องทางชำระเงิน
          </h2>
        </template>

        <div class="flex flex-col divide-y divide-default">
          <div
            v-for="m in data?.byPaymentMethod"
            :key="m.method"
            class="flex items-center gap-3 py-3"
          >
            <div class="w-24 shrink-0 text-sm truncate">
              {{ methodLabels[m.method] }}
            </div>
            <div class="flex-1 h-2 rounded-full bg-elevated overflow-hidden">
              <div
                class="h-full rounded-full"
                :class="methodBarClass[m.method]"
                :style="{ width: pct(m.amount, maxMethodAmount) + '%' }"
              />
            </div>
            <div class="w-24 shrink-0 text-sm text-right font-medium">
              {{ m.amount.toFixed(2) }} บาท
            </div>
          </div>
          <p
            v-if="status === 'success' && !data?.byPaymentMethod.length"
            class="text-muted text-sm py-4"
          >
            ไม่มียอดขายในช่วงที่เลือก
          </p>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">
            สินค้าขายดี
          </h2>
        </template>

        <div class="flex flex-col divide-y divide-default">
          <div
            v-for="(p, i) in data?.topProducts"
            :key="p.productId"
            class="flex items-center gap-3 py-3"
          >
            <div class="w-6 shrink-0 text-sm text-muted">
              {{ i + 1 }}
            </div>
            <div class="w-24 shrink-0 text-sm truncate">
              {{ p.name }}
            </div>
            <div class="flex-1 h-2 rounded-full bg-elevated overflow-hidden">
              <div
                class="h-full bg-primary rounded-full"
                :style="{ width: pct(p.quantity, maxProductQuantity) + '%' }"
              />
            </div>
            <div class="w-16 shrink-0 text-sm text-right">
              {{ p.quantity }} ชิ้น
            </div>
          </div>
          <p
            v-if="status === 'success' && !data?.topProducts.length"
            class="text-muted text-sm py-4"
          >
            ไม่มียอดขายในช่วงที่เลือก
          </p>
        </div>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          สรุปยอดขายตามพนักงาน
        </h2>
      </template>

      <div class="flex flex-col divide-y divide-default">
        <div
          v-for="e in data?.byEmployee"
          :key="e.employeeId"
          class="flex items-center gap-3 py-3"
        >
          <div class="w-32 shrink-0 text-sm truncate">
            {{ e.name }}
          </div>
          <div class="flex-1 h-2 rounded-full bg-elevated overflow-hidden">
            <div
              class="h-full bg-primary rounded-full"
              :style="{ width: pct(e.revenue, maxEmployeeRevenue) + '%' }"
            />
          </div>
          <div class="w-24 shrink-0 text-sm text-right">
            {{ e.orderCount }} ออเดอร์
          </div>
          <div class="w-28 shrink-0 text-sm text-right font-medium">
            {{ e.revenue.toFixed(2) }} บาท
          </div>
        </div>
        <p
          v-if="status === 'success' && !data?.byEmployee.length"
          class="text-muted text-sm py-4"
        >
          ไม่มียอดขายในช่วงที่เลือก
        </p>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          วัตถุดิบใกล้หมด
        </h2>
      </template>

      <div class="flex flex-col divide-y divide-default">
        <div
          v-for="(item, i) in data?.stock.lowStockItems"
          :key="`${item.ingredientName}-${item.branchName}-${i}`"
          class="flex items-center justify-between py-3 gap-2"
        >
          <div class="min-w-0">
            <p class="font-medium truncate">
              {{ item.ingredientName }}
            </p>
            <p class="text-sm text-muted">
              {{ item.branchName }} · คงเหลือ {{ item.quantity }} {{ item.unit }} · ขั้นต่ำ {{ item.minThreshold }} {{ item.unit }}
            </p>
          </div>
          <UBadge
            color="error"
            variant="subtle"
          >
            ใกล้หมด
          </UBadge>
        </div>
        <p
          v-if="status === 'success' && !data?.stock.lowStockItems.length"
          class="text-muted text-sm py-4"
        >
          ไม่มีวัตถุดิบใกล้หมด
        </p>
      </div>
    </UCard>
  </UContainer>
</template>
