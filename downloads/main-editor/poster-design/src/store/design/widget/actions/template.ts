/*
 * @Author: Jeremy Yu
 * @Date: 2024-03-28 21:00:00
 * @Description:
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 09:29:35
 */


import { TWidgetStore, TdWidgetData } from '..'
import useCanvasStore from '../../canvas'
import useWidgetStore from '../../widget'
import { decodeTextIfNeeded, repairKnownMojibake } from '@/utils/decodeText'
import { assignStableLayerUuids, normalizeWidget } from './widget'

// TODO: 选择模板
export function setTemplate(store: TWidgetStore, allWidgets: TdWidgetData[]) {
  const canvasStore = useCanvasStore()
  const widgetStore = useWidgetStore()
  assignStableLayerUuids(allWidgets)
  store.dWidgets = []
  allWidgets.forEach((item) => {
    item.text && (item.text = decodeTextIfNeeded(item.text))
    item.name && (item.name = repairKnownMojibake(item.name))
    if (item.fontClass?.alias) {
      item.fontClass.alias = repairKnownMojibake(item.fontClass.alias)
    }
    store.dWidgets.push(normalizeWidget(item))
  })
  widgetStore.updateDWidgets()
  canvasStore.reChangeCanvas()
}
