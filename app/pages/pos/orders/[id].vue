<script setup lang="ts">
interface OrderItemOption { groupId: number, choiceId: number, name: string, priceDelta: number }

interface OrderItem {
  id: number
  quantity: number
  price: number
  options: OrderItemOption[] | null
  product: { name: string }
}

interface Payment {
  id: number
  method: 'cash' | 'transfer' | 'qr'
  amount: number
  receivedAt: string
}

interface Order {
  id: number
  status: 'open' | 'paid' | 'cancelled'
  note: string | null
  discountAmount: number
  createdAt: string
  employee: { name: string }
  items: OrderItem[]
  payments: Payment[]
}

const route = useRoute()
const orderId = Number(route.params.id)
const change = route.query.change ? Number(route.query.change) : null

const { data: order } = await useFetch<Order>(`/api/orders/${orderId}`)

const subtotal = computed(() => (order.value?.items ?? []).reduce((sum, item) => sum + item.price * item.quantity, 0))
const grandTotal = computed(() => subtotal.value - (order.value?.discountAmount ?? 0))

const methodLabels: Record<Payment['method'], string> = {
  cash: 'เงินสด',
  transfer: 'โอนเงิน',
  qr: 'QR พร้อมเพย์'
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

function printPage() {
  window.print()
}
</script>

<template>
  <UContainer class="py-6 max-w-lg">
    <div
      v-if="order"
      class="flex flex-col gap-4"
    >
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">
          ใบเสร็จ #{{ order.id }}
        </h1>
        <UBadge
          color="success"
          variant="subtle"
          class="print:hidden"
        >
          ชำระแล้ว
        </UBadge>
      </div>

      <p class="text-sm text-muted -mt-3">
        {{ formatDateTime(order.createdAt) }} · พนักงาน {{ order.employee.name }}
        <template v-if="order.note">
          · {{ order.note }}
        </template>
      </p>

      <UCard>
        <div class="flex flex-col divide-y divide-default">
          <div
            v-for="item in order.items"
            :key="item.id"
            class="flex items-center justify-between py-2"
          >
            <div>
              <p class="font-medium">
                {{ item.product.name }}
              </p>
              <p
                v-if="item.options?.length"
                class="text-sm text-muted"
              >
                {{ item.options.map(o => o.name).join(', ') }}
              </p>
              <p class="text-sm text-muted">
                {{ item.price.toFixed(2) }} บาท x {{ item.quantity }}
              </p>
            </div>
            <p class="font-medium">
              {{ (item.price * item.quantity).toFixed(2) }}
            </p>
          </div>
        </div>

        <template #footer>
          <div class="flex flex-col gap-1">
            <div
              v-if="order.discountAmount"
              class="flex items-center justify-between text-sm text-muted"
            >
              <span>ยอดรวม</span>
              <span>{{ subtotal.toFixed(2) }} บาท</span>
            </div>
            <div
              v-if="order.discountAmount"
              class="flex items-center justify-between text-sm text-muted"
            >
              <span>ส่วนลด</span>
              <span>-{{ order.discountAmount.toFixed(2) }} บาท</span>
            </div>
            <div class="flex items-center justify-between font-bold text-lg">
              <span>รวมทั้งหมด</span>
              <span>{{ grandTotal.toFixed(2) }} บาท</span>
            </div>
          </div>
        </template>
      </UCard>

      <UAlert
        v-if="order.payments.length"
        color="success"
        variant="soft"
        title="ชำระเงินเรียบร้อยแล้ว"
        :description="`ช่องทาง: ${methodLabels[order.payments[0]!.method]}${change ? ` · เงินทอน ${change.toFixed(2)} บาท` : ''}`"
      />

      <div class="flex gap-2 print:hidden">
        <UButton
          to="/pos"
          block
          size="xl"
          color="neutral"
          variant="soft"
        >
          กลับไปหน้าขาย
        </UButton>
        <UButton
          icon="i-lucide-printer"
          block
          size="xl"
          @click="printPage"
        >
          พิมพ์ใบเสร็จ
        </UButton>
      </div>
      <UButton
        :to="`/pos/orders/${order.id}/ticket`"
        icon="i-lucide-clipboard-list"
        block
        size="xl"
        color="neutral"
        variant="ghost"
        class="print:hidden"
      >
        ใบสั่งเตรียมเครื่องดื่ม
      </UButton>
    </div>

    <p
      v-else
      class="text-muted text-center py-12"
    >
      ไม่พบออเดอร์
    </p>
  </UContainer>
</template>
