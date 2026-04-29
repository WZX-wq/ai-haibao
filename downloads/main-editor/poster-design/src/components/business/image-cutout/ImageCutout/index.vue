<template>
  <el-dialog v-model="state.show" :title="state.providerLabel" align-center width="650" @close="handleClose">
    <div class="provider-switch">
      <button
        type="button"
        class="provider-switch__item"
        :class="{ 'is-active': true }"
      >
        <span class="provider-switch__title">本地高质量抠图</span>
        <em class="provider-switch__meta">免费</em>
        <strong class="provider-switch__cost">免费</strong>
      </button>
    </div>

    <uploader v-if="!state.rawImage" :hold="true" :drag="true" :multiple="true" class="uploader" @load="handleUploaderLoad">
      <div class="uploader__box">
        <upload-filled style="width: 64px; height: 64px" />
        <div class="el-upload__text">拖入或选择一张图片，生成透明底抠图结果。</div>
      </div>
      <div class="el-upload__tip el-upload__text">
        <em>{{ providerDescription }}</em>
      </div>
    </uploader>

    <el-progress v-if="!state.cutImage && state.progressText" :percentage="state.progress">
      <el-button text>{{ state.progressText }} <span v-show="state.progress">{{ state.progress }}%</span></el-button>
    </el-progress>

    <div class="content">
      <div
        v-show="state.rawImage"
        v-loading="!state.cutImage"
        :style="{ width: state.offsetWidth ? `${state.offsetWidth}px` : '100%' }"
        class="scan-effect transparent-bg"
      >
        <img ref="raw" :style="{ 'clip-path': `inset(0 0 0 ${state.percent}%)` }" :src="state.rawImage" alt="" />
        <img v-show="state.cutImage" :src="state.cutImage" alt="抠图结果" @mousemove="mousemove" />
        <div v-show="state.cutImage" :style="{ left: `${state.percent}%` }" class="scan-line"></div>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button v-show="state.cutImage && state.toolModel" class="cutout-footer-btn" @click="clear">清除重选</el-button>
        <el-button v-show="state.cutImage" class="cutout-footer-btn cutout-footer-btn--soft" @click="edit">进入编辑模式</el-button>
        <el-button v-show="state.cutImage && state.toolModel" class="cutout-footer-btn cutout-footer-btn--primary" @click="download">下载 PNG</el-button>
        <el-button
          v-show="state.cutImage && !state.toolModel"
          v-loading="state.loading"
          class="cutout-footer-btn cutout-footer-btn--primary"
          @click="cutDone"
        >
          {{ state.loading ? '上传中...' : '完成抠图' }}
        </el-button>
      </span>
    </template>

    <ImageExtraction ref="matting" />
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage, ElProgress } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import uploader from '@/components/common/Uploader/index.vue'
import _dl from '@/common/methods/download'
import ImageExtraction from '../ImageExtraction/index.vue'
import { selectImageFile, uploadCutPhotoToCloud } from './method.ts'
import { useControlStore } from '@/store'
import type { TImageCutoutState } from './types.ts'
import { toFriendlyCutoutError } from '@/utils/friendlyError'
import type { CutoutProviderMode } from '@/api/ai'

const controlStore = useControlStore()
const state = reactive<TImageCutoutState>({
  show: false,
  rawImage: '',
  cutImage: '',
  offsetWidth: 0,
  percent: 0,
  progress: 0,
  progressText: '',
  toolModel: true,
  loading: false,
  providerTip: '',
  providerLabel: '本地高质量抠图',
  providerMode: 'local',
})

let fileName = 'cutout.png'
let isRunning = false

const buildDownloadFileName = (name: string, resultUrl: string) => {
  const cleanName = name || 'cutout'
  const baseName = cleanName.replace(/\.[^.]+$/, '')
  const safeUrl = typeof resultUrl === 'string' ? resultUrl : ''
  const match = safeUrl.match(/\.([a-zA-Z0-9]+)(?:$|\?)/)
  const suffix = (match?.[1] || 'png').toLowerCase()
  return `${baseName}.${suffix}`
}

const emits = defineEmits<{
  (event: 'done', data: string): void
}>()

const raw = ref<HTMLElement | null>(null)
const matting = ref<typeof ImageExtraction | null>(null)

const providerDescription = computed(() => '使用本地高质量抠图模型执行抠图，不收费，适合稳定处理商品、物体与常见主体。')

function syncProviderUi() {
  state.providerMode = 'local'
  state.providerLabel = '本地高质量抠图'
}

function setProviderMode(mode: CutoutProviderMode) {
  state.providerMode = 'local'
  syncProviderUi()
}

const open = (mode: CutoutProviderMode = 'local', file?: File) => {
  clear()
  state.loading = false
  state.show = true
  state.providerMode = 'local'
  syncProviderUi()
  controlStore.setShowMoveable(false)
  nextTick(() => {
    if (file) {
      state.toolModel = false
      handleUploaderLoad(file)
    } else {
      state.toolModel = true
    }
  })
}

defineExpose({ open })

const handleUploaderLoad = async (file: File) => {
  try {
    await selectImageFile(state, raw, file, (resultUrl, name, providerTip) => {
      if (!resultUrl || typeof resultUrl !== 'string') {
        throw new Error('AI 返回结果异常，请重试')
      }
      fileName = buildDownloadFileName(name, resultUrl)
      state.cutImage = resultUrl
      state.providerTip = providerTip
      if (state.rawImage) {
        requestAnimationFrame(run)
      }
    })
  } catch (error) {
    console.error(error)
    ElMessage.error(toFriendlyCutoutError(error))
    clear()
  }
}

const handleClose = () => {
  controlStore.setShowMoveable(true)
}

const mousemove = (e: MouseEvent) => {
  if (!isRunning) {
    state.percent = (e.offsetX / (e.target as HTMLImageElement).width) * 100
  }
}

const download = () => {
  _dl.downloadBase64File(state.cutImage, fileName)
}

const clear = () => {
  if (state.rawImage.startsWith('blob:')) {
    URL.revokeObjectURL(state.rawImage)
  }
  state.rawImage = ''
  state.cutImage = ''
  state.percent = 0
  state.offsetWidth = 0
  state.progress = 0
  state.progressText = ''
  state.providerTip = ''
  syncProviderUi()
}

const run = () => {
  state.percent += 1
  isRunning = true
  if (state.percent < 100) {
    requestAnimationFrame(run)
  } else {
    isRunning = false
  }
}

const cutDone = async () => {
  state.loading = true
  const url = await uploadCutPhotoToCloud(state.cutImage)
  state.loading = false
  if (!url) {
    ElMessage.error('抠图结果上传失败')
    return
  }
  emits('done', url)
  state.show = false
  handleClose()
  ElMessage.success('抠图结果已加入资源库')
}

const edit = () => {
  if (!matting.value) return
  matting.value.open(state.rawImage, state.cutImage, (base64: string) => {
    state.cutImage = base64
    state.percent = 0
    requestAnimationFrame(run)
  })
}
</script>

<style lang="less" scoped>
.uploader {
  &__box {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    color: #333333;
  }
}

.provider-switch {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.provider-switch__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  position: relative;
  min-height: 86px;
  padding: 14px 16px;
  border: 1px solid #d7e4f5;
  border-radius: 12px;
  background: linear-gradient(180deg, #fafdff 0%, #eff5fd 100%);
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;

  &.is-active {
    border-color: #4c7fd8;
    background: linear-gradient(180deg, #edf4ff 0%, #dfeeff 100%);
    box-shadow: 0 10px 22px rgba(73, 114, 190, 0.12);
  }
}

.provider-switch__title {
  display: block;
  padding-right: 76px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  color: #183b63;
}

.provider-switch__meta {
  display: block;
  margin-top: 6px;
  padding-right: 18px;
  font-size: 12px;
  line-height: 1.45;
  color: #5d728a;
  font-style: normal;
}

.provider-switch__cost {
  position: absolute;
  top: 14px;
  right: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #335985;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.dialog-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
}

.dialog-footer :deep(.el-button + .el-button) {
  margin-left: 0;
}

.cutout-footer-btn {
  min-width: 120px;
  height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  border-color: #d8e6f7;
  background: #ffffff;
  color: #35506f;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 6px 16px rgba(63, 114, 194, 0.06);
}

.cutout-footer-btn:hover,
.cutout-footer-btn:focus {
  border-color: #96bdea;
  color: #204b85;
  background: #f8fbff;
}

.cutout-footer-btn--soft {
  border-color: #cfe1f6;
  background: #f3f8ff;
  color: #24589f;
}

.cutout-footer-btn--primary {
  border-color: #4d86d4;
  background: linear-gradient(180deg, #5f9be3 0%, #4a84cf 100%);
  color: #ffffff;
}

.cutout-footer-btn--primary:hover,
.cutout-footer-btn--primary:focus {
  border-color: #4478be;
  background: linear-gradient(180deg, #6aa6ec 0%, #4c87d2 100%);
  color: #ffffff;
}

.content {
  position: relative;
  display: flex;
  justify-content: center;
}

.scan-effect {
  position: relative;
  height: 50vh;
  overflow: hidden;

  img {
    position: absolute;
    height: 100%;
    object-fit: contain;
  }
}

.scan-line {
  position: absolute;
  top: 0;
  width: 1.5px;
  height: 100%;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
}
</style>
