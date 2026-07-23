<script setup lang="ts">
interface Category {
  id: number
  name: string
  sortOrder: number
}

interface OptionChoice {
  id: number
  optionGroupId: number
  name: string
  priceDelta: number
}

interface OptionGroup {
  id: number
  productId: number
  name: string
  isRequired: boolean
  choices: OptionChoice[]
}

interface Product {
  id: number
  name: string
  price: number
  categoryId: number | null
  imageUrl: string | null
  isActive: boolean
  optionGroups: OptionGroup[]
}

interface CartLineOption {
  groupId: number
  choiceId: number
  name: string
  priceDelta: number
}

interface CartLine {
  key: string
  productId: number
  name: string
  price: number
  quantity: number
  options: CartLineOption[]
}

const toast = useToast()
const { user } = useUserSession()

const { data: categories } = await useFetch<Category[]>('/api/categories')
const { data: products } = await useFetch<Product[]>('/api/products')

const activeProducts = computed(() =>
  (products.value ?? []).filter(p => p.isActive)
)
const selectedCategoryId = ref<number | 'all'>('all')

// ---------- Identify who's actually taking orders on this terminal ----------
// A shared POS terminal might stay logged into one account all shift, so we
// ask for the receiving staff member's own PIN when the page loads, the same
// way the header's clock-in/out kiosk does — see /api/employees/identify.
const identifyModalOpen = ref(true)
const identifyCode = ref('')
const identifyLoading = ref(false)
const receivingEmployee = ref<{ id: number, name: string } | null>(null)

function openIdentifyModal() {
  identifyCode.value = ''
  identifyModalOpen.value = true
}

async function submitIdentify() {
  identifyLoading.value = true
  try {
    receivingEmployee.value = await $fetch<{ id: number, name: string }>(
      '/api/employees/identify',
      { method: 'POST', body: { code: identifyCode.value } }
    )
    identifyModalOpen.value = false
  } catch (err: any) {
    toast.add({
      title: err?.data?.statusMessage ?? 'รหัสไม่ถูกต้อง',
      color: 'error'
    })
  } finally {
    identifyLoading.value = false
  }
}

function skipIdentify() {
  receivingEmployee.value = null
  identifyCode.value = ''
  identifyModalOpen.value = false
}

const filteredProducts = computed(() => {
  if (selectedCategoryId.value === 'all') return activeProducts.value
  return activeProducts.value.filter(
    p => p.categoryId === selectedCategoryId.value
  )
})

interface ProductGroup {
  key: string
  label: string | null
  products: Product[]
}

// On the "all" tab, group products by category (server already returns
// categories in sortOrder) so browsing a big menu doesn't dump everything
// into one undifferentiated grid. A specific category tab stays a single
// flat group with no heading, since it'd just repeat the tab's own label.
const productGroups = computed<ProductGroup[]>(() => {
  if (selectedCategoryId.value !== 'all') {
    return [{ key: 'filtered', label: null, products: filteredProducts.value }]
  }
  const groups = (categories.value ?? [])
    .map(c => ({
      key: String(c.id),
      label: c.name,
      products: activeProducts.value.filter(p => p.categoryId === c.id)
    }))
    .filter(g => g.products.length)
  const uncategorized = activeProducts.value.filter(
    p => p.categoryId == null
  )
  if (uncategorized.length) {
    groups.push({
      key: 'uncategorized',
      label: 'ไม่มีหมวดหมู่',
      products: uncategorized
    })
  }
  return groups
})

const cart = ref<CartLine[]>([])

function lineKey(productId: number, options: CartLineOption[]) {
  const sorted = [...options]
    .sort((a, b) => a.groupId - b.groupId)
    .map(o => `${o.groupId}:${o.choiceId}`)
  return `${productId}|${sorted.join(',')}`
}

function addLine(product: Product, options: CartLineOption[]) {
  const key = lineKey(product.id, options)
  const existing = cart.value.find(l => l.key === key)
  if (existing) {
    existing.quantity++
    return
  }
  const price
    = product.price + options.reduce((sum, o) => sum + o.priceDelta, 0)
  cart.value.push({
    key,
    productId: product.id,
    name: product.name,
    price,
    quantity: 1,
    options
  })
}

function addToCart(product: Product) {
  if (product.optionGroups.length) {
    openOptionModal(product)
    return
  }
  addLine(product, [])
}

function incLine(line: CartLine) {
  line.quantity++
}

function decLine(line: CartLine) {
  line.quantity--
  if (line.quantity <= 0) {
    cart.value = cart.value.filter(l => l.key !== line.key)
  }
}

function removeLine(line: CartLine) {
  cart.value = cart.value.filter(l => l.key !== line.key)
}

const subtotal = computed(() =>
  cart.value.reduce((sum, l) => sum + l.price * l.quantity, 0)
)
const orderNote = ref('')

function clearCart() {
  if (!cart.value.length) return
  if (!window.confirm('ล้างออเดอร์ปัจจุบันทั้งหมด?')) return
  cart.value = []
  orderNote.value = ''
}

// ---------- Option selection (sweetness, size, pearls, ...) ----------

const optionModalOpen = ref(false)
const optionModalProduct = ref<Product | null>(null)
const optionSelections = reactive<Record<number, number | undefined>>({})

function openOptionModal(product: Product) {
  optionModalProduct.value = product
  // Stale entries from a previously opened product are harmless — only the
  // current product's own group ids are ever read.
  for (const group of product.optionGroups) {
    optionSelections[group.id] = group.choices[0]?.id
  }
  optionModalOpen.value = true
}

const canConfirmOptions = computed(() => {
  const product = optionModalProduct.value
  if (!product) return false
  return product.optionGroups.every(
    group => !group.isRequired || optionSelections[group.id] != null
  )
})

function confirmOptionModal() {
  const product = optionModalProduct.value
  if (!product || !canConfirmOptions.value) return
  const options: CartLineOption[] = []
  for (const group of product.optionGroups) {
    const choiceId = optionSelections[group.id]
    if (choiceId == null) continue
    const choice = group.choices.find(c => c.id === choiceId)
    if (!choice) continue
    options.push({
      groupId: group.id,
      choiceId: choice.id,
      name: choice.name,
      priceDelta: choice.priceDelta
    })
  }
  addLine(product, options)
  optionModalOpen.value = false
}

// ---------- Checkout ----------

const methodLabels = {
  cash: 'เงินสด',
  transfer: 'โอนเงิน',
  qr: 'QR พร้อมเพย์'
} as const

const payModalOpen = ref(false)
const method = ref<keyof typeof methodLabels>('cash')
const amountReceived = ref(0)
const discountAmount = ref(0)
const paying = ref(false)

const payTotal = computed(() =>
  Math.max(0, subtotal.value - (discountAmount.value || 0))
)
const change = computed(() =>
  method.value === 'cash'
    ? Math.max(0, amountReceived.value - payTotal.value)
    : 0
)

function openPayModal() {
  if (!cart.value.length) return
  method.value = 'cash'
  discountAmount.value = 0
  amountReceived.value = subtotal.value
  payModalOpen.value = true
}

async function confirmCheckout() {
  paying.value = true
  try {
    const res = await $fetch<{ order: { id: number }, change: number }>(
      '/api/orders/checkout',
      {
        method: 'POST',
        body: {
          items: cart.value.map(l => ({
            productId: l.productId,
            quantity: l.quantity,
            options: l.options.map(o => ({
              groupId: o.groupId,
              choiceId: o.choiceId
            }))
          })),
          method: method.value,
          amountReceived:
            method.value === 'cash' ? amountReceived.value : undefined,
          note: orderNote.value.trim() || undefined,
          discountAmount: discountAmount.value || undefined,
          receivingCode: receivingEmployee.value
            ? identifyCode.value
            : undefined
        }
      }
    )
    cart.value = []
    orderNote.value = ''
    payModalOpen.value = false
    await navigateTo({
      path: `/pos/orders/${res.order.id}`,
      query: res.change ? { change: res.change } : undefined
    })
  } catch (err: any) {
    toast.add({
      title: err?.data?.statusMessage ?? 'ชำระเงินไม่สำเร็จ',
      color: 'error'
    })
  } finally {
    paying.value = false
  }
}
</script>

<template>
  <UContainer class="py-6">
    <div class="flex flex-col md:flex-row gap-6">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2.5 mb-5 overflow-x-auto pb-1.5">
          <UButton
            :color="selectedCategoryId === 'all' ? 'primary' : 'neutral'"
            :variant="selectedCategoryId === 'all' ? 'solid' : 'soft'"
            size="lg"
            class="shrink-0"
            @click="selectedCategoryId = 'all'"
          >
            ทั้งหมด
          </UButton>
          <UButton
            v-for="category in categories"
            :key="category.id"
            :color="selectedCategoryId === category.id ? 'primary' : 'neutral'"
            :variant="selectedCategoryId === category.id ? 'solid' : 'soft'"
            size="lg"
            class="shrink-0"
            @click="selectedCategoryId = category.id"
          >
            {{ category.name }}
          </UButton>
        </div>

        <div class="flex flex-col gap-6">
          <div
            v-for="group in productGroups"
            :key="group.key"
          >
            <h3
              v-if="group.label"
              class="font-semibold text-muted mb-3"
            >
              {{ group.label }}
            </h3>
            <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <UCard
                v-for="product in group.products"
                :key="product.id"
                class="cursor-pointer hover:ring-2 hover:ring-primary active:ring-2 active:ring-primary transition-shadow select-none"
                :ui="{ body: 'p-0' }"
                @click="addToCart(product)"
              >
                <img
                  v-if="product.imageUrl"
                  :src="product.imageUrl"
                  class="w-full aspect-4/3 object-cover"
                >
                <div
                  v-else
                  class="w-full aspect-4/3 bg-elevated flex items-center justify-center"
                >
                  <UIcon
                    name="i-lucide-coffee"
                    class="size-8 text-dimmed"
                  />
                </div>
                <div class="p-3">
                  <p class="font-semibold text-base truncate">
                    {{ product.name }}
                  </p>
                  <p class="text-muted text-sm mt-1">
                    {{ product.price.toFixed(2) }} บาท
                  </p>
                </div>
              </UCard>
            </div>
          </div>
          <p
            v-if="!productGroups.some((g) => g.products.length)"
            class="text-muted text-sm py-8 text-center"
          >
            ไม่มีสินค้าในหมวดหมู่นี้
          </p>
        </div>
      </div>

      <UCard class="w-full md:w-80 lg:w-96 shrink-0 h-fit md:sticky md:top-4">
        <template #header>
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-bold text-lg">
                ออเดอร์ปัจจุบัน
              </h2>
              <UButton
                v-if="cart.length"
                icon="i-lucide-trash-2"
                size="lg"
                color="error"
                variant="ghost"
                class="size-10 shrink-0"
                title="ล้างออเดอร์"
                @click="clearCart"
              />
            </div>
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg bg-primary/10 hover:bg-primary/15 transition-colors px-3 py-2.5"
              @click="openIdentifyModal"
            >
              <UIcon
                name="i-lucide-user-round-check"
                class="size-5 text-primary shrink-0"
              />
              <span class="flex-1 min-w-0 text-left">
                <span class="block text-xs text-primary/80 leading-tight">ผู้รับออเดอร์</span>
                <span
                  class="block font-bold text-primary truncate leading-tight"
                >{{ receivingEmployee?.name ?? user?.name ?? "-" }}</span>
              </span>
              <span class="text-xs text-primary underline shrink-0">เปลี่ยน</span>
            </button>
          </div>
        </template>

        <div
          class="flex flex-col divide-y divide-default max-h-[50vh] overflow-y-auto"
        >
          <div
            v-for="line in cart"
            :key="line.key"
            class="flex items-center justify-between py-3 gap-2"
          >
            <div class="min-w-0">
              <p class="truncate font-medium">
                {{ line.name }}
              </p>
              <p
                v-if="line.options.length"
                class="text-sm text-muted truncate"
              >
                {{ line.options.map((o) => o.name).join(", ") }}
              </p>
              <p class="text-sm text-muted">
                {{ line.price.toFixed(2) }} บาท x {{ line.quantity }}
              </p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <UButton
                icon="i-lucide-minus"
                size="lg"
                color="neutral"
                variant="soft"
                class="size-10"
                @click="decLine(line)"
              />
              <span class="w-6 text-center font-medium">{{
                line.quantity
              }}</span>
              <UButton
                icon="i-lucide-plus"
                size="lg"
                color="neutral"
                variant="soft"
                class="size-10"
                @click="incLine(line)"
              />
              <UButton
                icon="i-lucide-x"
                size="lg"
                color="error"
                variant="ghost"
                class="size-10"
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
          <UFormField
            label="โต๊ะ/ชื่อลูกค้า/คิว (ถ้ามี)"
            class="mb-3"
          >
            <UInput
              v-model="orderNote"
              size="lg"
              placeholder="เช่น โต๊ะ 5, คุณเอ, คิว 12"
              class="w-full"
            />
          </UFormField>
          <div class="flex items-center justify-between font-bold text-lg mb-3">
            <span>รวม</span>
            <span>{{ subtotal.toFixed(2) }} บาท</span>
          </div>
          <UButton
            block
            size="xl"
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
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body>
        <div class="flex flex-col gap-5">
          <div class="flex gap-2">
            <UButton
              v-for="m in ['cash', 'transfer', 'qr'] as const"
              :key="m"
              size="lg"
              :color="method === m ? 'primary' : 'neutral'"
              :variant="method === m ? 'solid' : 'soft'"
              class="flex-1"
              @click="method = m"
            >
              {{ methodLabels[m] }}
            </UButton>
          </div>

          <UFormField label="ส่วนลด (บาท, ถ้ามี)">
            <UInputNumber
              v-model="discountAmount"
              size="xl"
              :min="0"
              :max="subtotal"
              class="w-full"
            />
          </UFormField>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-muted">
              <span>ยอดรวม</span>
              <span>{{ subtotal.toFixed(2) }} บาท</span>
            </div>
            <div
              v-if="discountAmount"
              class="flex items-center justify-between text-muted"
            >
              <span>ส่วนลด</span>
              <span>-{{ discountAmount.toFixed(2) }} บาท</span>
            </div>
          </div>

          <p class="text-xl font-bold text-center">
            ยอดชำระ {{ payTotal.toFixed(2) }} บาท
          </p>

          <template v-if="method === 'cash'">
            <UFormField label="รับเงินมา (บาท)">
              <UInputNumber
                v-model="amountReceived"
                size="xl"
                :min="0"
                class="w-full"
              />
            </UFormField>
            <p class="text-center text-muted text-lg">
              เงินทอน:
              <span class="font-bold text-default">{{
                change.toFixed(2)
              }}</span>
              บาท
            </p>
          </template>

          <UButton
            block
            size="xl"
            :loading="paying"
            :disabled="method === 'cash' && amountReceived < payTotal"
            @click="confirmCheckout"
          >
            ยืนยันรับชำระเงิน
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="optionModalOpen"
      :title="optionModalProduct ? optionModalProduct.name : 'เลือกตัวเลือก'"
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body>
        <div class="flex flex-col gap-6">
          <div
            v-for="group in optionModalProduct?.optionGroups ?? []"
            :key="group.id"
          >
            <p class="font-medium mb-2.5">
              {{ group.name }}
              <span
                v-if="group.isRequired"
                class="text-error"
              >*</span>
            </p>
            <URadioGroup
              v-model="optionSelections[group.id]"
              variant="card"
              size="xl"
              :items="
                group.choices.map((c) => ({
                  label: `${c.name}${c.priceDelta ? ` (${c.priceDelta > 0 ? '+' : ''}${c.priceDelta.toFixed(2)} บาท)` : ''}`,
                  value: c.id
                }))
              "
            />
          </div>

          <UButton
            block
            size="xl"
            :disabled="!canConfirmOptions"
            @click="confirmOptionModal"
          >
            เพิ่มลงตะกร้า
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="identifyModalOpen"
      title="ใครรับออเดอร์นี้?"
      description="กรอกรหัสพนักงานของคุณ เพื่อบันทึกว่าใครเป็นผู้รับออเดอร์"
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <PinPad
            v-model="identifyCode"
            :loading="identifyLoading"
            @submit="submitIdentify"
          />
          <UButton
            block
            size="lg"
            color="neutral"
            variant="ghost"
            @click="skipIdentify"
          >
            ข้าม (ใช้บัญชี {{ user?.name }} ที่ล็อกอินอยู่)
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
