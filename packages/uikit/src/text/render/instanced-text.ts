import { Signal, effect, signal, untracked } from '@preact/signals-core'
import { InstancedGlyph } from './instanced-glyph.js'
import { Color as ColorRepresentation } from '@react-three/fiber'
import { Matrix4, Vector2Tuple, Vector3Tuple } from 'three'
import { ClippingRect } from '../../clipping.js'
import { alignmentXMap, alignmentYMap } from '../../utils.js'
import {
  getGlyphLayoutHeight,
  getGlyphOffsetX,
  getGlyphOffsetY,
  getOffsetToNextGlyph,
  getOffsetToNextLine,
} from '../utils.js'
import { InstancedGlyphGroup } from './instanced-glyph-group.js'
import { GlyphLayout } from '../layout.js'
import { SelectionBoxes } from '../../selection.js'

export type TextAlignProperties = {
  horizontalAlign?: keyof typeof alignmentXMap | 'block'
  verticalAlign?: keyof typeof alignmentYMap
}

export type TextAppearanceProperties = {
  color?: ColorRepresentation
  opacity?: number
}

const noSelectionBoxes: SelectionBoxes = []

export class InstancedText {
  private glyphLines: Array<Array<InstancedGlyph | number>> = []
  private lastLayout: GlyphLayout | undefined

  private unsubscribeInitialList: Array<() => void> = []

  private unsubscribeShowList: Array<() => void> = []

  private opacity: number = 1
  private color: ColorRepresentation = 0xffffff

  constructor(
    private group: InstancedGlyphGroup,
    private getAlignmentProperties: Signal<
      (<K extends keyof TextAlignProperties>(key: K) => TextAlignProperties[K]) | undefined
    >,
    private getAppearanceProperties: Signal<
      (<K extends keyof TextAppearanceProperties>(key: K) => TextAppearanceProperties[K]) | undefined
    >,
    private layoutSignal: Signal<GlyphLayout | undefined>,
    private matrix: Signal<Matrix4 | undefined>,
    isHidden: Signal<boolean> | undefined,
    private parentClippingRect: Signal<ClippingRect | undefined> | undefined,
    private selectionRange: Signal<Vector2Tuple | undefined> | undefined,
    private selectionBoxes: Signal<SelectionBoxes> | undefined,
    private caretPosition: Signal<Vector3Tuple | undefined> | undefined,
  ) {
    this.unsubscribeInitialList = [
      effect(() => {
        const get = getAppearanceProperties.value
        if (get == null || isHidden?.value === true || (get('opacity') ?? 1) < 0.01) {
          this.hide()
          return
        }
        this.show()
      }),
      effect(() =>
        this.updateSelectionBoxes(
          this.lastLayout,
          selectionRange?.value,
          untracked(() => getAlignmentProperties.value?.('verticalAlign') ?? 'top'),
          untracked(() => getAlignmentProperties.value?.('horizontalAlign') ?? 'left'),
        ),
      ),
    ]
  }

  public getCharIndex(x: number, y: number): number {
    const verticalAlign = untracked(() => this.getAlignmentProperties.value?.('verticalAlign') ?? 'top')
    const layout = this.lastLayout
    if (layout == null) {
      return 0
    }
    y -= -getYOffset(layout, verticalAlign)
    const lineIndex = Math.floor(y / -getOffsetToNextLine(layout.lineHeight, layout.fontSize))
    const lines = layout.lines
    if (lineIndex < 0 || lines.length === 0) {
      return 0
    }
    if (lineIndex >= lines.length) {
      const lastLine = lines[lines.length - 1]
      return lastLine.charIndexOffset + lastLine.charLength + 1
    }

    const line = lines[lineIndex]
    const whitespaceWidth = layout.font.getGlyphInfo(' ').xadvance * layout.fontSize
    const glyphs = this.glyphLines[lineIndex]
    let glyphsLength = glyphs.length
    for (let i = 0; i < glyphsLength; i++) {
      const entry = glyphs[i]
      if (x < this.getGlyphX(entry, 0.5, whitespaceWidth) + layout.availableWidth / 2) {
        return i + line.charIndexOffset
      }
    }
    return line.charIndexOffset + line.charLength + 1
  }

  private updateSelectionBoxes(
    layout: GlyphLayout | undefined,
    range: Vector2Tuple | undefined,
    verticalAlign: keyof typeof alignmentYMap,
    horizontalAlign: keyof typeof alignmentXMap | 'block',
  ): void {
    if (this.caretPosition == null || this.selectionBoxes == null) {
      return
    }
    if (range == null || layout == null || layout.lines.length === 0) {
      this.caretPosition.value = undefined
      this.selectionBoxes.value = noSelectionBoxes
      return
    }
    const whitespaceWidth = layout.font.getGlyphInfo(' ').xadvance * layout.fontSize
    const [startCharIndexIncl, endCharIndexExcl] = range
    if (endCharIndexExcl <= startCharIndexIncl) {
      const { lineIndex, x } = this.getGlyphLineAndX(layout, endCharIndexExcl, true, whitespaceWidth, horizontalAlign)
      const y = -(
        getYOffset(layout, verticalAlign) -
        layout.availableHeight / 2 +
        lineIndex * getOffsetToNextLine(layout.lineHeight, layout.fontSize) +
        getGlyphOffsetY(layout.fontSize, layout.lineHeight)
      )
      this.caretPosition.value = [x, y - layout.fontSize / 2, layout.fontSize]
      this.selectionBoxes.value = []
      return
    }
    this.caretPosition.value = undefined
    const start = this.getGlyphLineAndX(layout, startCharIndexIncl, true, whitespaceWidth, horizontalAlign)
    const end = this.getGlyphLineAndX(layout, endCharIndexExcl - 1, false, whitespaceWidth, horizontalAlign)
    if (start.lineIndex === end.lineIndex) {
      this.selectionBoxes.value = [
        this.computeSelectionBox(start.lineIndex, start.x, end.x, layout, verticalAlign, whitespaceWidth),
      ]
      return
    }
    const newSelectionBoxes: SelectionBoxes = [
      this.computeSelectionBox(start.lineIndex, start.x, undefined, layout, verticalAlign, whitespaceWidth),
    ]
    for (let i = start.lineIndex + 1; i < end.lineIndex; i++) {
      newSelectionBoxes.push(this.computeSelectionBox(i, undefined, undefined, layout, verticalAlign, whitespaceWidth))
    }
    newSelectionBoxes.push(
      this.computeSelectionBox(end.lineIndex, undefined, end.x, layout, verticalAlign, whitespaceWidth),
    )
    this.selectionBoxes.value = newSelectionBoxes
  }

  private computeSelectionBox(
    lineIndex: number,
    startX: number | undefined,
    endX: number | undefined,
    layout: GlyphLayout,
    verticalAlign: keyof typeof alignmentYMap,
    whitespaceWidth: number,
  ): SelectionBoxes[number] {
    const lineGlyphs = this.glyphLines[lineIndex]
    if (startX == null) {
      startX = this.getGlyphX(lineGlyphs[0], 0, whitespaceWidth)
    }
    if (endX == null) {
      endX = this.getGlyphX(lineGlyphs[lineGlyphs.length - 1], 1, whitespaceWidth)
    }
    const y = -(
      getYOffset(layout, verticalAlign) -
      layout.availableHeight / 2 +
      lineIndex * getOffsetToNextLine(layout.lineHeight, layout.fontSize) +
      getGlyphOffsetY(layout.fontSize, layout.lineHeight)
    )
    const width = endX - startX
    const height = layout.fontSize + layout.lineHeight
    return { position: [startX + width / 2, y - height / 2], size: [width, height] }
  }

  private getGlyphLineAndX(
    { lines, availableWidth }: GlyphLayout,
    charIndex: number,
    start: boolean,
    whitespaceWidth: number,
    horizontalAlign: keyof typeof alignmentXMap | 'block',
  ): { lineIndex: number; x: number } {
    const linesLength = lines.length
    for (let lineIndex = 0; lineIndex < linesLength; lineIndex++) {
      const line = lines[lineIndex]
      if (charIndex >= line.charIndexOffset + line.charLength) {
        continue
      }
      //line found
      const glyphEntry = this.glyphLines[lineIndex][Math.max(charIndex - line.charIndexOffset, 0)]
      return { lineIndex, x: this.getGlyphX(glyphEntry, start ? 0 : 1, whitespaceWidth) }
    }
    const lastLine = lines[linesLength - 1]
    if (lastLine.charLength === 0) {
      return {
        lineIndex: linesLength - 1,
        x: getXOffset(availableWidth, lastLine.nonWhitespaceWidth, horizontalAlign) - availableWidth / 2,
      }
    }
    const lastGlyphEntry = this.glyphLines[linesLength - 1][lastLine.charLength - 1]
    return { lineIndex: linesLength - 1, x: this.getGlyphX(lastGlyphEntry, 1, whitespaceWidth) }
  }

  private getGlyphX(entry: number | InstancedGlyph, widthMultiplier: number, whitespaceWidth: number) {
    if (typeof entry === 'number') {
      return entry + widthMultiplier * whitespaceWidth
    }
    return entry.getX(widthMultiplier)
  }

  private show() {
    if (this.unsubscribeShowList.length > 0) {
      return
    }
    traverseGlyphs(this.glyphLines, (glyph) => glyph.show())
    this.unsubscribeShowList.push(
      effect(() => {
        const matrix = this.matrix.value
        if (matrix == null) {
          return
        }
        traverseGlyphs(this.glyphLines, (glyph) => glyph.updateBaseMatrix(matrix))
      }),
      effect(() => {
        const clippingRect = this.parentClippingRect?.value
        traverseGlyphs(this.glyphLines, (glyph) => glyph.updateClippingRect(clippingRect))
      }),
      effect(() => {
        const get = this.getAppearanceProperties.value
        if (get == null) {
          return
        }
        const color = (this.color = get('color') ?? 0xffffff)
        traverseGlyphs(this.glyphLines, (glyph) => glyph.updateColor(color))
      }),
      effect(() => {
        const get = this.getAppearanceProperties.value
        if (get == null) {
          return
        }
        const opacity = (this.opacity = get('opacity') ?? 1)
        traverseGlyphs(this.glyphLines, (glyph) => glyph.updateOpacity(opacity))
      }),
      effect(() => {
        const layout = this.layoutSignal.value
        const get = this.getAlignmentProperties.value
        if (layout == null || get == null) {
          return
        }
        const { text, font, lines, letterSpacing = 0, fontSize = 16, lineHeight = 1.2, availableWidth } = layout

        const verticalAlign = get('verticalAlign') ?? 'top'
        const horizontalAlign = get('horizontalAlign') ?? 'left'
        let y = getYOffset(layout, verticalAlign) - layout.availableHeight / 2

        const linesLength = lines.length
        const pixelSize = this.group.pixelSize
        for (let lineIndex = 0; lineIndex < linesLength; lineIndex++) {
          if (lineIndex === this.glyphLines.length) {
            this.glyphLines.push([])
          }

          const {
            whitespacesBetween,
            nonWhitespaceWidth,
            charIndexOffset: firstNonWhitespaceCharIndex,
            nonWhitespaceCharLength,
            charLength,
          } = lines[lineIndex]

          let offsetPerWhitespace =
            horizontalAlign === 'block' ? (availableWidth - nonWhitespaceWidth) / whitespacesBetween : 0
          let x = getXOffset(availableWidth, nonWhitespaceWidth, horizontalAlign) - availableWidth / 2

          let prevGlyphId: number | undefined
          const glyphs = this.glyphLines[lineIndex]

          for (
            let charIndex = firstNonWhitespaceCharIndex;
            charIndex < firstNonWhitespaceCharIndex + charLength;
            charIndex++
          ) {
            const glyphIndex = charIndex - firstNonWhitespaceCharIndex
            const char = text[charIndex]
            const glyphInfo = font.getGlyphInfo(char)
            if (char === ' ' || charIndex > nonWhitespaceCharLength + firstNonWhitespaceCharIndex) {
              prevGlyphId = glyphInfo.id
              const xPosition = x + getGlyphOffsetX(font, fontSize, glyphInfo, prevGlyphId)
              if (typeof glyphs[glyphIndex] === 'number') {
                glyphs[glyphIndex] = x
              } else {
                glyphs.splice(glyphIndex, 0, xPosition)
              }
              x += offsetPerWhitespace + getOffsetToNextGlyph(fontSize, glyphInfo, letterSpacing)
              continue
            }
            //non space character
            //delete undefined entries so we find a reusable glyph
            let glyphOrNumber = glyphs[glyphIndex]
            while (glyphIndex < glyphs.length && typeof glyphOrNumber == 'number') {
              glyphs.splice(glyphIndex, 1)
              glyphOrNumber = glyphs[glyphIndex]
            }
            //the prev. loop assures that glyphOrNumber is a InstancedGlyph or undefined
            let glyph = glyphOrNumber as InstancedGlyph
            if (glyph == null) {
              //no reusable glyph found
              glyphs[glyphIndex] = glyph = new InstancedGlyph(
                this.group,
                this.matrix.peek(),
                this.color,
                this.opacity,
                this.parentClippingRect?.peek(),
              )
            }
            glyph.updateGlyphAndTransformation(
              glyphInfo,
              x + getGlyphOffsetX(font, fontSize, glyphInfo, prevGlyphId),
              -(y + getGlyphOffsetY(fontSize, lineHeight, glyphInfo)),
              fontSize,
              pixelSize,
            )
            glyph.show()
            prevGlyphId = glyphInfo.id
            x += getOffsetToNextGlyph(fontSize, glyphInfo, letterSpacing)
          }

          y += getOffsetToNextLine(lineHeight, fontSize)

          //remove unnecassary glyphs
          const glyphsLength = glyphs.length
          const newGlyphsLength = charLength
          for (let ii = newGlyphsLength; ii < glyphsLength; ii++) {
            const glyph = glyphs[ii]
            if (typeof glyph === 'number') {
              continue
            }
            glyph.hide()
          }
          glyphs.length = newGlyphsLength
        }
        //remove unnecassary glyph lines
        traverseGlyphs(this.glyphLines, (glyph) => glyph.hide(), linesLength)
        this.glyphLines.length = linesLength
        this.lastLayout = layout
        this.updateSelectionBoxes(layout, this.selectionRange?.peek(), verticalAlign, horizontalAlign)
      }),
    )
  }

  private hide() {
    const unsubscribeListLength = this.unsubscribeShowList.length
    if (unsubscribeListLength === 0) {
      return
    }
    for (let i = 0; i < unsubscribeListLength; i++) {
      this.unsubscribeShowList[i]()
    }
    this.unsubscribeShowList.length = 0
    traverseGlyphs(this.glyphLines, (glyph) => glyph.hide())
  }

  destroy(): void {
    this.hide()
    this.glyphLines.length = 0
    const length = this.unsubscribeInitialList.length
    for (let i = 0; i < length; i++) {
      this.unsubscribeInitialList[i]()
    }
  }
}

function getXOffset(
  availableWidth: number,
  nonWhitespaceWidth: number,
  horizontalAlign: keyof typeof alignmentXMap | 'block',
) {
  switch (horizontalAlign) {
    case 'right':
      return availableWidth - nonWhitespaceWidth
    case 'center':
      return (availableWidth - nonWhitespaceWidth) / 2
    default:
      return 0
  }
}

function getYOffset(layout: GlyphLayout, verticalAlign: keyof typeof alignmentYMap) {
  switch (verticalAlign) {
    case 'center':
      return (layout.availableHeight - getGlyphLayoutHeight(layout.lines.length, layout)) / 2
    case 'bottom':
      return layout.availableHeight - getGlyphLayoutHeight(layout.lines.length, layout)
    default:
      return 0
  }
}

function traverseGlyphs(
  glyphLines: Array<Array<InstancedGlyph | number>>,
  fn: (glyph: InstancedGlyph) => void,
  offset: number = 0,
): void {
  const glyphLinesLength = glyphLines.length
  for (let i = offset; i < glyphLinesLength; i++) {
    const glyphs = glyphLines[i]
    const glyphsLength = glyphs.length
    for (let ii = 0; ii < glyphsLength; ii++) {
      const glyph = glyphs[ii]
      if (typeof glyph == 'number') {
        continue
      }
      fn(glyph)
    }
  }
}
