import { useMemo } from 'react'
import { WithClasses, useTraverseProperties } from './properties/default'
import { ManagerCollection, Properties } from './properties/utils'
import { createConditionalPropertyTranslator } from './utils'
import { Signal } from '@preact/signals-core'

export type WithFocus<T> = T & {
  focus?: T
  onFocusChange?: (focus: boolean) => void
}

export function useApplyFocusProperties(
  collection: ManagerCollection,
  properties: WithClasses<WithFocus<Properties>>,
  hasFocusSignal: Signal<boolean>,
): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const translate = useMemo(() => createConditionalPropertyTranslator(() => hasFocusSignal.value), [hasFocusSignal])

  useTraverseProperties(properties, (p) => {
    if (p.focus == null) {
      return
    }
    translate(collection, p.focus)
  })
}
