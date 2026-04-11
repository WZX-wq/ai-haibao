/*
 * @Author: Jeremy Yu
 * @Date: 2024-03-28 21:00:00
 * @Description:
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 09:29:35
 */


import { customAlphabet } from 'nanoid/non-secure'
import { TWidgetStore, TdWidgetData } from '..'
import useCanvasStore from '../../canvas'
import useWidgetStore from '../../widget'
import { decodeTextIfNeeded, repairKnownMojibake } from '@/utils/decodeText'
const nanoid = customAlphabet('1234567890abcdef', 12)

// TODO: 选择模板
export function setTemplate(store: TWidgetStore, allWidgets: TdWidgetData[]) {
  // const historyStore = useHistoryStore()
  const canvasStore = useCanvasStore()
  const widgetStore = useWidgetStore()
  allWidgets.forEach((item) => {
    Number(item.uuid) < 0 && (item.uuid = nanoid()) // 重设id
    item.text && (item.text = decodeTextIfNeeded(item.text))
    item.name && (item.name = repairKnownMojibake(item.name))
    if (item.fontClass?.alias) {
      item.fontClass.alias = repairKnownMojibake(item.fontClass.alias)
    }
    store.dWidgets.push(item)
  })
  widgetStore.updateDWidgets()
  canvasStore.reChangeCanvas()
}
