<template>
  <el-dialog v-model="state.show" title="AI 智能抠图" align-center width="650" @close="handleClose">
    <uploader v-if="!state.rawImage" :hold="true" :drag="true" :multiple="true" class="uploader" @load="handleUploaderLoad">
      <div class="uploader__box">
        <upload-filled style="width: 64px; height: 64px" />
        <div class="el-upload__text">拖入或选择一张图片，自动生成透明底抠图结果。</div>
      </div>
      <div class="el-upload__tip el-upload__text">
        <em>当前版本优先使用通用 AI 抠图，可处理人物、商品、宠物和常见静物；失败时会自动切换到演示模式。</em>
      </div>
    </uploader>

    <el-progress v-if="!state.cutImage && state.progressText" :percentage="state.progress">
      <el-button text>{{ state.progressText }} <span v-show="state.progress">{{ state.progress }}%</span></el-button>
    </el-progress>

    <div v-if="state.providerTip" class="provider-tip">{{ state.providerTip }}</div>

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
        <el-button v-show="state.cutImage && state.toolModel" @click="clear">清除重选</el-button>
        <el-button v-show="state.cutImage" type="primary" plain @click="edit">进入编辑模式</el-button>
        <el-button v-show="state.cutImage && state.toolModel" type="primary" @click="download">下载 PNG</el-button>
        <el-button v-show="state.cutImage && !state.toolModel" v-loading="state.loading" type="primary" @click="cutDone">
          {{ state.loading ? '上传中...' : '完成抠图' }}
        </el-button>
      </span>
    </template>

    <ImageExtraction ref="matting" />
  </el-dialog>
</template>

<script lang="ts" setup>
import { nextTick, reactive, ref } from 'vue'
import { ElMessage, ElProgress } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import uploader from '@/components/common/Uploader/index.vue'
import _dl from '@/common/methods/download'
import ImageExtraction from '../ImageExtraction/index.vue'
import { selectImageFile, uploadCutPhotoToCloud } from './method.ts'
import { useControlStore } from '@/store'
import type { TImageCutoutState } from './types.ts'

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

const open = (file?: File) => {
  clear()
  state.loading = false
  state.show = true
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
    ElMessage.error('抠图失败，请稍后重试或更换图片')
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

.provider-tip {
  margin: 8px 0 12px;
  color: #92400e;
  font-size: 12px;
  line-height: 1.6;
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
