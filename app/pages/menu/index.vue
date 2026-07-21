<script setup lang="ts">
definePageMeta({
  middleware: [() => {
    const { user } = useUserSession()
    if (user.value && !['owner', 'manager'].includes(user.value.role)) {
      return navigateTo('/')
    }
  }]
})

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
  imageUrl: string | null
  isActive: boolean
  category: Category | null
}

const toast = useToast()

const { data: categories, refresh: refreshCategories } = await useFetch<Category[]>('/api/categories')
const { data: products, refresh: refreshProducts } = await useFetch<Product[]>('/api/products')

const categoryOptions = computed(() => (categories.value ?? []).map(c => ({ label: c.name, value: c.id })))

// ---------- Category form ----------

const categoryModalOpen = ref(false)
const editingCategory = ref<Category | null>(null)
const categoryForm = reactive({ name: '', sortOrder: 0 })

function openNewCategory() {
  editingCategory.value = null
  categoryForm.name = ''
  categoryForm.sortOrder = (categories.value?.length ?? 0)
  categoryModalOpen.value = true
}

function openEditCategory(category: Category) {
  editingCategory.value = category
  categoryForm.name = category.name
  categoryForm.sortOrder = category.sortOrder
  categoryModalOpen.value = true
}

async function submitCategory() {
  try {
    if (editingCategory.value) {
      await $fetch(`/api/categories/${editingCategory.value.id}`, { method: 'PATCH', body: categoryForm })
    } else {
      await $fetch('/api/categories', { method: 'POST', body: categoryForm })
    }
    categoryModalOpen.value = false
    await refreshCategories()
    toast.add({ title: 'บันทึกหมวดหมู่สำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'บันทึกไม่สำเร็จ', color: 'error' })
  }
}

async function deleteCategory(category: Category) {
  try {
    await $fetch(`/api/categories/${category.id}`, { method: 'DELETE' })
    await refreshCategories()
    toast.add({ title: 'ลบหมวดหมู่สำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'ลบไม่สำเร็จ', color: 'error' })
  }
}

// ---------- Product form ----------

const productModalOpen = ref(false)
const editingProduct = ref<Product | null>(null)
const productForm = reactive<{ name: string, price: number, categoryId: number | null, imageUrl: string }>({
  name: '',
  price: 0,
  categoryId: null,
  imageUrl: ''
})

function openNewProduct() {
  editingProduct.value = null
  productForm.name = ''
  productForm.price = 0
  productForm.categoryId = categories.value?.[0]?.id ?? null
  productForm.imageUrl = ''
  productModalOpen.value = true
}

function openEditProduct(product: Product) {
  editingProduct.value = product
  productForm.name = product.name
  productForm.price = product.price
  productForm.categoryId = product.categoryId
  productForm.imageUrl = product.imageUrl ?? ''
  productModalOpen.value = true
}

async function submitProduct() {
  const body = {
    name: productForm.name,
    price: productForm.price,
    categoryId: productForm.categoryId,
    imageUrl: productForm.imageUrl || null
  }
  try {
    if (editingProduct.value) {
      await $fetch(`/api/products/${editingProduct.value.id}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/products', { method: 'POST', body })
    }
    productModalOpen.value = false
    await refreshProducts()
    toast.add({ title: 'บันทึกสินค้าสำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'บันทึกไม่สำเร็จ', color: 'error' })
  }
}

async function setProductActive(product: Product, isActive: boolean) {
  try {
    if (isActive) {
      await $fetch(`/api/products/${product.id}`, { method: 'PATCH', body: { isActive: true } })
    } else {
      await $fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    }
    await refreshProducts()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'ทำรายการไม่สำเร็จ', color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-8 flex flex-col gap-8">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-lg">
            หมวดหมู่สินค้า
          </h2>
          <UButton
            icon="i-lucide-plus"
            size="sm"
            @click="openNewCategory"
          >
            เพิ่มหมวดหมู่
          </UButton>
        </div>
      </template>

      <div class="flex flex-col divide-y divide-default">
        <div
          v-for="category in categories"
          :key="category.id"
          class="flex items-center justify-between py-2"
        >
          <span>{{ category.name }}</span>
          <div class="flex items-center gap-1">
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="openEditCategory(category)"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              color="error"
              variant="ghost"
              @click="deleteCategory(category)"
            />
          </div>
        </div>
        <p
          v-if="!categories?.length"
          class="text-muted text-sm py-4"
        >
          ยังไม่มีหมวดหมู่
        </p>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-lg">
            สินค้า
          </h2>
          <UButton
            icon="i-lucide-plus"
            size="sm"
            @click="openNewProduct"
          >
            เพิ่มสินค้า
          </UButton>
        </div>
      </template>

      <div class="flex flex-col divide-y divide-default">
        <div
          v-for="product in products"
          :key="product.id"
          class="flex items-center justify-between py-2 gap-2"
        >
          <div class="min-w-0">
            <p
              class="truncate"
              :class="{ 'text-muted line-through': !product.isActive }"
            >
              {{ product.name }}
            </p>
            <p class="text-sm text-muted">
              {{ product.category?.name ?? 'ไม่มีหมวดหมู่' }} · {{ product.price.toFixed(2) }} บาท
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UBadge
              :color="product.isActive ? 'success' : 'neutral'"
              variant="subtle"
            >
              {{ product.isActive ? 'ขายอยู่' : 'ปิดขาย' }}
            </UBadge>
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="openEditProduct(product)"
            />
            <UButton
              v-if="product.isActive"
              icon="i-lucide-eye-off"
              size="xs"
              color="error"
              variant="ghost"
              @click="setProductActive(product, false)"
            />
            <UButton
              v-else
              icon="i-lucide-eye"
              size="xs"
              color="success"
              variant="ghost"
              @click="setProductActive(product, true)"
            />
          </div>
        </div>
        <p
          v-if="!products?.length"
          class="text-muted text-sm py-4"
        >
          ยังไม่มีสินค้า
        </p>
      </div>
    </UCard>

    <UModal
      v-model:open="categoryModalOpen"
      :title="editingCategory ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'"
    >
      <template #body>
        <form
          class="flex flex-col gap-4"
          @submit.prevent="submitCategory"
        >
          <UFormField label="ชื่อหมวดหมู่">
            <UInput
              v-model="categoryForm.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="ลำดับการแสดง">
            <UInputNumber
              v-model="categoryForm.sortOrder"
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
      v-model:open="productModalOpen"
      :title="editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'"
    >
      <template #body>
        <form
          class="flex flex-col gap-4"
          @submit.prevent="submitProduct"
        >
          <UFormField label="ชื่อสินค้า">
            <UInput
              v-model="productForm.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="ราคา (บาท)">
            <UInputNumber
              v-model="productForm.price"
              :min="0"
              :step="1"
              class="w-full"
            />
          </UFormField>
          <UFormField label="หมวดหมู่">
            <USelect
              v-model="productForm.categoryId"
              :items="categoryOptions"
              placeholder="เลือกหมวดหมู่"
              class="w-full"
            />
          </UFormField>
          <UFormField label="ลิงก์รูปภาพ (ถ้ามี)">
            <UInput
              v-model="productForm.imageUrl"
              placeholder="https://..."
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
  </UContainer>
</template>
