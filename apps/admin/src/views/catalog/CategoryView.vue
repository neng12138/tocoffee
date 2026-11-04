<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { archiveCategory, createCategory, fetchCategories, updateCategory } from '../../api/categories'
import { getErrorMessage } from '../../api/errors'
import type { AdminCategory, CategoryStatus } from '../../types/catalog'

const categories = ref<AdminCategory[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()

const form = reactive({
  name: '',
  sort: 0,
  status: 'ACTIVE' as CategoryStatus,
})

function asCategory(row: unknown): AdminCategory {
  return row as AdminCategory
}

const rules: FormRules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { max: 30, message: '分类名称最多 30 个字', trigger: 'blur' },
  ],
}

async function load() {
  loading.value = true
  try {
    categories.value = await fetchCategories()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载分类失败'))
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.sort = 0
  form.status = 'ACTIVE'
  formRef.value?.clearValidate()
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: AdminCategory) {
  editingId.value = row.id
  form.name = row.name
  form.sort = row.sort
  form.status = row.status
  dialogVisible.value = true
}

async function save() {
  const valid = formRef.value
    ? await formRef.value.validate().catch(() => false)
    : false
  if (!valid) {
    return
  }

  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      sort: form.sort,
      status: form.status,
    }

    if (editingId.value) {
      await updateCategory(editingId.value, payload)
      ElMessage.success('分类已更新')
    } else {
      await createCategory(payload)
      ElMessage.success('分类已创建')
    }

    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '保存分类失败'))
  } finally {
    saving.value = false
  }
}

async function archive(row: AdminCategory) {
  try {
    await ElMessageBox.confirm(
      `归档「${row.name}」后，顾客端将不再展示该分类下的商品。`,
      '归档分类',
      { type: 'warning', confirmButtonText: '归档', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await archiveCategory(row.id)
    ElMessage.success('分类已归档')
    await load()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '归档分类失败'))
  }
}

onMounted(load)
</script>

<template>
  <el-card shadow="never" class="page-card">
    <template #header>
      <div class="page-card-header">
        <div>
          <h2>分类管理</h2>
          <p class="muted">分类用于顾客端菜单分组，归档不会物理删除。</p>
        </div>
        <el-button type="primary" @click="openCreate">新建分类</el-button>
      </div>
    </template>

    <el-table v-loading="loading" :data="categories" row-key="id" stripe>
      <el-table-column prop="name" label="分类名称" min-width="180" />
      <el-table-column prop="sort" label="排序" width="90" />
      <el-table-column label="商品数" width="100">
        <template #default="{ row }">{{ row.productCount }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" effect="plain">
            {{ row.status === 'ACTIVE' ? '启用' : '已归档' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(asCategory(row))">编辑</el-button>
          <el-button
            v-if="row.status === 'ACTIVE'"
            link
            type="danger"
            @click="archive(asCategory(row))"
          >
            归档
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑分类' : '新建分类'"
      width="460px"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="86px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" maxlength="30" show-word-limit />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
