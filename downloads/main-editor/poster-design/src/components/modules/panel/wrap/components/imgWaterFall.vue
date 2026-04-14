<template>
  <div ref="imgWaterFall" :style="{ height: state.countHeight + 'px' }" class="img-water-fall">
    <div
      v-for="(item, i) in state.list"
      :key="`t-${item.id}`"
      :data-template-id="item.id"
      :style="{ top: `${item.top}px`, left: `${item.left}px`, width: `${state.width}px`, height: `${item.height}px` }"
      :class="['img-box', { 'img-box--active': isActiveItem(item) }]"
      @click.stop="selectItem(item)"
    >
      <edit-model v-if="edit" :options="props.edit" :data="{ item, i }">
        <div v-if="item.isDelect" class="list__mask">已删除</div>
        <img
          v-if="!item.fail"
          class="img"
          :src="getCardImage(item)"
          alt="template-cover"
          loading="eager"
          decoding="async"
          @error="loadError(item, i, $event)"
          @load="loadSuccess(item, i, $event)"
        />
        <div v-else class="fail_img">{{ item.title || '模板' }}</div>
      </edit-model>

      <img
        v-else
        class="img"
        :src="getCardImage(item)"
        alt="template-cover"
        loading="eager"
        decoding="async"
        @error="loadError(item, i, $event)"
        @load="loadSuccess(item, i, $event)"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { reactive, watch } from 'vue'
import { IGetTempListData } from '@/api/home'
import { normalizeLoopbackMediaUrl } from '@/utils/publicMediaUrl'

type TProps = {
  listData: IGetTempListData[]
  /** 与路由 tempid 对齐，用于高亮当前打开的模板 */
  activeTempId?: number | null
  edit?: Record<string, any>
}

type TState = {
  width: number
  countHeight: number
  list: IGetTempListData[]
}

type TEmits = {
  (event: 'select', data: IGetTempListData): void
  (event: 'load'): void
}

const props = withDefaults(defineProps<TProps>(), {
  activeTempId: null,
})
const emit = defineEmits<TEmits>()

const isActiveItem = (item: IGetTempListData) => {
  if (props.activeTempId == null) return false
  return Number(item.id) === Number(props.activeTempId)
}

const state = reactive<TState>({
  width: 146,
  list: [],
  countHeight: 0,
})

const columnHeights: number[] = []
const columnNums = 2
const gap = 7
const rebuildingCoverIds = new Set<string>()

watch(
  () => props.listData,
  () => {
    columnHeights.length = 0
    const widthLimit = state.width * columnNums
    const cloneList = JSON.parse(JSON.stringify(props.listData || []))

    for (let i = 0; i < cloneList.length; i += 1) {
      let index = i % columnNums
      const item = cloneList[i]
      const width = Number(item.width) || 1
      const height = Number(item.height) || 1
      item.height = (height / width) * state.width
      item.left = index * (widthLimit / columnNums + gap)
      item.top = columnHeights[index] + gap || 0
      if (isNaN(columnHeights[index])) {
        columnHeights[index] = item.height
      } else {
        index = columnHeights.indexOf(Math.min(...columnHeights))
        item.left = index * (widthLimit / columnNums + gap)
        item.top = columnHeights[index] + gap || 0
        columnHeights[index] += item.height + gap
      }
    }

    state.countHeight = columnHeights.length ? Math.max(...columnHeights) : 0
    state.list = cloneList
  },
  { immediate: true },
)

const normalizeLocalHost = (value?: string) => {
  const src = value || ''
  if (!src) return src
  const host = window.location.hostname
  if (host === 'localhost') return src.replace('://127.0.0.1:', '://localhost:')
  if (host === '127.0.0.1') return src.replace('://localhost:', '://127.0.0.1:')
  return src
}

/**
 * 不可把截图 URL 强行改成 292×390：Draw 页画布按模板真实像素（如 1242×1660）渲染，
 * 视口若更小只会截到左上角 → 侧栏出现「巨大文字碎片」。服务端已用视口截图（非 fullPage），
 * 此处必须保留 URL 中的 width/height 与模板一致。
 */
const getCardImage = (item: IGetTempListData) => {
  const raw = item.thumb || item.cover || item.url || ''
  const normalized = normalizeLoopbackMediaUrl(normalizeLocalHost(raw))
  return normalized || '/template-cover-1.png'
}

const getFallbackByIndex = (index: number) => (index % 2 === 0 ? '/template-cover-1.png' : '/template-cover-2.png')

const load = () => emit('load')
const selectItem = (value: IGetTempListData) => emit('select', value)

const tryRebuildCover = async (item: IGetTempListData) => {
  const id = String(item?.id || '').trim()
  if (!id || rebuildingCoverIds.has(id)) return false
  rebuildingCoverIds.add(id)
  try {
    const width = Math.max(1, Number(item.width) || 1242)
    const height = Math.max(1, Number(item.height) || 1660)
    const forceUrl = `/api/screenshots?tempid=${encodeURIComponent(id)}&tempType=0&width=${width}&height=${height}&type=file&index=0&force=1&r=${Date.now()}`
    await fetch(forceUrl, { method: 'GET', credentials: 'include' })
    const rebuilt = `${forceUrl}&retry=1`
    item.cover = rebuilt
    item.thumb = rebuilt
    item.fail = false
    return true
  } catch {
    return false
  } finally {
    rebuildingCoverIds.delete(id)
  }
}

const loadError = (item: IGetTempListData, index: number, event?: Event) => {
  const target = event?.target as HTMLImageElement | null
  if (item.thumb && item.cover && item.thumb !== item.cover) {
    item.thumb = ''
    item.fail = false
    if (target) target.src = getCardImage(item)
    return
  }
  if (item.cover && item.url && item.cover !== item.url) {
    item.cover = item.url
    item.fail = false
    if (target) target.src = getCardImage(item)
    return
  }
  if (target) {
    tryRebuildCover(item).then((ok) => {
      if (ok) {
        target.src = getCardImage(item)
        return
      }
      target.src = getFallbackByIndex(index)
      item.fail = false
    })
    return
  }
  item.fail = true
}

const loadSuccess = (item: IGetTempListData, index: number, event?: Event) => {
  const target = event?.target as HTMLImageElement | null
  // 后端截图异常时会返回同一张占位图（典型尺寸 292x1130），这里做兜底替换
  if (target && target.naturalWidth > 0 && target.naturalHeight > target.naturalWidth * 3) {
    tryRebuildCover(item).then((ok) => {
      if (ok) {
        target.src = getCardImage(item)
        return
      }
      target.src = getFallbackByIndex(index)
      item.fail = false
    })
    return
  }
  item.fail = false
}

defineExpose({
  load,
  selectItem,
  loadError,
})
</script>

<style lang="less" scoped>
.fail_img {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999999;
}

.img-water-fall {
  position: relative;
  margin-left: 14px;

  .img-box {
    position: absolute !important;
    cursor: pointer;
    background-size: cover;
    border-radius: 5px;
    border: 1px solid #e0e5ea;
    overflow: hidden;

    .img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #f1f5f9;
    }
  }

  .img-box:hover::before {
    content: ' ';
    background: rgba(0, 0, 0, 0.15);
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }

  .img-box--active {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.25);
    z-index: 2;
  }
}

.list {
  &__mask {
    position: absolute;
    z-index: 2;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
