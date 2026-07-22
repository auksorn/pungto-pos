<script setup lang="ts">
interface OrderItemOption { groupId: number, choiceId: number, name: string, priceDelta: number }

interface OrderItem {
  id: number
  quantity: number
  options: OrderItemOption[] | null
  product: { name: string }
}

interface Order {
  id: number
  note: string | null
  createdAt: string
  items: OrderItem[]
}

const route = useRoute()
const orderId = Number(route.params.id)

const { data: order } = await useFetch<Order>(`/api/orders/${orderId}`)

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
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
      <div class="flex items-center justify-between print:hidden">
        <h1 class="text-xl font-bold">
          ใบสั่งเตรียมเครื่องดื่ม #{{ order.id }}
        </h1>
      </div>

      <div class="text-center border-b-2 border-dashed border-default pb-3">
        <p class="text-2xl font-bold">
          ออเดอร์ #{{ order.id }}
        </p>
        <p
          v-if="order.note"
          class="text-lg font-medium mt-1"
        >
          {{ order.note }}
        </p>
        <p class="text-sm text-muted mt-1">
          {{ formatTime(order.createdAt) }}
        </p>
      </div>

      <div class="flex flex-col divide-y divide-dashed divide-default">
        <div
          v-for="item in order.items"
          :key="item.id"
          class="py-3"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="text-xl font-bold">
              {{ item.product.name }}
            </p>
            <p class="text-xl font-bold shrink-0">
              x{{ item.quantity }}
            </p>
          </div>
          <p
            v-if="item.options?.length"
            class="text-base text-muted mt-1"
          >
            {{ item.options.map(o => o.name).join(', ') }}
          </p>
        </div>
      </div>

      <div class="flex gap-2 print:hidden">
        <UButton
          :to="`/pos/orders/${order.id}`"
          block
          size="xl"
          color="neutral"
          variant="soft"
        >
          กลับไปใบเสร็จ
        </UButton>
        <UButton
          icon="i-lucide-printer"
          block
          size="xl"
          @click="printPage"
        >
          พิมพ์ใบสั่ง
        </UButton>
      </div>
    </div>

    <p
      v-else
      class="text-muted text-center py-12"
    >
      ไม่พบออเดอร์
    </p>
  </UContainer>
</template>
