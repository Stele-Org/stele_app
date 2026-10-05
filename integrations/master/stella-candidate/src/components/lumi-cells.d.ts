import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import type { LumiCellsElement } from 'lumicells/element'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'lumi-cells': DetailedHTMLProps<HTMLAttributes<LumiCellsElement>, LumiCellsElement> & {
        preset?: 'reference'
      }
    }
  }
}
