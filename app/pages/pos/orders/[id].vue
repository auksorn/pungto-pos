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
  createdAt: string
  employee: { name: string }
  items: OrderItem[]
  payments: Payment[]
}

const route = useRoute()
const orderId = Number(route.params.id)
const change = route.query.change ? Number(route.query.change) : null

const { data: order } = await useFetch<Order>(`/api/orders/${orderId}`)

const total = computed(() => (order.value?.items ?? []).reduce((sum, item) => sum + item.price * item.quantity, 0))

const methodLabels: Record<Payment['method'], string> = {
  cash: 'เงินสด',
  transfer: 'โอนเงิน',
  qr: 'QR พร้อมเพย์'
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
        >
          ชำระแล้ว
        </UBadge>
      </div>

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
          <div class="flex items-center justify-between font-bold text-lg">
            <span>รวมทั้งหมด</span>
            <span>{{ total.toFixed(2) }} บาท</span>
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

      <UButton
        to="/pos"
        block
      >
        กลับไปหน้าขาย
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
