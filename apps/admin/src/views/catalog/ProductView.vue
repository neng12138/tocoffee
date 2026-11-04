<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
  type UploadRequestOptions,
} from 'element-plus'
import { fetchCategories } from '../../api/categories'
import { getErrorMessage } from '../../api/errors'
import {
  createProduct,
  fetchProduct,
  fetchProducts,
  updateProduct,
  updateProductStatus,
} from '../../api/products'
import { fetchSpecGroups } from '../../api/specs'
import { uploadProductImage } from '../../api/uploads'
import { centsToYuan, formatCents, yuanToCents } from '../../utils/money'
import type {
  AdminCategory,
  AdminProduct,
  AdminSpecGroup,
  ProductStatus,
} from '../../types/catalog'

const products = ref<AdminProduct[]>([])
const categories = ref<AdminCategory[]>([])
const specGroups = ref<AdminSpecGroup[]>([])
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const dialogVisible = ref(false)
const detailLoading = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()

const filters = reactive({
  keyword: '',
  categoryId: '',
  status: '' as ProductStatus | '',
})

const form = reactive({
  name: '',
  categoryId: '',
  priceYuan: 18,
  description: '',
  imageUrl: '',
  tagsText: '',
  status: 'ON_SALE' as ProductStatus,
  sort: 0,
  specGroupIds: [] as string[],
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' },
    { max: 60, message: '商品名称最多 60 个字', trigger: 'blur' },
  ],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  priceYuan: [{ required: true, message: '请输入价格', trigger: 'blur' }],
}

const statusMeta: Record<ProductStatus, { label: string; type: 'success' | 'warning' | 'info' }> =
  {
    ON_SALE: { label: '在售', type: 'success' },
    SOLD_OUT: { label: '售罄', type: 'warning' },
    OFF_SHELF: { label: '已下架', type: 'info' },
  }

function asProduct(row: unknown): AdminProduct {
  return row as AdminProduct
}

function statusOf(row: unknown) {
  return statusMeta[asProduct(row).status]
}

async function loadProducts() {
  loading.value = true
  try {
    products.value = await fetchProducts({
      keyword: filters.keyword.trim() || undefined,
      categoryId: filters.categoryId || undefined,
      status: filters.status || undefined,
    })
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载商品失败'))
  } finally {
    loading.value = false
  }
}

async function loadAll() {
  try {
    const [categoryList, groupList] = await Promise.all([fetchCategories(), fetchSpecGroups()])
    categories.value = categoryList
    specGroups.value = groupList
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载分类或规格失败'))
  }
  await loadProducts()
}

function resetFilters() {
  filters.keyword = ''
  filters.categoryId = ''
  filters.status = ''
  loadProducts()
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.categoryId = categories.value.find((item) => item.status === 'ACTIVE')?.id ?? ''
  form.priceYuan = 18
  form.description = ''
  form.imageUrl = ''
  form.tagsText = ''
  form.status = 'ON_SALE'
  form.sort = 0
  form.specGroupIds = []
  formRef.value?.clearValidate()
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

async function openEdit(row: AdminProduct) {
  dialogVisible.value = true
  detailLoading.value = true
  try {
    const detail = await fetchProduct(row.id)
    editingId.value = detail.id
    form.name = detail.name
    form.categoryId = detail.categoryId
    form.priceYuan = centsToYuan(detail.basePriceCents)
    form.description = detail.description ?? ''
    form.imageUrl = detail.imageUrl ?? ''
    form.tagsText = detail.tags.join('，')
    form.status = detail.status
    form.sort = detail.sort
    form.specGroupIds = detail.specGroupIds
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '读取商品详情失败'))
    dialogVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

async function save() {
  const valid = formRef.value
    ? await formRef.value.validate().catch(() => false)
    : false
  if (!valid) {
    return
  }

  const basePriceCents = yuanToCents(form.priceYuan)
  if (!Number.isFinite(basePriceCents) || basePriceCents <= 0) {
    ElMessage.error('价格必须大于 0')
    return
  }

  const tags = form.tagsText
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)

  if (tags.length > 10) {
    ElMessage.error('标签最多 10 个')
    return
  }

  const payload = {
    name: form.name.trim(),
    categoryId: form.categoryId,
    basePriceCents,
    description: form.description.trim() || null,
    imageUrl: form.imageUrl || null,
    tags,
    status: form.status,
    sort: form.sort,
    specGroupIds: form.specGroupIds,
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateProduct(editingId.value, payload)
      ElMessage.success('商品已更新')
    } else {
      await createProduct(payload)
      ElMessage.success('商品已创建')
    }
    dialogVisible.value = false
    await loadProducts()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '保存商品失败'))
  } finally {
    saving.value = false
  }
}

function beforeUpload(file: File): boolean {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    ElMessage.error('仅支持 jpg/png/webp 图片')
    return false
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('图片不能超过 2MB')
    return false
  }
  return true
}

async function uploadImage(options: UploadRequestOptions) {
  uploading.value = true
  try {
    form.imageUrl = await uploadProductImage(options.file)
    options.onSuccess?.(form.imageUrl)
    ElMessage.success('图片已上传')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '图片上传失败'))
    options.onError?.(error as never)
  } finally {
    uploading.value = false
  }
}

async function changeStatus(row: AdminProduct, status: ProductStatus) {
  const action = statusMeta[status].label
  try {
    await updateProductStatus(row.id, status)
    ElMessage.success(`已${action}`)
    await loadProducts()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, `操作失败，无法${action}`))
  }
}

async function archive(row: AdminProduct) {
  try {
    await ElMessageBox.confirm(
      `下架「${row.name}」后，顾客端将不再展示该商品。`,
      '下架商品',
      { type: 'warning', confirmButtonText: '下架', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await updateProductStatus(row.id, 'OFF_SHELF')
    ElMessage.success('商品已下架')
    await loadProducts()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '下架商品失败'))
  }
}

onMounted(loadAll)
</script>

<template>
  <el-card shadow="never" class="page-card">
    <template #header>
      <div class="page-card-header">
        <div>
          <h2>商品管理</h2>
          <p class="muted">维护商品、价格、图片和规格组合；售罄商品会保留在顾客端并置灰。</p>
        </div>
        <el-button type="primary" @click="openCreate">新建商品</el-button>
      </div>
    </template>

    <div class="toolbar">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索商品名称"
        clearable
        class="toolbar-search"
        @keyup.enter="loadProducts"
        @clear="loadProducts"
      />
      <el-select v-model="filters.categoryId" placeholder="全部分类" clearable @change="loadProducts">
        <el-option
          v-for="category in categories"
          :key="category.id"
          :label="category.name"
          :value="category.id"
        />
      </el-select>
      <el-select v-model="filters.status" placeholder="全部状态" clearable @change="loadProducts">
        <el-option label="在售" value="ON_SALE" />
        <el-option label="售罄" value="SOLD_OUT" />
        <el-option label="已下架" value="OFF_SHELF" />
      </el-select>
      <el-button type="primary" plain @click="loadProducts">查询</el-button>
      <el-button link @click="resetFilters">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="products" row-key="id" stripe>
      <el-table-column label="商品" min-width="240">
        <template #default="{ row }">
          <div class="product-cell">
            <el-image
              v-if="row.imageUrl"
              :src="row.imageUrl"
              fit="cover"
              class="product-thumb"
            >
              <template #error>
                <div class="thumb-fallback">TC</div>
              </template>
            </el-image>
            <div v-else class="product-thumb thumb-fallback">TC</div>
            <div class="product-meta">
              <strong>{{ row.name }}</strong>
              <span class="muted">{{ row.category.name }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="价格" width="110">
        <template #default="{ row }">{{ formatCents(row.basePriceCents) }}</template>
      </el-table-column>
      <el-table-column label="规格" min-width="150">
        <template #default="{ row }">
          <span v-if="!row.specGroups.length" class="muted">无</span>
          <el-tag
            v-for="group in row.specGroups"
            :key="group.id"
            size="small"
            effect="plain"
            class="tag-gap"
          >
            {{ group.name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusOf(row).type" effect="plain">
            {{ statusOf(row).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(asProduct(row))">编辑</el-button>
          <el-button
            v-if="row.status !== 'ON_SALE'"
            link
            type="success"
            @click="changeStatus(asProduct(row), 'ON_SALE')"
          >
            上架
          </el-button>
          <el-button
            v-if="row.status === 'ON_SALE'"
            link
            type="warning"
            @click="changeStatus(asProduct(row), 'SOLD_OUT')"
          >
            沽清
          </el-button>
          <el-button
            v-if="row.status !== 'OFF_SHELF'"
            link
            type="danger"
            @click="archive(asProduct(row))"
          >
            下架
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑商品' : '新建商品'"
      width="760px"
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        v-loading="detailLoading"
        :model="form"
        :rules="rules"
        label-width="92px"
      >
        <div class="form-grid">
          <el-form-item label="商品名称" prop="name" class="form-span-2">
            <el-input v-model="form.name" maxlength="60" show-word-limit />
          </el-form-item>

          <el-form-item label="分类" prop="categoryId">
            <el-select v-model="form.categoryId" style="width: 100%">
              <el-option
                v-for="category in categories.filter((item) => item.status === 'ACTIVE')"
                :key="category.id"
                :label="category.name"
                :value="category.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="价格（元）" prop="priceYuan">
            <el-input-number
              v-model="form.priceYuan"
              :min="0.01"
              :max="9999"
              :precision="2"
              :step="1"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="状态">
            <el-select v-model="form.status" style="width: 100%">
              <el-option label="在售" value="ON_SALE" />
              <el-option label="售罄" value="SOLD_OUT" />
              <el-option label="下架" value="OFF_SHELF" />
            </el-select>
          </el-form-item>

          <el-form-item label="排序">
            <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
          </el-form-item>

          <el-form-item label="商品图片" class="form-span-2">
            <div class="image-row">
              <div class="image-preview">
                <el-image v-if="form.imageUrl" :src="form.imageUrl" fit="cover" class="image-preview-img">
                  <template #error>
                    <div class="thumb-fallback">TC</div>
                  </template>
                </el-image>
                <div v-else class="thumb-fallback image-preview-img">TC</div>
              </div>
              <div class="image-actions">
                <el-upload
                  :show-file-list="false"
                  accept="image/png,image/jpeg,image/webp"
                  :before-upload="beforeUpload"
                  :http-request="uploadImage"
                >
                  <el-button :loading="uploading">上传图片</el-button>
                </el-upload>
                <el-button v-if="form.imageUrl" link type="danger" @click="form.imageUrl = ''">
                  移除
                </el-button>
                <span class="muted">jpg/png/webp，≤2MB，建议正方形</span>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="标签" class="form-span-2">
            <el-input v-model="form.tagsText" placeholder="用逗号分隔，例如：招牌，热销" />
          </el-form-item>

          <el-form-item label="描述" class="form-span-2">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="3"
              maxlength="300"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="规格组" class="form-span-2">
            <el-checkbox-group v-model="form.specGroupIds">
              <el-checkbox
                v-for="group in specGroups"
                :key="group.id"
                :value="group.id"
                border
                class="spec-checkbox"
              >
                {{ group.name }}
                <span class="muted">（{{ group.options.length }} 项）</span>
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.product-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.product-thumb {
  width: 48px;
  height: 48px;
  flex: none;
  border-radius: 8px;
}

.thumb-fallback {
  display: grid;
  width: 100%;
  height: 100%;
  color: var(--tc-muted);
  font-weight: 700;
  background: var(--tc-bg);
  border: 1px solid var(--tc-border);
  border-radius: 8px;
  place-items: center;
}

.product-meta {
  display: grid;
  gap: 4px;
}

.product-meta .muted {
  font-size: 12px;
}

.tag-gap {
  margin: 0 4px 4px 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 20px;
}

.form-span-2 {
  grid-column: span 2;
}

.image-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.image-preview {
  width: 96px;
  height: 96px;
  flex: none;
}

.image-preview-img {
  width: 96px;
  height: 96px;
  border-radius: 10px;
}

.image-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.image-actions .muted {
  font-size: 12px;
}

.spec-checkbox {
  margin: 0 8px 8px 0;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-span-2 {
    grid-column: span 1;
  }
}
</style>
