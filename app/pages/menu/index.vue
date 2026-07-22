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

interface Ingredient {
  id: number
  name: string
  unit: string
  costPerUnit: number
}

interface RecipeRow {
  id: number
  productId: number
  ingredientId: number
  quantity: number
  ingredient: Ingredient
}

interface OptionChoice {
  id: number
  optionGroupId: number
  name: string
  priceDelta: number
}

interface OptionGroupRow {
  id: number
  productId: number
  name: string
  isRequired: boolean
  choices: OptionChoice[]
}

const toast = useToast()

const { data: categories, refresh: refreshCategories } = await useFetch<Category[]>('/api/categories')
const { data: products, refresh: refreshProducts } = await useFetch<Product[]>('/api/products')
const { data: ingredients, refresh: refreshIngredients } = await useFetch<Ingredient[]>('/api/ingredients')

const categoryOptions = computed(() => (categories.value ?? []).map(c => ({ label: c.name, value: c.id })))
const ingredientOptions = computed(() => (ingredients.value ?? []).map(i => ({ label: `${i.name} (${i.unit})`, value: i.id })))

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
const productSubmitting = ref(false)
const productImageFile = ref<File | null>(null)
const productForm = reactive<{ name: string, price: number, categoryId: number | null, imageUrl: string | null }>({
  name: '',
  price: 0,
  categoryId: null,
  imageUrl: null
})

function openNewProduct() {
  editingProduct.value = null
  productForm.name = ''
  productForm.price = 0
  productForm.categoryId = categories.value?.[0]?.id ?? null
  productForm.imageUrl = null
  productImageFile.value = null
  productModalOpen.value = true
}

function openEditProduct(product: Product) {
  editingProduct.value = product
  productForm.name = product.name
  productForm.price = product.price
  productForm.categoryId = product.categoryId
  productForm.imageUrl = product.imageUrl
  productImageFile.value = null
  productModalOpen.value = true
}

function clearProductImage() {
  productForm.imageUrl = null
  productImageFile.value = null
}

async function submitProduct() {
  productSubmitting.value = true
  try {
    const imageUrl = productImageFile.value ? await uploadImage(productImageFile.value) : productForm.imageUrl
    const body = {
      name: productForm.name,
      price: productForm.price,
      categoryId: productForm.categoryId,
      imageUrl
    }
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
  } finally {
    productSubmitting.value = false
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

// ---------- Recipe (product ingredients) ----------

const recipeModalOpen = ref(false)
const recipeProduct = ref<Product | null>(null)
const recipeRows = ref<RecipeRow[]>([])
const newRecipeIngredientId = ref<number | null>(null)
const newRecipeQuantity = ref(0)

async function openRecipeModal(product: Product) {
  recipeProduct.value = product
  newRecipeIngredientId.value = null
  newRecipeQuantity.value = 0
  recipeModalOpen.value = true
  recipeRows.value = await $fetch<RecipeRow[]>(`/api/products/${product.id}/ingredients`)
}

async function addRecipeRow() {
  if (!recipeProduct.value || !newRecipeIngredientId.value || newRecipeQuantity.value <= 0) {
    toast.add({ title: 'กรุณาเลือกวัตถุดิบและกรอกปริมาณ', color: 'error' })
    return
  }
  try {
    await $fetch(`/api/products/${recipeProduct.value.id}/ingredients`, {
      method: 'POST',
      body: { ingredientId: newRecipeIngredientId.value, quantity: newRecipeQuantity.value }
    })
    recipeRows.value = await $fetch<RecipeRow[]>(`/api/products/${recipeProduct.value.id}/ingredients`)
    newRecipeIngredientId.value = null
    newRecipeQuantity.value = 0
    toast.add({ title: 'เพิ่มวัตถุดิบในสูตรสำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'เพิ่มไม่สำเร็จ', color: 'error' })
  }
}

async function deleteRecipeRow(row: RecipeRow) {
  if (!recipeProduct.value) return
  try {
    await $fetch(`/api/products/${recipeProduct.value.id}/ingredients/${row.id}`, { method: 'DELETE' })
    recipeRows.value = recipeRows.value.filter(r => r.id !== row.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'ลบไม่สำเร็จ', color: 'error' })
  }
}

// ---------- Quick-create a new ingredient (from the recipe modal) ----------

const newIngredientModalOpen = ref(false)
const newIngredientForm = reactive({ name: '', unit: '', costPerUnit: 0 })

function openNewIngredient() {
  newIngredientForm.name = ''
  newIngredientForm.unit = ''
  newIngredientForm.costPerUnit = 0
  newIngredientModalOpen.value = true
}

async function submitNewIngredient() {
  try {
    const created = await $fetch<Ingredient>('/api/ingredients', { method: 'POST', body: newIngredientForm })
    await refreshIngredients()
    newRecipeIngredientId.value = created.id
    newIngredientModalOpen.value = false
    toast.add({ title: 'เพิ่มวัตถุดิบสำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'เพิ่มไม่สำเร็จ', color: 'error' })
  }
}

// ---------- Product options (option groups + choices) ----------

const optionsModalOpen = ref(false)
const optionsProduct = ref<Product | null>(null)
const optionGroupRows = ref<OptionGroupRow[]>([])
const newGroupName = ref('')
const newGroupRequired = ref(false)
const newChoiceName = reactive<Record<number, string>>({})
const newChoiceDelta = reactive<Record<number, number>>({})

async function openOptionsModal(product: Product) {
  optionsProduct.value = product
  newGroupName.value = ''
  newGroupRequired.value = false
  optionsModalOpen.value = true
  optionGroupRows.value = await $fetch<OptionGroupRow[]>(`/api/products/${product.id}/options`)
}

async function addOptionGroup() {
  if (!optionsProduct.value) return
  if (!newGroupName.value.trim()) {
    toast.add({ title: 'กรุณากรอกชื่อตัวเลือก', color: 'error' })
    return
  }
  try {
    await $fetch(`/api/products/${optionsProduct.value.id}/options`, {
      method: 'POST',
      body: { name: newGroupName.value, isRequired: newGroupRequired.value }
    })
    optionGroupRows.value = await $fetch<OptionGroupRow[]>(`/api/products/${optionsProduct.value.id}/options`)
    newGroupName.value = ''
    newGroupRequired.value = false
    toast.add({ title: 'เพิ่มตัวเลือกสำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'เพิ่มไม่สำเร็จ', color: 'error' })
  }
}

async function toggleGroupRequired(group: OptionGroupRow) {
  const isRequired = !group.isRequired
  try {
    await $fetch(`/api/option-groups/${group.id}`, { method: 'PATCH', body: { isRequired } })
    group.isRequired = isRequired
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'ทำรายการไม่สำเร็จ', color: 'error' })
  }
}

async function deleteOptionGroup(group: OptionGroupRow) {
  try {
    await $fetch(`/api/option-groups/${group.id}`, { method: 'DELETE' })
    optionGroupRows.value = optionGroupRows.value.filter(g => g.id !== group.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'ลบไม่สำเร็จ', color: 'error' })
  }
}

async function addChoice(group: OptionGroupRow) {
  const name = (newChoiceName[group.id] ?? '').trim()
  if (!name) {
    toast.add({ title: 'กรุณากรอกชื่อตัวเลือกย่อย', color: 'error' })
    return
  }
  try {
    const choice = await $fetch<OptionChoice>(`/api/option-groups/${group.id}/choices`, {
      method: 'POST',
      body: { name, priceDelta: newChoiceDelta[group.id] ?? 0 }
    })
    group.choices.push(choice)
    newChoiceName[group.id] = ''
    newChoiceDelta[group.id] = 0
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'เพิ่มไม่สำเร็จ', color: 'error' })
  }
}

async function deleteChoice(group: OptionGroupRow, choice: OptionChoice) {
  try {
    await $fetch(`/api/option-groups/${group.id}/choices/${choice.id}`, { method: 'DELETE' })
    group.choices = group.choices.filter(c => c.id !== choice.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'ลบไม่สำเร็จ', color: 'error' })
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
            size="lg"
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
          class="flex items-center justify-between py-3"
        >
          <span>{{ category.name }}</span>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-pencil"
              size="lg"
              color="neutral"
              variant="ghost"
              class="size-10"
              @click="openEditCategory(category)"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="lg"
              color="error"
              variant="ghost"
              class="size-10"
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
            size="lg"
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
          class="flex flex-wrap items-center justify-between py-3 gap-3"
        >
          <div class="flex items-center gap-3 min-w-0">
            <img
              v-if="product.imageUrl"
              :src="product.imageUrl"
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
              <p
                class="truncate"
                :class="{ 'text-muted line-through': !product.isActive }"
              >
                {{ product.name }}
              </p>
              <p class="text-sm text-muted mt-0.5">
                {{ product.category?.name ?? 'ไม่มีหมวดหมู่' }} · {{ product.price.toFixed(2) }} บาท
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <UBadge
              :color="product.isActive ? 'success' : 'neutral'"
              variant="subtle"
              class="mr-1"
            >
              {{ product.isActive ? 'ขายอยู่' : 'ปิดขาย' }}
            </UBadge>
            <UButton
              icon="i-lucide-flask-conical"
              size="lg"
              color="neutral"
              variant="ghost"
              class="size-10"
              title="สูตร/วัตถุดิบ"
              @click="openRecipeModal(product)"
            />
            <UButton
              icon="i-lucide-list-checks"
              size="lg"
              color="neutral"
              variant="ghost"
              class="size-10"
              title="ตัวเลือกสินค้า"
              @click="openOptionsModal(product)"
            />
            <UButton
              icon="i-lucide-pencil"
              size="lg"
              color="neutral"
              variant="ghost"
              class="size-10"
              @click="openEditProduct(product)"
            />
            <UButton
              v-if="product.isActive"
              icon="i-lucide-eye-off"
              size="lg"
              color="error"
              variant="ghost"
              class="size-10"
              @click="setProductActive(product, false)"
            />
            <UButton
              v-else
              icon="i-lucide-eye"
              size="lg"
              color="success"
              variant="ghost"
              class="size-10"
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
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="ลำดับการแสดง">
            <UInputNumber
              v-model="categoryForm.sortOrder"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            block
            size="lg"
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
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="ราคา (บาท)">
            <UInputNumber
              v-model="productForm.price"
              size="lg"
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
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="รูปภาพสินค้า (ไม่บังคับ, ระบบจะบีบอัดให้อัตโนมัติ)">
            <div class="flex items-center gap-3">
              <img
                v-if="productForm.imageUrl && !productImageFile"
                :src="productForm.imageUrl"
                class="size-16 rounded-lg object-cover shrink-0"
              >
              <UFileUpload
                v-model="productImageFile"
                accept="image/*"
                icon="i-lucide-image"
                label="แตะเพื่อเลือกรูป หรือวางไฟล์ที่นี่"
                size="lg"
                class="flex-1 min-w-0"
              />
              <UButton
                v-if="productForm.imageUrl || productImageFile"
                icon="i-lucide-x"
                size="lg"
                color="neutral"
                variant="ghost"
                class="size-10 shrink-0"
                title="ลบรูปภาพ"
                @click="clearProductImage"
              />
            </div>
          </UFormField>
          <UButton
            type="submit"
            block
            size="lg"
            :loading="productSubmitting"
          >
            บันทึก
          </UButton>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="recipeModalOpen"
      :title="recipeProduct ? `สูตร: ${recipeProduct.name}` : 'สูตร'"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col divide-y divide-default">
            <div
              v-for="row in recipeRows"
              :key="row.id"
              class="flex items-center justify-between py-2.5 gap-2"
            >
              <span>{{ row.ingredient.name }}</span>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-sm text-muted">{{ row.quantity }} {{ row.ingredient.unit }}</span>
                <UButton
                  icon="i-lucide-trash-2"
                  size="lg"
                  color="error"
                  variant="ghost"
                  class="size-10"
                  @click="deleteRecipeRow(row)"
                />
              </div>
            </div>
            <p
              v-if="!recipeRows.length"
              class="text-muted text-sm py-2"
            >
              ยังไม่มีวัตถุดิบในสูตรนี้
            </p>
          </div>

          <div class="flex flex-wrap items-end gap-2">
            <UFormField
              label="วัตถุดิบ"
              class="flex-1 min-w-40"
            >
              <USelect
                v-model="newRecipeIngredientId"
                :items="ingredientOptions"
                placeholder="เลือกวัตถุดิบ"
                size="lg"
                class="w-full"
              />
            </UFormField>
            <UFormField label="ปริมาณที่ใช้">
              <UInputNumber
                v-model="newRecipeQuantity"
                size="lg"
                :min="0"
                class="w-28"
              />
            </UFormField>
            <UButton
              icon="i-lucide-plus"
              size="lg"
              @click="addRecipeRow"
            >
              เพิ่ม
            </UButton>
          </div>
          <UButton
            variant="link"
            size="lg"
            class="self-start p-0"
            @click="openNewIngredient"
          >
            + เพิ่มวัตถุดิบใหม่ที่ยังไม่มีในระบบ
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="newIngredientModalOpen"
      title="เพิ่มวัตถุดิบใหม่"
    >
      <template #body>
        <form
          class="flex flex-col gap-4"
          @submit.prevent="submitNewIngredient"
        >
          <UFormField label="ชื่อวัตถุดิบ">
            <UInput
              v-model="newIngredientForm.name"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="หน่วยนับ (เช่น กรัม, มล., ถุง)">
            <UInput
              v-model="newIngredientForm.unit"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="ต้นทุนต่อหน่วย (บาท, ถ้าทราบ)">
            <UInputNumber
              v-model="newIngredientForm.costPerUnit"
              size="lg"
              :min="0"
              :step="0.5"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            block
            size="lg"
          >
            บันทึก
          </UButton>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="optionsModalOpen"
      :title="optionsProduct ? `ตัวเลือกสินค้า: ${optionsProduct.name}` : 'ตัวเลือกสินค้า'"
    >
      <template #body>
        <div class="flex flex-col gap-5">
          <div
            v-for="group in optionGroupRows"
            :key="group.id"
            class="flex flex-col gap-3 rounded-lg border border-default p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="font-medium truncate min-w-0">
                {{ group.name }}
              </p>
              <div class="flex items-center gap-3 shrink-0">
                <UCheckbox
                  :model-value="group.isRequired"
                  label="บังคับเลือก"
                  size="lg"
                  @update:model-value="toggleGroupRequired(group)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  size="lg"
                  color="error"
                  variant="ghost"
                  class="size-10"
                  @click="deleteOptionGroup(group)"
                />
              </div>
            </div>

            <div class="flex flex-col divide-y divide-default">
              <div
                v-for="choice in group.choices"
                :key="choice.id"
                class="flex items-center justify-between py-2 gap-2"
              >
                <span>{{ choice.name }}</span>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-sm text-muted">{{ choice.priceDelta >= 0 ? '+' : '' }}{{ choice.priceDelta.toFixed(2) }} บาท</span>
                  <UButton
                    icon="i-lucide-x"
                    size="lg"
                    color="error"
                    variant="ghost"
                    class="size-9"
                    @click="deleteChoice(group, choice)"
                  />
                </div>
              </div>
              <p
                v-if="!group.choices.length"
                class="text-muted text-sm py-1.5"
              >
                ยังไม่มีตัวเลือกย่อย
              </p>
            </div>

            <div class="flex flex-wrap items-end gap-2">
              <UFormField
                label="ตัวเลือกย่อย"
                class="flex-1 min-w-32"
              >
                <UInput
                  v-model="newChoiceName[group.id]"
                  placeholder="เช่น หวานน้อย"
                  size="lg"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="ราคาเพิ่ม (บาท)">
                <UInputNumber
                  v-model="newChoiceDelta[group.id]"
                  :step="1"
                  size="lg"
                  class="w-28"
                />
              </UFormField>
              <UButton
                icon="i-lucide-plus"
                size="lg"
                @click="addChoice(group)"
              >
                เพิ่ม
              </UButton>
            </div>
          </div>

          <p
            v-if="!optionGroupRows.length"
            class="text-muted text-sm"
          >
            สินค้านี้ยังไม่มีตัวเลือก (เช่น ความหวาน, ไซส์, ไข่มุก)
          </p>

          <div class="flex flex-wrap items-end gap-2 border-t border-default pt-4">
            <UFormField
              label="เพิ่มกลุ่มตัวเลือกใหม่"
              class="flex-1 min-w-40"
            >
              <UInput
                v-model="newGroupName"
                placeholder="เช่น ความหวาน, ไซส์"
                size="lg"
                class="w-full"
              />
            </UFormField>
            <UCheckbox
              v-model="newGroupRequired"
              label="บังคับเลือก"
              size="lg"
            />
            <UButton
              icon="i-lucide-plus"
              size="lg"
              @click="addOptionGroup"
            >
              เพิ่ม
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
