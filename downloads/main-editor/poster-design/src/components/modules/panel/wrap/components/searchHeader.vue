<template>
  <div class="search__wrap">
    <el-dropdown v-if="type !== 'none'" placement="bottom-start">
      <div class="search__type"><i class="iconfont icon-ego-caidan" /></div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="item in state.materialCates"
            :key="item.id"
            @click="action('change', item, item.id)"
          >
            <span :class="['cate__text', { 'cate--select': +state.currentIndex === +item.id }]">{{ item.name }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <span v-else style="width: 1rem"></span>

    <el-input v-model="state.searchValue" size="large" placeholder="输入关键词搜索" class="input-with-select">
      <template #append>
        <el-button><i class="iconfont icon-search"></i></el-button>
      </template>
    </el-input>
  </div>
</template>

<script lang="ts" setup>
import { reactive, watch } from 'vue'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'
import { useRoute } from 'vue-router'
import api from '@/api'
import useNotification from '@/common/methods/notification'

type TProps = {
  type?: string
  modelValue?: string
}

type TMaterialCatesData = { id: string | number; name: string }

type TEmits = {
  (event: 'update:modelValue', data: string): void
  (event: 'change', data: TMaterialCatesData): void
}

type TState = {
  searchValue: string
  materialCates: TMaterialCatesData[]
  currentIndex: number | string
}

const props = defineProps<TProps>()
const emit = defineEmits<TEmits>()
const route = useRoute()

const state = reactive<TState>({
  searchValue: '',
  materialCates: [],
  currentIndex: 0,
})
let categoryLoadNotified = false

if (props.type !== 'none') {
  api.home
    .getCategories({ type: 1 })
    .then((list: any[]) => {
      state.materialCates = [{ id: 0, name: '全部' }].concat(list || [])
      const cate = route.query.cate
      if (typeof cate !== 'undefined') {
        state.currentIndex = cate as string
        const current = state.materialCates.find((item) => String(item.id) === String(cate))
        current && action('change', current, current.id)
      }
    })
    .catch(() => {
      state.materialCates = [{ id: 0, name: '全部' }]
      if (!categoryLoadNotified) {
        categoryLoadNotified = true
        useNotification('分类暂时不可用', '分类暂时无法显示，请稍后刷新页面。', { type: 'warning' })
      }
    })
}

watch(
  () => state.searchValue,
  () => emit('update:modelValue', state.searchValue),
)

function action(fn: 'change', type: TMaterialCatesData, currentIndex: number | string) {
  state.currentIndex = currentIndex
  emit(fn, type)
}

defineExpose({
  action,
})
</script>

<style lang="less" scoped>
:deep(.el-input__suffix) {
  padding-top: 9px;
}

.search__wrap {
  padding: 16px 1rem 0 0;
  display: flex;
  cursor: pointer;
}

.search {
  &__type {
    border: 1px solid #e8eaec;
    color: #666666;
    width: 44px;
    margin: 0 0.6rem 0 1rem;
    border-radius: 4px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 14px;

    .iconfont {
      font-size: 20px;
    }
  }

  &__type:hover {
    color: @active-text-color;
  }
}

.cate {
  &__text {
    font-weight: bold;
  }

  &--select {
    color: @main-color;
  }
}
</style>
