import { createContext, useContext, useMemo } from 'react'
import { RenderItem, WebGLRenderer } from 'three'

export type CameraDistanceRef = { current: number }

export const cameraDistanceKey = Symbol('camera-distance-key')
export const orderInfoKey = Symbol('order-info-key')

function reversePainterSortStable(a: RenderItem, b: RenderItem) {
  if (a.groupOrder !== b.groupOrder) {
    return a.groupOrder - b.groupOrder
  }
  if (a.renderOrder !== b.renderOrder) {
    return a.renderOrder - b.renderOrder
  }
  const aDistanceRef = (a.object as any)[cameraDistanceKey] as CameraDistanceRef
  const bDistanceRef = (b.object as any)[cameraDistanceKey] as CameraDistanceRef
  if (aDistanceRef == null || bDistanceRef == null) {
    //default z comparison
    return a.z !== b.z ? b.z - a.z : a.id - b.id
  }
  if (aDistanceRef === bDistanceRef) {
    return compareOrderInfo((a.object as any)[orderInfoKey], (b.object as any)[orderInfoKey])
  }
  return bDistanceRef.current - aDistanceRef.current
}

export function patchRenderOrder(renderer: WebGLRenderer): void {
  renderer.setTransparentSort(reversePainterSortStable)
}

//the following order tries to represent the most common element order of the respective element types (e.g. panels are most likely the background element)
export const ElementType = {
  Panel: 0, //render first
  Image: 1,
  Object: 2,
  Custom: 3,
  Svg: 4,
  Text: 5, //render last
} as const

export type ElementType = (typeof ElementType)[keyof typeof ElementType]

export type OrderInfo = {
  majorIndex: number
  elementType: ElementType
  minorIndex: number
  instancedGroupDependencies?: Record<string, any> | undefined
}

function compareOrderInfo(o1: OrderInfo, o2: OrderInfo): number {
  let dif = o1.majorIndex - o2.majorIndex
  if (dif != 0) {
    return dif
  }
  dif = o1.elementType - o2.elementType
  if (dif != 0) {
    return dif
  }
  return o1.minorIndex - o2.minorIndex
}

export const OrderInfoContext = createContext<OrderInfo | undefined>(undefined)

export const OrderInfoProvider = OrderInfoContext.Provider

export type ZIndexOffset = { major?: number; minor?: number } | number

export function useOrderInfo(
  type: ElementType,
  offset: ZIndexOffset | undefined,
  instancedGroupDependencies: Record<string, any> | undefined,
  providedParentOrderInfo?: OrderInfo,
): OrderInfo {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const parentOrderInfo = providedParentOrderInfo ?? (useContext(OrderInfoContext) as OrderInfo | undefined)
  const majorOffset = typeof offset === 'number' ? offset : offset?.major ?? 0
  const minorOffset = typeof offset === 'number' ? 0 : offset?.minor ?? 0
  return useMemo(() => {
    let majorIndex: number
    let minorIndex: number

    if (parentOrderInfo == null) {
      majorIndex = 0
      minorIndex = 0
    } else if (type > parentOrderInfo.elementType) {
      majorIndex = parentOrderInfo.majorIndex
      minorIndex = 0
    } else if (
      type != parentOrderInfo.elementType ||
      !shallowEqualRecord(instancedGroupDependencies, parentOrderInfo.instancedGroupDependencies)
    ) {
      majorIndex = parentOrderInfo.majorIndex + 1
      minorIndex = 0
    } else {
      majorIndex = parentOrderInfo.majorIndex
      minorIndex = parentOrderInfo.minorIndex + 1
    }

    if (majorOffset > 0) {
      majorIndex += majorOffset
      minorIndex = 0
    }

    minorIndex += minorOffset

    return {
      instancedGroupDependencies,
      elementType: type,
      majorIndex,
      minorIndex,
    }
  }, [majorOffset, minorOffset, parentOrderInfo, type, instancedGroupDependencies])
}

function shallowEqualRecord(r1: Record<string, any> | undefined, r2: Record<string, any> | undefined): boolean {
  if (r1 === r2) {
    return true
  }
  if (r1 == null || r2 == null) {
    return false
  }
  //i counts the number of keys in r1
  let i = 0
  for (const key in r1) {
    if (r1[key] != r2[key]) {
      return false
    }
    ++i
  }
  return i === Object.keys(r2).length
}

export function setupRenderOrder<T>(result: T, rootCameraDistance: CameraDistanceRef, orderInfo: OrderInfo): T {
  ;(result as any)[cameraDistanceKey] = rootCameraDistance
  ;(result as any)[orderInfoKey] = orderInfo
  return result
}
