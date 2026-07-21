<script setup lang="ts">
interface Category {
  id: number
  name: string
  sortOrder: number
}

interface Product {
  id: number
  name: string
  price: number
  categoryId: number | null
  isActive: boolean
}

interface CartLine {
  productId: number
  name: string
  price: number
  quantity: number
}

const toast = useToast()

const { data: categories } = await useFetch<Category[]>('/api/categories')
const { data: products } = await useFetch<Product[]>('/api/products')

const activeProducts = computed(() => (products.value ?? []).filter(p => p.isActive))
const selectedCategoryId = ref<number | 'all'>('all')

const filteredProducts = computed(() => {
  if (selectedCategoryId.value === 'all') return activeProducts.value
  return activeProducts.value.filter(p => p.categoryId === selectedCategoryId.value)
})

const cart = ref<CartLine[]>([])

function addToCart(product: Product) {
  const line = cart.value.find(l => l.productId === product.id)
  if (line) {
    line.quantity++
  } else {
    cart.value.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 })
  }
}

function incLine(line: CartLine) {
  line.quantity++
}

function decLine(line: CartLine) {
  line.quantity--
  if (line.quantity <= 0) {
    cart.value = cart.value.filter(l => l.productId !== line.productId)
  }
}

function removeLine(line: CartLine) {
  cart.value = cart.value.filter(l => l.productId !== line.productId)
}

const total = computed(() => cart.value.reduce((sum, l) => sum + l.price * l.quantity, 0))

// ---------- Checkout ----------

const methodLabels = {
  cash: 'เงินสด',
  transfer: 'โอนเงิน',
  qr: 'QR พร้อมเพย์'
} as const

const payModalOpen = ref(false)
const method = ref<keyof typeof methodLabels>('cash')
const amountReceived = ref(0)
const paying = ref(false)

const change = computed(() => method.value === 'cash' ? Math.max(0, amountReceived.value - total.value) : 0)

function openPayModal() {
  if (!cart.value.length) return
  method.value = 'cash'
  amountReceived.value = total.value
  payModalOpen.value = true
}

async function confirmCheckout() {
  paying.value = true
  try {
    const res = await $fetch<{ order: { id: number }, change: number }>('/api/orders/checkout', {
      method: 'POST',
      body: {
        items: cart.value.map(l => ({ productId: l.productId, quantity: l.quantity })),
        method: method.value,
        amountReceived: method.value === 'cash' ? amountReceived.value : undefined
      }
    })
    cart.value = []
    payModalOpen.value = false
    await navigateTo({ path: `/pos/orders/${res.order.id}`, query: res.change ? { change: res.change } : undefined })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'ชำระเงินไม่สำเร็จ', color: 'error' })
  } finally {
    paying.value = false
  }
}
</script>

<template>
  <UContainer class="py-6">
    <div class="flex flex-col lg:flex-row gap-6">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <UButton
            :color="selectedCategoryId === 'all' ? 'primary' : 'neutral'"
            :variant="selectedCategoryId === 'all' ? 'solid' : 'soft'"
            size="sm"
            @click="selectedCategoryId = 'all'"
          >
            ทั้งหมด
          </UButton>
          <UButton
            v-for="category in categories"
            :key="category.id"
            :color="selectedCategoryId === category.id ? 'primary' : 'neutral'"
            :variant="selectedCategoryId === category.id ? 'solid' : 'soft'"
            size="sm"
            @click="selectedCategoryId = category.id"
          >
            {{ category.name }}
          </UButton>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          <UCard
            v-for="product in filteredProducts"
            :key="product.id"
            class="cursor-pointer hover:ring-2 hover:ring-primary transition-shadow"
            @click="addToCart(product)"
          >
            <p class="font-medium truncate">
              {{ product.name }}
            </p>
            <p class="text-muted text-sm mt-1">
              {{ product.price.toFixed(2) }} บาท
            </p>
          </UCard>
          <p
            v-if="!filteredProducts.length"
            class="text-muted text-sm col-span-full py-8 text-center"
          >
            ไม่มีสินค้าในหมวดหมู่นี้
          </p>
        </div>
      </div>

      <UCard class="w-full lg:w-80 shrink-0 h-fit lg:sticky lg:top-4">
        <template #header>
          <h2 class="font-bold">
            ออเดอร์ปัจจุบัน
          </h2>
        </template>

        <div class="flex flex-col divide-y divide-default max-h-[50vh] overflow-y-auto">
          <div
            v-for="line in cart"
            :key="line.productId"
            class="flex items-center justify-between py-2 gap-2"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">
                {{ line.name }}
              </p>
              <p class="text-xs text-muted">
                {{ line.price.toFixed(2) }} บาท x {{ line.quantity }}
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <UButton
                icon="i-lucide-minus"
                size="xs"
                color="neutral"
                variant="soft"
                @click="decLine(line)"
              />
              <span class="w-5 text-center text-sm">{{ line.quantity }}</span>
              <UButton
                icon="i-lucide-plus"
                size="xs"
                color="neutral"
                variant="soft"
                @click="incLine(line)"
              />
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="error"
                variant="ghost"
                @click="removeLine(line)"
              />
            </div>
          </div>
          <p
            v-if="!cart.length"
            class="text-muted text-sm py-6 text-center"
          >
            แตะสินค้าเพื่อเพิ่มลงออเดอร์
          </p>
        </div>

        <template #footer>
          <div class="flex items-center justify-between font-bold mb-3">
            <span>รวม</span>
            <span>{{ total.toFixed(2) }} บาท</span>
          </div>
          <UButton
            block
            size="lg"
            :disabled="!cart.length"
            @click="openPayModal"
          >
            ชำระเงิน
          </UButton>
        </template>
      </UCard>
    </div>

    <UModal
      v-model:open="payModalOpen"
      title="ชำระเงิน"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <div class="flex gap-2">
            <UButton
              v-for="m in (['cash', 'transfer', 'qr'] as const)"
              :key="m"
              :color="method === m ? 'primary' : 'neutral'"
              :variant="method === m ? 'solid' : 'soft'"
              class="flex-1"
              @click="method = m"
            >
              {{ methodLabels[m] }}
            </UButton>
          </div>

          <p class="text-lg font-bold text-center">
            ยอดชำระ {{ total.toFixed(2) }} บาท
          </p>

          <template v-if="method === 'cash'">
            <UFormField label="รับเงินมา (บาท)">
              <UInputNumber
                v-model="amountReceived"
                :min="0"
                class="w-full"
              />
            </UFormField>
            <p class="text-center text-muted">
              เงินทอน: <span class="font-bold text-default">{{ change.toFixed(2) }}</span> บาท
            </p>
          </template>

          <UButton
            block
            size="lg"
            :loading="paying"
            :disabled="method === 'cash' && amountReceived < total"
            @click="confirmCheckout"
          >
            ยืนยันรับชำระเงิน
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
