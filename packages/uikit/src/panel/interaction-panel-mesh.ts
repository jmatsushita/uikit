import { Group, Intersection, Mesh, Object3D, Object3DEventMap, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { ClippingRect } from '../clipping.js'
import { Signal } from '@preact/signals-core'
import { RefObject } from 'react'
import { OrderInfo } from '../order.js'

const planeHelper = new Plane()
const vectorHelper = new Vector3()

const sides: Array<Plane> = [
  //left
  new Plane().setFromNormalAndCoplanarPoint(new Vector3(1, 0, 0), new Vector3(-0.5, 0, 0)),
  //right
  new Plane().setFromNormalAndCoplanarPoint(new Vector3(-1, 0, 0), new Vector3(0.5, 0, 0)),
  //bottom
  new Plane().setFromNormalAndCoplanarPoint(new Vector3(0, 1, 0), new Vector3(0, -0.5, 0)),
  //top
  new Plane().setFromNormalAndCoplanarPoint(new Vector3(0, -1, 0), new Vector3(0, 0.5, 0)),
]

const distancesHelper = [0, 0, 0, 0]

export function makePanelRaycast(mesh: Mesh): Mesh['raycast'] {
  return (raycaster: Raycaster, intersects: Array<Intersection<Object3D<Object3DEventMap>>>) => {
    const matrixWorld = mesh.matrixWorld
    planeHelper.constant = 0
    planeHelper.normal.set(0, 0, 1)
    planeHelper.applyMatrix4(matrixWorld)
    if (
      planeHelper.distanceToPoint(raycaster.ray.origin) <= 0 ||
      raycaster.ray.intersectPlane(planeHelper, vectorHelper) == null
    ) {
      return
    }

    const normal = planeHelper.normal.clone()

    for (let i = 0; i < 4; i++) {
      const side = sides[i]
      planeHelper.copy(side).applyMatrix4(matrixWorld)
      if ((distancesHelper[i] = planeHelper.distanceToPoint(vectorHelper)) < 0) {
        return
      }
    }

    intersects.push({
      distance: vectorHelper.distanceTo(raycaster.ray.origin),
      object: mesh,
      point: vectorHelper.clone(),
      uv: new Vector2(
        distancesHelper[0] / (distancesHelper[0] + distancesHelper[1]),
        distancesHelper[3] / (distancesHelper[2] + distancesHelper[3]),
      ),
      normal,
    })
  }
}

export function makeClippedRaycast(
  mesh: Mesh,
  fn: Mesh['raycast'],
  rootGroupRef: RefObject<Group>,
  clippingRect: Signal<ClippingRect | undefined> | undefined,
  orderInfo: OrderInfo,
): Mesh['raycast'] {
  return (raycaster: Raycaster, intersects: Intersection<Object3D<Object3DEventMap>>[]) => {
    const rootGroup = rootGroupRef.current
    if (rootGroup == null) {
      return
    }
    const oldLength = intersects.length
    fn.call(mesh, raycaster, intersects)
    const clippingPlanes = clippingRect?.value?.planes
    const outerMatrixWorld = rootGroup.matrixWorld
    outer: for (let i = intersects.length - 1; i >= oldLength; i--) {
      const intersection = intersects[i]
      intersection.distance -=
        orderInfo.majorIndex * 0.01 +
        orderInfo.elementType * 0.001 + //1-10
        orderInfo.minorIndex * 0.00001 //1-100
      if (clippingPlanes == null) {
        continue
      }
      for (let ii = 0; ii < 4; ii++) {
        planeHelper.copy(clippingPlanes[ii]).applyMatrix4(outerMatrixWorld)
        if (planeHelper.distanceToPoint(intersection.point) < 0) {
          intersects.splice(i, 1)
          continue outer
        }
      }
    }
  }
}
